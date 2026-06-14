/**
 * Full library import:
 *   Task 1 — Tafsir Ibn Kathir Arabic  (api.qurancdn.com, tafsir ID 14)
 *   Task 2 — Tafsir Ibn Kathir English (api.qurancdn.com, tafsir ID 169)
 *   Task 3 — Riyad al-Salihin (AhmedBaset/hadith-json, Arabic + English)
 *   Task 4 — Audit row counts for all library_ tables
 *
 * Note: library_tafsir has no "source" column — author_name="Ibn Kathir" is used instead.
 * All inserts use ON CONFLICT DO NOTHING — existing rows are never overwritten.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// ─── env loading (UTF-8 and UTF-16 LE) ───────────────────────────────────────
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
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
} catch { /* rely on pre-set env */ }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// ─── helpers ─────────────────────────────────────────────────────────────────

function sep(title: string) {
  const line = '─'.repeat(62);
  console.log(`\n${line}\n  ${title}\n${line}`);
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json() as Promise<T>;
}

// ─── TASKS 1 & 2: Tafsir Ibn Kathir ─────────────────────────────────────────

interface QuranCdnResponse {
  tafsirs: Array<{
    resource_id: number;
    verse_key: string;        // "1:1"
    text: string;
  }>;
}

interface TafsirRow {
  surah_number: number;
  verse_number: number;
  language_code: string;
  tafsir_text: string;
  author_name: string;
}

async function importTafsir(
  tafsirId: number,
  languageCode: 'ar' | 'en',
  taskNum: number,
): Promise<void> {
  sep(`TASK ${taskNum} — Tafsir Ibn Kathir (${languageCode.toUpperCase()}) — qurancdn ID ${tafsirId}`);

  const BASE = `https://api.qurancdn.com/api/qdc/tafsirs/${tafsirId}/by_chapter`;
  const DELAY_MS = 300;
  const DB_BATCH = 500;

  const allRows: TafsirRow[] = [];

  for (let surah = 1; surah <= 114; surah++) {
    const url = `${BASE}/${surah}?per_page=300`;
    let data: QuranCdnResponse;
    try {
      data = await fetchJson<QuranCdnResponse>(url);
    } catch (err) {
      console.warn(`  [warn] surah ${surah}: ${(err as Error).message}`);
      await sleep(DELAY_MS);
      continue;
    }

    const verses = data.tafsirs ?? [];
    let surahCount = 0;
    for (const v of verses) {
      const [s, vn] = v.verse_key.split(':').map(Number);
      const text = v.text?.replace(/<[^>]+>/g, '').trim();
      if (!text) continue;
      allRows.push({
        surah_number: s,
        verse_number: vn,
        language_code: languageCode,
        tafsir_text: text,
        author_name: 'Ibn Kathir',
      });
      surahCount++;
    }

    if (surah % 10 === 0 || surah === 114) {
      console.log(`  Fetched surah ${surah}/114 — ${surahCount} verses (total so far: ${allRows.length})`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n  Total fetched: ${allRows.length} verses. Inserting into library_tafsir…`);

  let inserted = 0;
  let skipped  = 0;

  for (let i = 0; i < allRows.length; i += DB_BATCH) {
    const batch = allRows.slice(i, i + DB_BATCH);

    const { error, count } = await supabase
      .from('library_tafsir')
      .upsert(batch, {
        onConflict: 'surah_number,verse_number,language_code',
        ignoreDuplicates: true,
        count: 'exact',
      });

    if (error) {
      console.error(`  [error] batch ${i}–${i + batch.length}: ${error.message}`);
    } else {
      const got     = count ?? 0;
      inserted += got;
      skipped  += batch.length - got;
    }

    const done = Math.min(i + DB_BATCH, allRows.length);
    console.log(`  [DB ${done}/${allRows.length}] inserted: ${inserted}, skipped: ${skipped}`);
  }

  console.log(`\nResult  : ${inserted} new rows inserted, ${skipped} duplicates skipped.`);
}

// ─── TASK 3: Riyad al-Salihin ────────────────────────────────────────────────

interface AhmedHadith {
  idInBook: number;
  arabic: string;
  english?: { narrator?: string; text?: string };
}

interface AhmedResponse {
  hadiths: AhmedHadith[];
}

interface RiyadRow {
  hadith_number: number;
  arabic_text: string;
  english_text: string;
  turkish_text: string;
  urdu_text: string;
  french_text: string;
  bengali_text: string;
  grade: string | null;
}

async function importRiyadSalihin(): Promise<void> {
  sep('TASK 3 — Riyad al-Salihin (Arabic + English) — AhmedBaset/hadith-json');

  const CDN = 'https://cdn.jsdelivr.net/gh/AhmedBaset/hadith-json@main/db/by_book/other_books/riyad_assalihin.json';
  const RAW = 'https://raw.githubusercontent.com/AhmedBaset/hadith-json/main/db/by_book/other_books/riyad_assalihin.json';

  console.log('  Fetching from CDN…');
  let data: AhmedResponse | null = null;
  try {
    data = await fetchJson<AhmedResponse>(CDN);
  } catch {
    console.log('  CDN failed, trying raw GitHub…');
    try { data = await fetchJson<AhmedResponse>(RAW); } catch { /* fall through */ }
  }

  if (!data?.hadiths?.length) {
    console.error('  Failed to fetch Riyad al-Salihin data.');
    return;
  }

  console.log(`  Fetched ${data.hadiths.length} hadiths.`);

  const rows: RiyadRow[] = [];
  let malformed = 0;

  for (const h of data.hadiths) {
    if (!h.idInBook || !h.arabic?.trim()) { malformed++; continue; }
    const narrator = h.english?.narrator?.trim() ?? '';
    const engText  = h.english?.text?.trim() ?? '';
    rows.push({
      hadith_number: h.idInBook,
      arabic_text:   h.arabic.trim(),
      english_text:  narrator ? `${narrator}\n${engText}` : engText,
      turkish_text:  '',
      urdu_text:     '',
      french_text:   '',
      bengali_text:  '',
      grade: null,
    });
  }

  console.log(`  Valid rows: ${rows.length} (${malformed} malformed skipped)`);
  console.log(`  Inserting into library_riyad_salihin…`);

  const BATCH = 200;
  let inserted = 0;
  let skipped  = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);

    const { error, count } = await supabase
      .from('library_riyad_salihin')
      .upsert(batch, {
        onConflict: 'hadith_number',
        ignoreDuplicates: true,
        count: 'exact',
      });

    if (error) {
      console.error(`  [error] batch ${i}–${i + batch.length}: ${error.message}`);
    } else {
      const got  = count ?? 0;
      inserted += got;
      skipped  += batch.length - got;
    }

    const done = Math.min(i + BATCH, rows.length);
    console.log(`  [${done}/${rows.length}] inserted: ${inserted}, skipped: ${skipped}`);
  }

  console.log(`\nResult  : ${inserted} new rows inserted, ${skipped} duplicates skipped.`);
}

// ─── TASK 4: Audit ───────────────────────────────────────────────────────────

async function audit(): Promise<void> {
  sep('TASK 4 — Final Library Audit');

  const tables = ['library_tafsir', 'library_riyad_salihin'];
  const results: { table: string; count: number | string }[] = [];

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    results.push({ table, count: error ? `ERROR: ${error.message}` : (count ?? 0) });
  }

  const maxLen = Math.max(...results.map((r) => r.table.length));
  console.log(`\n  ${'Table'.padEnd(maxLen + 2)}Rows`);
  console.log(`  ${'─'.repeat(maxLen + 10)}`);
  for (const r of results) {
    const cnt =
      typeof r.count === 'number' ? r.count.toLocaleString() : r.count;
    console.log(`  ${r.table.padEnd(maxLen + 2)}${cnt}`);
  }
  console.log('');
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║            Monir App — Full Library Import                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`Started : ${new Date().toISOString()}`);
  console.log('');
  console.log('Sources:');
  console.log('  Tafsir Arabic  → api.qurancdn.com (Ibn Kathir, ID 14)');
  console.log('  Tafsir English → api.qurancdn.com (Ibn Kathir, ID 169)');
  console.log('  Riyad Salihin  → AhmedBaset/hadith-json (Arabic + English)');
  console.log('  Note: library_tafsir has no "source" column; author_name="Ibn Kathir" is used.');

  await importTafsir(14, 'ar', 1);
  await importTafsir(169, 'en', 2);
  await importRiyadSalihin();
  await audit();

  console.log(`Finished: ${new Date().toISOString()}`);
}

main().catch((err) => {
  console.error('\nFatal:', err.message ?? err);
  process.exit(1);
});
