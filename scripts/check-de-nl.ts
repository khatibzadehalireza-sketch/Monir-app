import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

try {
  const buf = readFileSync(join(process.cwd(), '.env.local'));
  const raw = buf[0] === 0xff && buf[1] === 0xfe ? buf.slice(2).toString('utf16le') : buf.toString('utf-8');
  for (const line of raw.split(/\r?\n/)) {
    const t = line.replace(/^﻿/, '').trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('='); if (eq === -1) continue;
    const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
} catch {}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function count(col: string) {
  const { count } = await sb.from('library_hadiths').select('*', { count: 'exact', head: true }).not(col, 'is', null).neq(col, '');
  return count;
}

async function main() {
  const [de, nl] = await Promise.all([count('german_text'), count('dutch_text')]);
  console.log(`german_text : ${de?.toLocaleString()} rows`);
  console.log(`dutch_text  : ${nl?.toLocaleString()} rows`);

  // Breakdown by collection for german
  const { data } = await sb.from('library_hadiths').select('collection_key').not('german_text', 'is', null).neq('german_text', '');
  if (data) {
    const counts: Record<string, number> = {};
    for (const r of data) counts[r.collection_key] = (counts[r.collection_key] ?? 0) + 1;
    console.log('\nGerman breakdown by collection:');
    for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k.padEnd(20)} ${v}`);
    }
  }
}

main().catch(console.error);
