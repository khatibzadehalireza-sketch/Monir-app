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
  // rely on environment variables already set
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Languages to import and their corresponding DB column names
const LANGUAGES: Array<{ apiCode: string; column: string }> = [
  { apiCode: 'tur', column: 'turkish_text' },
  { apiCode: 'urd', column: 'urdu_text' },
  { apiCode: 'fra', column: 'french_text' },
  { apiCode: 'ben', column: 'bengali_text' },
];

// Collections in our DB and their API filename (where different)
const COLLECTIONS: Array<{ collectionKey: string; apiName?: string }> = [
  { collectionKey: 'bukhari' },
  { collectionKey: 'muslim' },
  { collectionKey: 'abudawud' },
  { collectionKey: 'ibnmajah' },
  { collectionKey: 'tirmidhi' },
  { collectionKey: 'nasai' },
  { collectionKey: 'malik' },
  { collectionKey: 'nawawi40', apiName: 'nawawi' },
];

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions';
const GH_RAW_BASE = 'https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions';
const DELAY_MS = 150;
const CHUNK = 200;

interface HadithEntry {
  hadithnumber: number | string;
  text: string;
}

interface CollectionResponse {
  hadiths: HadithEntry[];
}

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
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
    console.warn(`  [warn] fetch error: ${(err as Error).message}`);
    return null;
  }
}

async function fetchEdition(apiCode: string, apiName: string): Promise<CollectionResponse | null> {
  const cdnUrl = `${CDN_BASE}/${apiCode}-${apiName}.json`;
  const data = await fetchJson<CollectionResponse>(cdnUrl);
  await delay(DELAY_MS);
  if (data) return data;

  console.log(`  Retrying via GitHub raw...`);
  const rawUrl = `${GH_RAW_BASE}/${apiCode}-${apiName}.json`;
  const fallback = await fetchJson<CollectionResponse>(rawUrl);
  await delay(DELAY_MS);
  return fallback;
}

async function importLanguageForCollection(
  apiCode: string,
  column: string,
  collectionKey: string,
  apiName: string,
): Promise<void> {
  const data = await fetchEdition(apiCode, apiName);

  if (!data?.hadiths?.length) {
    console.log(`  [${apiCode}/${collectionKey}] No data — skipping.`);
    return;
  }

  // Filter out sub-hadiths with decimal numbers
  const hadiths = data.hadiths.filter((h) => Number.isInteger(Number(h.hadithnumber)));
  const total = hadiths.length;
  console.log(`  [${apiCode}/${collectionKey}] ${total} hadiths — updating...`);

  let updated = 0;
  let errors = 0;

  for (let i = 0; i < hadiths.length; i += CHUNK) {
    const chunk = hadiths.slice(i, i + CHUNK);

    // Build rows for upsert — only collection_key, hadith_number, and the translation column.
    // The unique constraint on (collection_key, hadith_number) means this acts as an UPDATE
    // for existing rows, touching only the translation column.
    const rows = chunk.map((h) => ({
      collection_key: collectionKey,
      hadith_number: Number(h.hadithnumber),
      [column]: h.text ?? '',
    }));

    const { error, count } = await supabase
      .from('library_hadiths')
      .upsert(rows, {
        onConflict: 'collection_key,hadith_number',
        ignoreDuplicates: false,
        count: 'exact',
      });

    if (error) {
      console.error(`  [error] chunk ${i}–${i + chunk.length}: ${error.message}`);
      errors += chunk.length;
    } else {
      updated += count ?? chunk.length;
      console.log(
        `  [${apiCode}/${collectionKey}] ${Math.min(i + CHUNK, total)}/${total} done`,
      );
    }

    await delay(DELAY_MS);
  }

  console.log(
    `  [${apiCode}/${collectionKey}] Complete — updated: ${updated}` +
      (errors ? `, errors: ${errors}` : ''),
  );
}

async function main(): Promise<void> {
  console.log('Starting translation import...\n');
  console.log(`Languages : ${LANGUAGES.map((l) => l.apiCode).join(', ')}`);
  console.log(`Collections: ${COLLECTIONS.map((c) => c.collectionKey).join(', ')}\n`);

  for (const { apiCode, column } of LANGUAGES) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Language: ${apiCode.toUpperCase()} → column: ${column}`);
    console.log('='.repeat(60));

    for (const { collectionKey, apiName } of COLLECTIONS) {
      await importLanguageForCollection(apiCode, column, collectionKey, apiName ?? collectionKey);
    }
  }

  console.log('\nAll translations imported.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
