/**
 * Import Musnad Ahmad from AhmedBaset/hadith-json.
 *
 * NOTE: AhmedBaset's dataset only contains 1,374 Ahmad hadiths (the Musnad
 * Abd Allah ibn al-Mubarak subset scraped from sunnah.com).  The full Musnad
 * Ahmad (27,647 hadiths) is not available from any working free public API.
 * This script imports whatever AhmedBaset has; ON CONFLICT DO NOTHING means
 * rows already in the DB are silently skipped.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

try {
  const buf = readFileSync(join(process.cwd(), '.env.local'));
  const raw = buf[0]===0xff&&buf[1]===0xfe ? buf.slice(2).toString('utf16le') : buf.toString('utf-8');
  for (const line of raw.split(/\r\n|\n/)) {
    const t = line.replace(/^﻿/,'').trim();
    if (!t||t.startsWith('#')) continue;
    const eq = t.indexOf('='); if (eq===-1) continue;
    const k=t.slice(0,eq).trim(), v=t.slice(eq+1).trim().replace(/^["']|["']$/g,'');
    if (!process.env[k]) process.env[k]=v;
  }
} catch {}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {auth:{persistSession:false}});
const UA = 'Mozilla/5.0';

interface HadithEntry {
  idInBook: number;
  arabic: string;
  english: { narrator?: string; text?: string };
}
interface CollectionFile { hadiths: HadithEntry[] }

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url, {headers:{'User-Agent':UA}});
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${url}`);
  return r.json() as Promise<T>;
}

async function main() {
  const CDN = 'https://cdn.jsdelivr.net/gh/AhmedBaset/hadith-json@v1.2.0/db/by_book/the_9_books/ahmed.json';
  const RAW = 'https://raw.githubusercontent.com/AhmedBaset/hadith-json/v1.2.0/db/by_book/the_9_books/ahmed.json';

  console.log('=== TASK 1 — Import Musnad Ahmad ===\n');
  console.log('Source: AhmedBaset/hadith-json v1.2.0');
  console.log('⚠  WARNING: AhmedBaset only has ~1,374 Ahmad hadiths.');
  console.log('   The full 27,647 is not available from any working free source.\n');

  let data: CollectionFile | null = null;
  process.stdout.write('Fetching from CDN…');
  try { data = await fetchJson<CollectionFile>(CDN); process.stdout.write(' OK\n'); }
  catch { process.stdout.write(' failed, trying raw GitHub…'); }

  if (!data) {
    try { data = await fetchJson<CollectionFile>(RAW); process.stdout.write(' OK\n'); }
    catch (e) { console.error(' FAIL:', (e as Error).message); process.exit(1); }
  }

  if (!data?.hadiths?.length) { console.error('No hadiths in response.'); process.exit(1); }
  console.log(`Fetched ${data.hadiths.length} hadiths from AhmedBaset.\n`);

  const rows = data.hadiths
    .filter(h => h.idInBook && h.arabic?.trim())
    .map(h => {
      const narrator = h.english?.narrator?.trim() ?? '';
      const text     = h.english?.text?.trim() ?? '';
      return {
        collection_key: 'ahmad',
        hadith_number:  h.idInBook,
        arabic_text:    h.arabic.trim(),
        english_text:   narrator ? `${narrator} ${text}` : text,
        grade:          null as string | null,
      };
    });

  console.log(`Valid rows: ${rows.length}. Inserting with ON CONFLICT DO NOTHING…\n`);

  const CHUNK = 200;
  let inserted = 0, skipped = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const { error, count } = await sb
      .from('library_hadiths')
      .upsert(batch, { onConflict: 'collection_key,hadith_number', ignoreDuplicates: true, count: 'exact' });

    if (error) { console.error(`  [error] chunk ${i}: ${error.message}`); }
    else {
      const got = count ?? 0;
      inserted += got;
      skipped  += batch.length - got;
    }
    console.log(`  [${Math.min(i+CHUNK, rows.length)}/${rows.length}] inserted: ${inserted}, skipped (already existed): ${skipped}`);
  }

  // Final count
  const { count: totalAhmad } = await sb.from('library_hadiths').select('*',{count:'exact',head:true}).eq('collection_key','ahmad');
  console.log(`\nResult: ${inserted} new rows inserted, ${skipped} skipped.`);
  console.log(`Total ahmad in DB: ${totalAhmad} / 27,647 (${(((totalAhmad??0)/27647)*100).toFixed(1)}% of full collection)`);
  console.log('\n⚠  To get the remaining ~26,000+ hadiths, a paid API (e.g. sunnah.com) or a');;
  console.log('   downloadable dataset is required. No free source currently provides them.');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
