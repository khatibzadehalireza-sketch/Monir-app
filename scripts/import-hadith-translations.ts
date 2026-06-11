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

const CDN_BASE = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions';
const DELAY_MS = 300;
const BATCH_SIZE = 500;

const COLLECTIONS = [
  'bukhari',
  'muslim',
  'abudawud',
  'ibnmajah',
  'tirmidhi',
  'nasai',
  'malik',
  'nawawi40',
] as const;

type Collection = (typeof COLLECTIONS)[number];

// nawawi40 uses filename 'nawawi' in the API
const API_NAME_MAP: Partial<Record<Collection, string>> = {
  nawawi40: 'nawawi',
};

const LANGUAGES = [
  { edition: 'tur-vakfi',      language_code: 'tr' },
  { edition: 'urd-nasai',      language_code: 'ur' },
  { edition: 'fra-monteil',    language_code: 'fr' },
  { edition: 'ben-muhiuddin',  language_code: 'bn' },
] as const;

interface HadithEntry {
  hadithnumber: number | string;
  text: string;
}

interface CollectionResponse {
  hadiths: HadithEntry[];
}

interface TranslationRow {
  hadith_id: number;
  language_code: string;
  translation_text: string;
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
    console.warn(`  [warn] fetch failed: ${(err as Error).message}`);
    return null;
  }
}

// Build a map of "collection_key:hadith_number" → id for all relevant collections.
async function loadHadithIdMap(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const PAGE = 1000;
  let offset = 0;

  console.log('Loading hadith IDs from library_hadiths...');

  while (true) {
    const { data, error } = await supabase
      .from('library_hadiths')
      .select('id, collection_key, hadith_number')
      .in('collection_key', [...COLLECTIONS])
      .range(offset, offset + PAGE - 1);

    if (error) throw new Error(`Failed to load hadiths: ${error.message}`);
    if (!data?.length) break;

    for (const row of data) {
      map.set(`${row.collection_key}:${row.hadith_number}`, row.id);
    }

    console.log(`  Loaded ${map.size} hadiths so far (offset ${offset})...`);

    if (data.length < PAGE) break;
    offset += PAGE;
  }

  console.log(`  Total hadith IDs loaded: ${map.size}\n`);
  return map;
}

async function importEdition(
  edition: string,
  language_code: string,
  collection: Collection,
  idMap: Map<string, number>,
): Promise<void> {
  const apiName = API_NAME_MAP[collection] ?? collection;
  const url = `${CDN_BASE}/${edition}-${apiName}.json`;
  console.log(`  Fetching ${url} ...`);

  const data = await fetchJson<CollectionResponse>(url);

  if (!data?.hadiths?.length) {
    console.warn(`  [warn] No hadiths returned, skipping.`);
    return;
  }

  const rows: TranslationRow[] = [];
  let skipped = 0;

  for (const h of data.hadiths) {
    const num = Number(h.hadithnumber);
    if (!Number.isInteger(num)) {
      skipped++;
      continue;
    }
    const text = h.text?.trim();
    if (!text) {
      skipped++;
      continue;
    }
    const hadith_id = idMap.get(`${collection}:${num}`);
    if (hadith_id === undefined) {
      skipped++;
      continue;
    }
    rows.push({ hadith_id, language_code, translation_text: text });
  }

  console.log(
    `  ${rows.length} rows to upsert (skipped ${skipped} — no match or empty text)`,
  );

  let upserted = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error, count } = await supabase
      .from('library_hadith_translations')
      .upsert(batch, {
        onConflict: 'hadith_id,language_code',
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
    `  [${edition}-${collection}] Complete — upserted: ${upserted}` +
      (errors ? `, errors: ${errors}` : ''),
  );
}

async function main(): Promise<void> {
  console.log('=== Hadith translations import (fawazahmed0/hadith-api) ===\n');
  console.log(`Collections : ${COLLECTIONS.join(', ')}`);
  console.log(`Languages   : ${LANGUAGES.map((l) => `${l.edition} (${l.language_code})`).join(', ')}`);
  console.log(`Table       : library_hadith_translations\n`);

  const idMap = await loadHadithIdMap();

  const total = LANGUAGES.length * COLLECTIONS.length;
  let requestIndex = 0;

  for (const lang of LANGUAGES) {
    console.log(`${'='.repeat(60)}`);
    console.log(`Language: ${lang.edition} (${lang.language_code})`);

    for (const collection of COLLECTIONS) {
      requestIndex++;
      console.log(`\n[${requestIndex}/${total}] ${lang.edition} — ${collection}`);
      await importEdition(lang.edition, lang.language_code, collection, idMap);

      if (requestIndex < total) {
        console.log(`  Waiting ${DELAY_MS}ms...\n`);
        await delay(DELAY_MS);
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('All editions imported.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
