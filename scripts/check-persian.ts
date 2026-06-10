import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

try {
  const buf = readFileSync(join(process.cwd(), '.env.local'));
  const raw =
    buf[0] === 0xff && buf[1] === 0xfe
      ? buf.slice(2).toString('utf16le')
      : buf.toString('utf-8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.replace(/^﻿/, '').trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function main() {
  // Fetch one row to inspect columns
  const { data: sample, error: sampleErr } = await supabase
    .from('library_hadiths')
    .select('*')
    .limit(1);

  if (sampleErr) {
    console.error('Error fetching sample:', sampleErr.message);
    process.exit(1);
  }

  const columns = sample?.[0] ? Object.keys(sample[0]) : [];
  console.log('Columns in library_hadiths:', columns);

  // Find any Persian/Farsi-related columns
  const persianCols = columns.filter(
    (c) => c.includes('persian') || c.includes('farsi') || c.includes('fa_') || c === 'fa',
  );
  console.log('Persian/Farsi columns found:', persianCols.length ? persianCols : 'none');

  if (persianCols.length === 0) {
    console.log('\nNo dedicated Persian column exists in the table.');

    // Count total hadiths anyway
    const { count, error: countErr } = await supabase
      .from('library_hadiths')
      .select('*', { count: 'exact', head: true });

    if (!countErr) console.log(`Total hadiths in table: ${count}`);
    return;
  }

  // Count hadiths with Persian translations for each Persian column
  for (const col of persianCols) {
    const { count, error } = await supabase
      .from('library_hadiths')
      .select('*', { count: 'exact', head: true })
      .not(col, 'is', null)
      .neq(col, '');

    if (error) {
      console.error(`Error counting ${col}:`, error.message);
    } else {
      console.log(`\nHadiths with non-empty "${col}": ${count}`);
    }
  }

  // Also breakdown by collection
  if (persianCols.length > 0) {
    const col = persianCols[0];
    const { data: breakdown, error: bErr } = await supabase
      .from('library_hadiths')
      .select('collection_key')
      .not(col, 'is', null)
      .neq(col, '');

    if (!bErr && breakdown) {
      const counts: Record<string, number> = {};
      for (const row of breakdown) {
        counts[row.collection_key] = (counts[row.collection_key] ?? 0) + 1;
      }
      console.log('\nBreakdown by collection:');
      for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${k}: ${v}`);
      }
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
