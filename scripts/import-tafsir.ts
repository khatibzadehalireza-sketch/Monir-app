import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local — handles both UTF-8 and UTF-16 LE (Windows default)
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BASE = 'https://ummahapi.com/api/tafsir/ibn_kathir';
const DELAY_MS = 200;
const BATCH_SIZE = 500;
const LOG_EVERY = 100;
const AUTHOR_NAME = 'Ibn Kathir';
const LANGUAGE_CODE = 'en';

// Verse counts per surah (1–114)
const VERSE_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
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

interface TafsirResponse {
  success: boolean;
  data: {
    verse_key: string;
    tafsir: {
      text: string;
      author: string;
    };
  };
}

interface TafsirRow {
  surah_number: number;
  verse_number: number;
  language_code: string;
  tafsir_text: string;
  author_name: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  [warn] HTTP ${res.status} — ${url}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`  [warn] fetch failed: ${(err as Error).message}`);
    return null;
  }
}

async function flushBatch(batch: TafsirRow[]): Promise<{ upserted: number; errors: number }> {
  const { error, count } = await supabase
    .from('library_tafsir')
    .upsert(batch, {
      onConflict: 'surah_number,verse_number,language_code',
      ignoreDuplicates: false,
      count: 'exact',
    });

  if (error) {
    console.error(`  [error] upsert: ${error.message}`);
    return { upserted: 0, errors: batch.length };
  }
  return { upserted: count ?? batch.length, errors: 0 };
}

async function main(): Promise<void> {
  const totalVerses = VERSE_COUNTS.reduce((a, b) => a + b, 0);

  console.log('=== Ibn Kathir Tafsir import (UmmahAPI) ===\n');
  console.log(`Table       : library_tafsir`);
  console.log(`Author      : ${AUTHOR_NAME}`);
  console.log(`Language    : ${LANGUAGE_CODE}`);
  console.log(`Total verses: ${totalVerses}\n`);

  const pending: TafsirRow[] = [];
  let fetched = 0;
  let skipped = 0;
  let totalUpserted = 0;
  let totalErrors = 0;

  for (let surah = 1; surah <= 114; surah++) {
    const verseCount = VERSE_COUNTS[surah - 1];

    for (let verse = 1; verse <= verseCount; verse++) {
      const url = `${BASE}/surah/${surah}/ayah/${verse}`;
      const data = await fetchJson<TafsirResponse>(url);
      await delay(DELAY_MS);

      const text = data?.data?.tafsir?.text?.trim();
      if (!text) {
        skipped++;
      } else {
        fetched++;
        pending.push({
          surah_number: surah,
          verse_number: verse,
          language_code: LANGUAGE_CODE,
          tafsir_text: text,
          author_name: AUTHOR_NAME,
        });
      }

      const processed = fetched + skipped;

      if (processed % LOG_EVERY === 0) {
        console.log(
          `  [${processed}/${totalVerses}] surah ${surah}:${verse} — fetched: ${fetched}, skipped: ${skipped}, pending: ${pending.length}`,
        );
      }

      if (pending.length >= BATCH_SIZE) {
        const batch = pending.splice(0, BATCH_SIZE);
        const { upserted, errors } = await flushBatch(batch);
        totalUpserted += upserted;
        totalErrors += errors;
        console.log(`  Flushed batch — upserted: ${upserted}${errors ? `, errors: ${errors}` : ''}`);
      }
    }
  }

  // Final flush
  if (pending.length > 0) {
    const { upserted, errors } = await flushBatch(pending);
    totalUpserted += upserted;
    totalErrors += errors;
    console.log(`  Flushed final batch — upserted: ${upserted}${errors ? `, errors: ${errors}` : ''}`);
  }

  console.log(`\nDone.`);
  console.log(`  Fetched  : ${fetched}`);
  console.log(`  Skipped  : ${skipped}`);
  console.log(`  Upserted : ${totalUpserted}`);
  if (totalErrors) console.log(`  Errors   : ${totalErrors}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
