import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local — handles both UTF-8 and UTF-16 LE (Windows default)
try {
  const buf = readFileSync(join(process.cwd(), '.env.local'));
  // Detect UTF-16 LE BOM (FF FE)
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

const COLLECTIONS = [
  'bukhari',
  'muslim',
  'abudawud',
  'ibnmajah',
  'tirmidhi',
  'nasai',
  'malik',
  // 'ahmad', 'riyadussalihin', 'bulugh' — not available in fawazahmed0/hadith-api
  'nawawi40', // fetches from eng-nawawi.json via API_NAME_MAP
];

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions';
// Fallback for files too large for jsDelivr (>50 MB)
const GH_RAW_BASE = 'https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions';
const DELAY_MS = 100;

// Map from our collection_key → actual filename used by the API
const API_NAME_MAP: Record<string, string> = {
  nawawi40: 'nawawi',
};

interface HadithEntry {
  hadithnumber: number | string;
  text: string;
  grades?: Array<{ grade: string; graded_by?: string }>;
}

interface CollectionResponse {
  hadiths: HadithEntry[];
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
    console.warn(`  [warn] fetch failed for ${url}: ${(err as Error).message}`);
    return null;
  }
}

async function fetchEdition(lang: string, collection: string): Promise<CollectionResponse | null> {
  const apiName = API_NAME_MAP[collection] ?? collection;
  const cdnUrl = `${CDN_BASE}/${lang}-${apiName}.json`;
  const data = await fetchJson<CollectionResponse>(cdnUrl);
  await delay(DELAY_MS);
  if (data) return data;

  // jsDelivr may 403 large files — fall back to GitHub raw
  console.log(`  [${collection}] Retrying via GitHub raw for ${lang}...`);
  const rawUrl = `${GH_RAW_BASE}/${lang}-${apiName}.json`;
  const fallback = await fetchJson<CollectionResponse>(rawUrl);
  await delay(DELAY_MS);
  return fallback;
}

async function importCollection(collection: string): Promise<void> {
  console.log(`\n[${collection}] Fetching English edition...`);
  const engData = await fetchEdition('eng', collection);

  if (!engData?.hadiths?.length) {
    console.warn(`[${collection}] No hadiths found in English edition, skipping.`);
    return;
  }

  console.log(`[${collection}] Fetching Arabic edition...`);
  const araData = await fetchEdition('ara', collection);

  // Build a map from hadith number → Arabic text for O(1) lookup
  const arabicMap = new Map<string, string>();
  if (araData?.hadiths) {
    for (const h of araData.hadiths) {
      arabicMap.set(String(h.hadithnumber), h.text ?? '');
    }
  }

  // Filter out sub-hadiths with decimal numbers (e.g. 402.2) — integer column can't store them
  let subHadithCount = 0;
  const mainHadiths = engData.hadiths.filter((h) => {
    const n = Number(h.hadithnumber);
    if (!Number.isInteger(n)) {
      subHadithCount++;
      return false;
    }
    return true;
  });

  if (subHadithCount > 0) {
    console.log(`[${collection}] Skipping ${subHadithCount} sub-hadiths with decimal numbers.`);
  }

  const total = mainHadiths.length;
  console.log(`[${collection}] Importing ${total} hadiths...`);

  let inserted = 0;
  let skipped = 0;

  // Batch upserts in chunks of 200 to avoid request-size limits
  const CHUNK = 200;
  for (let i = 0; i < mainHadiths.length; i += CHUNK) {
    const chunk = mainHadiths.slice(i, i + CHUNK);

    const rows = chunk.map((h) => ({
      collection_key: collection,
      hadith_number: Number(h.hadithnumber),
      english_text: h.text ?? '',
      arabic_text: arabicMap.get(String(h.hadithnumber)) ?? '',
      grade: h.grades?.[0]?.grade ?? null,
    }));

    const { error, count } = await supabase
      .from('library_hadiths')
      .upsert(rows, {
        onConflict: 'collection_key,hadith_number',
        ignoreDuplicates: true,
        count: 'exact',
      });

    if (error) {
      console.error(
        `  [error] upsert failed at chunk ${i}–${i + chunk.length}: ${error.message}`,
      );
    } else {
      const upserted = count ?? 0;
      inserted += upserted;
      skipped += chunk.length - upserted;
      console.log(
        `  [${collection}] ${Math.min(i + CHUNK, total)}/${total} processed` +
          ` (new: ${inserted}, skipped: ${skipped})`,
      );
    }

    await delay(DELAY_MS);
  }

  console.log(
    `[${collection}] Done — inserted: ${inserted}, already existed: ${skipped}`,
  );
}

async function main(): Promise<void> {
  console.log('Starting hadith import...');
  console.log(`Collections: ${COLLECTIONS.join(', ')}\n`);

  for (const collection of COLLECTIONS) {
    await importCollection(collection);
  }

  console.log('\nImport complete.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
