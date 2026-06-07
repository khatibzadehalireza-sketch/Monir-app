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
} catch {
  // .env.local not present — rely on environment variables already set
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY as fallback)',
  );
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '[warn] SUPABASE_SERVICE_ROLE_KEY not set — falling back to anon key. RLS policies may block writes.\n',
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// fawazahmed0/quran-api stores all data in Git LFS; its CDN URLs are inaccessible via HTTP.
// alquran.cloud is a reliable, key-free alternative with identical verse content.
// Arabic: Uthmani script (standard). English: Saheeh International (closest freely available
// equivalent to the Quran Academy translation requested via eng-quranacademy.json).
const ARABIC_EDITION = 'quran-uthmani';
const ENGLISH_EDITION = 'en.sahih';
const API_BASE = 'https://api.alquran.cloud/v1';
const DELAY_MS = 100;

interface Ayah {
  number: number;
  numberInSurah: number;
  text: string;
}

interface Surah {
  number: number;
  ayahs: Ayah[];
}

interface QuranResponse {
  code: number;
  status: string;
  data: { surahs: Surah[] };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchEdition(edition: string): Promise<Surah[]> {
  console.log(`Fetching edition: ${edition}...`);
  const res = await fetch(`${API_BASE}/quran/${edition}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} for edition ${edition}`);
  const json = (await res.json()) as QuranResponse;
  if (json.code !== 200) throw new Error(`API error: ${json.status}`);
  await delay(DELAY_MS);
  return json.data.surahs;
}

async function main(): Promise<void> {
  console.log('Starting Quran import...\n');

  const [arabicSurahs, englishSurahs] = await Promise.all([
    fetchEdition(ARABIC_EDITION),
    fetchEdition(ENGLISH_EDITION),
  ]);

  // Build lookup: surahNum → verseNum → english text
  const engMap = new Map<string, string>();
  for (const surah of englishSurahs) {
    for (const ayah of surah.ayahs) {
      engMap.set(`${surah.number}:${ayah.numberInSurah}`, ayah.text);
    }
  }

  // Flatten all verses
  const allVerses = arabicSurahs.flatMap((surah) =>
    surah.ayahs.map((ayah) => ({
      surah_number: surah.number,
      verse_number: ayah.numberInSurah,
      arabic_text: ayah.text,
      english_text: engMap.get(`${surah.number}:${ayah.numberInSurah}`) ?? '',
    })),
  );

  console.log(`Total verses to import: ${allVerses.length}\n`);

  let inserted = 0;
  let skipped = 0;
  const CHUNK = 200;

  for (let i = 0; i < allVerses.length; i += CHUNK) {
    const chunk = allVerses.slice(i, i + CHUNK);

    const { error, count } = await supabase
      .from('library_quran_verses')
      .upsert(chunk, {
        onConflict: 'surah_number,verse_number',
        ignoreDuplicates: true,
        count: 'exact',
      });

    if (error) {
      console.error(
        `[error] upsert failed at chunk ${i}–${i + chunk.length}: ${error.message}`,
      );
    } else {
      const upserted = count ?? 0;
      inserted += upserted;
      skipped += chunk.length - upserted;
      console.log(
        `${Math.min(i + CHUNK, allVerses.length)}/${allVerses.length} processed` +
          ` (new: ${inserted}, skipped: ${skipped})`,
      );
    }

    await delay(DELAY_MS);
  }

  console.log(`\nDone — inserted: ${inserted}, already existed: ${skipped}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
