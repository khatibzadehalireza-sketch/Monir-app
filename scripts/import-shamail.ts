/**
 * Import Shamail al-Tirmidhi (Shamail Muhammadiyah) from AhmedBaset/hadith-json v1.2.0.
 * Source has ~240 hadiths. collection_key: shamail
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

try {
  const buf = readFileSync(join(process.cwd(), '.env.local'));
  const raw = buf[0] === 0xff && buf[1] === 0xfe
    ? buf.slice(2).toString('utf16le')
    : buf.toString('utf-8');
  for (const line of raw.split(/\r?\n/)) {
    const t = line.replace(/^﻿/, '').trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
} catch {}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const CDN = 'https://cdn.jsdelivr.net/gh/AhmedBaset/hadith-json@v1.2.0/db/by_book/other_books/shamail_muhammadiyah.json';
const RAW = 'https://raw.githubusercontent.com/AhmedBaset/hadith-json/v1.2.0/db/by_book/other_books/shamail_muhammadiyah.json';
const COLLECTION_KEY = 'shamail';
const BATCH = 200;

interface HadithEntry { idInBook: number; chapterId?: number; arabic: string; english: { narrator?: string; text?: string } }
interface CollectionFile { hadiths: HadithEntry[] }

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { 'User-Agent': 'monir-import/1.0' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} — ${url}`);
  return r.json() as Promise<T>;
}

async function main() {
  console.log('=== Import Shamail al-Tirmidhi — AhmedBaset/hadith-json v1.2.0 ===\n');

  let data: CollectionFile | null = null;
  process.stdout.write('Fetching from CDN...');
  try { data = await fetchJson<CollectionFile>(CDN); console.log(' OK'); }
  catch { process.stdout.write(' failed, trying raw GitHub...'); }

  if (!data) {
    try { data = await fetchJson<CollectionFile>(RAW); console.log(' OK'); }
    catch (e) { console.error(' FAIL:', (e as Error).message); process.exit(1); }
  }

  const hadiths = data?.hadiths ?? [];
  if (!hadiths.length) { console.error('No hadiths in response.'); process.exit(1); }
  console.log(`Source hadiths: ${hadiths.length}\n`);

  const rows = hadiths
    .filter(h => h.idInBook && h.arabic?.trim())
    .map(h => {
      const narrator = h.english?.narrator?.trim() ?? '';
      const body = h.english?.text?.trim() ?? '';
      return {
        collection_key: COLLECTION_KEY,
        hadith_number: h.idInBook,
        chapter_number: h.chapterId ?? null,
        arabic_text: h.arabic.trim(),
        english_text: narrator ? `${narrator}\n${body}` : body || null,
        grade: null as string | null,
      };
    });

  console.log(`Valid rows: ${rows.length}. Upserting...\n`);

  let inserted = 0, skipped = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error, count } = await sb
      .from('library_hadiths')
      .upsert(batch, { onConflict: 'collection_key,hadith_number', ignoreDuplicates: true, count: 'exact' });
    if (error) { console.error(`  [error] chunk ${i}: ${error.message}`); continue; }
    const got = count ?? 0;
    inserted += got;
    skipped += batch.length - got;
    console.log(`  [${Math.min(i + BATCH, rows.length)}/${rows.length}] inserted: ${inserted}, skipped: ${skipped}`);
  }

  const { count: total } = await sb.from('library_hadiths').select('*', { count: 'exact', head: true }).eq('collection_key', COLLECTION_KEY);
  console.log(`\nDone. ${inserted} inserted, ${skipped} already existed.`);
  console.log(`Total shamail in DB: ${total}`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
