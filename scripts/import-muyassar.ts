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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Source: ummahapi.com (mirrors qurancdn / quran.com data)
const BASE = 'https://ummahapi.com/api/tafsir/muyassar';
const AUTHOR_NAME = 'Ministry of Islamic Affairs, Saudi Arabia';
const LANGUAGE_CODE = 'ar';
const DELAY_MS = 150;
const BATCH_SIZE = 500;
const LOG_EVERY = 100;

const VERSE_COUNTS = [
   7, 286, 200, 176, 120, 165, 206,  75, 129, 109,
 123, 111,  43,  52,  99, 128, 111, 110,  98, 135,
 112,  78, 118,  64,  77, 227,  93,  88,  69,  60,
  34,  30,  73,  54,  45,  83, 182,  88,  75,  85,
  54,  53,  89,  59,  37,  35,  38,  29,  18,  45,
  60,  49,  62,  55,  78,  96,  29,  22,  24,  13,
  14,  11,  11,  18,  12,  12,  30,  52,  52,  44,
  28,  28,  20,  56,  40,  31,  50,  40,  46,  42,
  29,  19,  36,  25,  22,  17,  19,  26,  30,  20,
  15,  21,  11,   8,   8,  19,   5,   8,   8,  11,
  11,   8,   3,   9,   5,   4,   7,   3,   6,   3,
   5,   4,   5,   6,
];

interface MuyassarResponse {
  success: boolean;
  data: {
    verse_key: string;
    tafsir: { text: string; author: string };
  };
}

interface TafsirRow {
  surah_number: number;
  verse_number: number;
  language_code: string;
  tafsir_text: string;
  author_name: string;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchVerse(surah: number, verse: number): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/surah/${surah}/ayah/${verse}`);
    if (!res.ok) { console.warn(`  [warn] HTTP ${res.status} ${surah}:${verse}`); return null; }
    const json = (await res.json()) as MuyassarResponse;
    return json?.data?.tafsir?.text?.trim() || null;
  } catch (err) {
    console.warn(`  [warn] fetch error ${surah}:${verse}: ${(err as Error).message}`);
    return null;
  }
}

async function flushBatch(batch: TafsirRow[]): Promise<{ inserted: number; errors: number }> {
  const { error, count } = await supabase
    .from('library_tafsir')
    .upsert(batch, {
      onConflict: 'surah_number,verse_number,language_code,author_name',
      ignoreDuplicates: true,
      count: 'exact',
    });
  if (error) {
    console.error(`  [error] upsert: ${error.message}`);
    return { inserted: 0, errors: batch.length };
  }
  return { inserted: count ?? batch.length, errors: 0 };
}

async function main() {
  const totalVerses = VERSE_COUNTS.reduce((a, b) => a + b, 0);
  console.log('=== Tafsir al-Muyassar (Arabic) import — ummahapi.com ===\n');
  console.log(`Author   : ${AUTHOR_NAME}`);
  console.log(`Language : ${LANGUAGE_CODE}`);
  console.log(`Verses   : ${totalVerses}\n`);

  const pending: TafsirRow[] = [];
  let fetched = 0, skipped = 0, totalInserted = 0, totalErrors = 0;

  for (let surah = 1; surah <= 114; surah++) {
    for (let verse = 1; verse <= VERSE_COUNTS[surah - 1]; verse++) {
      const text = await fetchVerse(surah, verse);
      await delay(DELAY_MS);

      if (!text) { skipped++; }
      else {
        fetched++;
        pending.push({ surah_number: surah, verse_number: verse, language_code: LANGUAGE_CODE, tafsir_text: text, author_name: AUTHOR_NAME });
      }

      const processed = fetched + skipped;
      if (processed % LOG_EVERY === 0) {
        console.log(`  [${processed}/${totalVerses}] ${surah}:${verse} — fetched: ${fetched}, skipped: ${skipped}, pending: ${pending.length}`);
      }

      if (pending.length >= BATCH_SIZE) {
        const batch = pending.splice(0, BATCH_SIZE);
        const { inserted, errors } = await flushBatch(batch);
        totalInserted += inserted; totalErrors += errors;
        console.log(`  Flushed batch — inserted: ${inserted}${errors ? `, errors: ${errors}` : ''}`);
      }
    }
  }

  if (pending.length > 0) {
    const { inserted, errors } = await flushBatch(pending);
    totalInserted += inserted; totalErrors += errors;
    console.log(`  Flushed final batch — inserted: ${inserted}${errors ? `, errors: ${errors}` : ''}`);
  }

  console.log(`\nDone.`);
  console.log(`  Fetched  : ${fetched}`);
  console.log(`  Skipped  : ${skipped}`);
  console.log(`  Inserted : ${totalInserted}`);
  if (totalErrors) console.log(`  Errors   : ${totalErrors}`);
}

main().catch((err) => { console.error('Fatal:', err.message); process.exit(1); });
