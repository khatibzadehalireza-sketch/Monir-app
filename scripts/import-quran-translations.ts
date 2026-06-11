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

const EDITIONS = [
  { identifier: 'en.sahih',      language: 'en', translator: 'Sahih International' },
  { identifier: 'tr.diyanet',    language: 'tr', translator: 'Diyanet İşleri' },
  { identifier: 'ur.ahmedali',   language: 'ur', translator: 'Ahmed Ali' },
  { identifier: 'fr.hamidullah', language: 'fr', translator: 'Muhammad Hamidullah' },
  { identifier: 'de.aburida',    language: 'de', translator: 'Abu Rida' },
  { identifier: 'bn.bengali',    language: 'bn', translator: 'Bengali' },
];

const ALQURAN_BASE = 'https://api.alquran.cloud/v1';
const EDITION_DELAY_MS = 500;
const BATCH_SIZE = 500;

interface Ayah {
  numberInSurah: number;
  text: string;
}

interface Surah {
  number: number;
  ayahs: Ayah[];
}

interface QuranApiResponse {
  code: number;
  data: {
    surahs: Surah[];
  };
}

interface TranslationRow {
  surah_number: number;
  verse_number: number;
  language: string;
  translated_text: string;
  translated_by: string;
  is_verified: boolean;
}

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

async function importEdition(edition: (typeof EDITIONS)[0]): Promise<void> {
  const url = `${ALQURAN_BASE}/quran/${edition.identifier}`;
  console.log(`  Fetching ${url} ...`);

  let data: QuranApiResponse;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  [error] HTTP ${res.status}`);
      return;
    }
    data = (await res.json()) as QuranApiResponse;
  } catch (err) {
    console.error(`  [error] fetch failed: ${(err as Error).message}`);
    return;
  }

  if (data.code !== 200 || !data.data?.surahs?.length) {
    console.error(`  [error] unexpected response (code=${data.code})`);
    return;
  }

  const rows: TranslationRow[] = [];
  for (const surah of data.data.surahs) {
    for (const ayah of surah.ayahs) {
      const text = ayah.text?.trim();
      if (!text) continue;
      rows.push({
        surah_number: surah.number,
        verse_number: ayah.numberInSurah,
        language: edition.language,
        translated_text: text,
        translated_by: edition.translator,
        is_verified: true,
      });
    }
  }

  console.log(`  ${rows.length} ayahs — upserting in batches of ${BATCH_SIZE}...`);

  let upserted = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error, count } = await supabase
      .from('library_quran_translations')
      .upsert(batch, {
        onConflict: 'surah_number,verse_number,language',
        ignoreDuplicates: false,
        count: 'exact',
      });

    if (error) {
      console.error(`  [error] batch ${i}–${i + batch.length}: ${error.message}`);
      errors += batch.length;
    } else {
      upserted += count ?? batch.length;
      console.log(`  ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} rows done`);
    }
  }

  console.log(
    `  [${edition.identifier}] Complete — upserted: ${upserted}` +
      (errors ? `, errors: ${errors}` : ''),
  );
}

async function main(): Promise<void> {
  console.log('=== Quran translations import (api.alquran.cloud) ===\n');
  console.log(`Editions : ${EDITIONS.map((e) => e.identifier).join(', ')}`);
  console.log(`Table    : library_quran_translations\n`);

  for (let i = 0; i < EDITIONS.length; i++) {
    const edition = EDITIONS[i];
    console.log(`${'='.repeat(60)}`);
    console.log(`[${i + 1}/${EDITIONS.length}] ${edition.identifier} (${edition.language}) — ${edition.translator}`);
    await importEdition(edition);
    if (i < EDITIONS.length - 1) {
      console.log(`  Waiting ${EDITION_DELAY_MS}ms...\n`);
      await delay(EDITION_DELAY_MS);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('All editions imported.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
