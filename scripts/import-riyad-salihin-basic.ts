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

// Source: AhmedBaset/hadith-json — 1896 hadiths, Arabic + English only
// Turkish/Urdu are not available in this dataset.
const CDN_URL =
  'https://cdn.jsdelivr.net/gh/AhmedBaset/hadith-json@main/db/by_book/other_books/riyad_assalihin.json';
const RAW_URL =
  'https://raw.githubusercontent.com/AhmedBaset/hadith-json/main/db/by_book/other_books/riyad_assalihin.json';

const COLLECTION_KEY = 'riyadussalihin';
const BATCH_SIZE = 200;
const DELAY_MS = 300;

interface HadithEntry {
  idInBook: number;
  arabic: string;
  english: {
    narrator: string;
    text: string;
  };
}

interface BookResponse {
  hadiths: HadithEntry[];
}

interface HadithRow {
  collection_key: string;
  hadith_number: number;
  arabic_text: string;
  english_text: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  [warn] HTTP ${res.status} for ${url}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`  [warn] fetch failed: ${(err as Error).message}`);
    return null;
  }
}

async function main(): Promise<void> {
  console.log('=== Riyad al-Salihin basic import → library_hadiths ===\n');
  console.log(`Collection  : ${COLLECTION_KEY}`);
  console.log(`Source      : AhmedBaset/hadith-json (Arabic + English)`);
  console.log(`Note        : Turkish/Urdu not available in this dataset\n`);

  console.log('Fetching Riyad al-Salihin JSON...');
  let data = await fetchJson<BookResponse>(CDN_URL);

  if (!data?.hadiths?.length) {
    console.log('  CDN failed, retrying via GitHub raw...');
    data = await fetchJson<BookResponse>(RAW_URL);
  }

  if (!data?.hadiths?.length) {
    console.error('Failed to fetch Riyad al-Salihin data from both sources.');
    process.exit(1);
  }

  console.log(`  ${data.hadiths.length} hadiths fetched.\n`);

  const rows: HadithRow[] = [];
  let skipped = 0;

  for (const h of data.hadiths) {
    if (!h.idInBook || !h.arabic?.trim()) { skipped++; continue; }
    const narrator = h.english?.narrator?.trim() ?? '';
    const text = h.english?.text?.trim() ?? '';
    const english_text = narrator ? `${narrator}\n${text}` : text;
    rows.push({
      collection_key: COLLECTION_KEY,
      hadith_number: h.idInBook,
      arabic_text: h.arabic.trim(),
      english_text,
    });
  }

  console.log(`Building rows: ${rows.length} valid, ${skipped} skipped.\n`);
  console.log(`Upserting into library_hadiths in batches of ${BATCH_SIZE}...`);

  let upserted = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error, count } = await supabase
      .from('library_hadiths')
      .upsert(batch, {
        onConflict: 'collection_key,hadith_number',
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

    if (i + BATCH_SIZE < rows.length) await delay(DELAY_MS);
  }

  console.log(`\nDone.`);
  console.log(`  Upserted : ${upserted}`);
  if (errors) console.log(`  Errors   : ${errors}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
