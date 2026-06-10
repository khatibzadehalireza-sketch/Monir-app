import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

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

async function main() {
  const r = await fetch('https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/tur-malik.json');
  const j = await r.json() as { hadiths: Array<{ hadithnumber: number; text: string }> };

  const sample = j.hadiths.slice(0, 3).map((h) => ({
    collection_key: 'malik',
    hadith_number: Number(h.hadithnumber),
    turkish_text: h.text,
  }));

  console.log('Sample rows to upsert:', JSON.stringify(sample, null, 2));

  const { error, count } = await sb
    .from('library_hadiths')
    .upsert(sample, { onConflict: 'collection_key,hadith_number', ignoreDuplicates: false, count: 'exact' });

  if (error) {
    console.error('Upsert error:', error.message);
    process.exit(1);
  }
  console.log('\nUpsert succeeded, count:', count);

  const { data } = await sb
    .from('library_hadiths')
    .select('hadith_number, turkish_text')
    .eq('collection_key', 'malik')
    .lte('hadith_number', 3)
    .order('hadith_number');

  console.log('\nVerified from DB:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
