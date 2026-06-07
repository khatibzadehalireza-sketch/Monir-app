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

// The user-specified paths (e.g. /db/by_book/musnad_ahmad.json) do not exist in the repo.
// Actual paths discovered from the AhmedBaset/hadith-json@v1.2.0 git tree:
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/AhmedBaset/hadith-json@v1.2.0';

const COLLECTIONS: Array<{ collectionKey: string; url: string }> = [
  {
    collectionKey: 'ahmad',
    url: `${CDN_BASE}/db/by_book/the_9_books/ahmed.json`,
  },
  {
    collectionKey: 'riyadussalihin',
    url: `${CDN_BASE}/db/by_book/other_books/riyad_assalihin.json`,
  },
  {
    collectionKey: 'bulugh',
    url: `${CDN_BASE}/db/by_book/other_books/bulugh_almaram.json`,
  },
];

const DELAY_MS = 100;

interface HadithEntry {
  id: number;
  idInBook: number;
  arabic: string;
  english: {
    narrator: string;
    text: string;
  };
}

interface CollectionFile {
  hadiths: HadithEntry[];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

function buildEnglishText(entry: HadithEntry): string {
  const narrator = entry.english.narrator.trim();
  const text = entry.english.text.trim();
  if (!narrator) return text;
  return `${narrator} ${text}`;
}

async function importCollection(collectionKey: string, url: string): Promise<void> {
  console.log(`\n[${collectionKey}] Fetching from ${url}...`);
  const data = await fetchJson<CollectionFile>(url);
  await delay(DELAY_MS);

  if (!data?.hadiths?.length) {
    console.warn(`[${collectionKey}] No hadiths found, skipping.`);
    return;
  }

  const total = data.hadiths.length;
  console.log(`[${collectionKey}] Importing ${total} hadiths...`);

  let inserted = 0;
  let skipped = 0;
  const CHUNK = 200;

  for (let i = 0; i < data.hadiths.length; i += CHUNK) {
    const chunk = data.hadiths.slice(i, i + CHUNK);

    // idInBook is the sequential per-collection hadith number (1, 2, 3…)
    // matching the convention used by import-hadiths.ts
    const rows = chunk.map((h) => ({
      collection_key: collectionKey,
      hadith_number: h.idInBook,
      arabic_text: h.arabic ?? '',
      english_text: buildEnglishText(h),
      grade: null,
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
        `  [${collectionKey}] ${Math.min(i + CHUNK, total)}/${total} processed` +
          ` (new: ${inserted}, skipped: ${skipped})`,
      );
    }

    await delay(DELAY_MS);
  }

  console.log(
    `[${collectionKey}] Done — inserted: ${inserted}, already existed: ${skipped}`,
  );
}

async function main(): Promise<void> {
  console.log('Starting missing hadith import...');
  console.log(`Collections: ${COLLECTIONS.map((c) => c.collectionKey).join(', ')}\n`);

  for (const { collectionKey, url } of COLLECTIONS) {
    await importCollection(collectionKey, url);
  }

  console.log('\nImport complete.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
