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

const BASE = 'https://hadeethenc.com/api/v1';
const DELAY_MS = 150;
const PER_PAGE = 100;
const FLUSH_EVERY = 50;

interface Category {
  id: string;
  title: string;
  hadeeths_count: string;
  parent_id: string | null;
}

interface HadithListItem {
  id: string;
  title: string;
}

interface HadithListResponse {
  data: HadithListItem[];
  meta: { current_page: string; last_page: number; total_items: string; per_page: string };
}

interface HadithDetail {
  id: string;
  hadeeth: string;
  reference?: string;
  grade?: string;
}

interface Row {
  hadith_number: number;
  arabic_text: string;
  english_text: string;
  turkish_text: string;
  urdu_text: string;
  french_text: string;
  bengali_text: string;
  grade: string | null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text === '""') return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// Parse Riyad al-Salihin hadith number from the Arabic reference field.
// Handles two formats observed in hadeethenc.com:
//   "رياض الصالحين (1/ 100) (1234)."   → 1234
//   "رياض الصالحين (1234)."             → 1234
function parseRiyadHadithNumber(ref: string): number | null {
  if (!ref || !ref.includes('رياض الصالحين')) return null;
  const firstLine = ref.split('\n')[0].trim();

  const fmt1 = firstLine.match(/رياض الصالحين\s*\(\d+\/\s*\d+\)\s*\((\d+)\)/);
  if (fmt1) return parseInt(fmt1[1], 10);

  const fmt2 = firstLine.match(/رياض الصالحين\s*\((\d+)\)/);
  if (fmt2) return parseInt(fmt2[1], 10);

  return null;
}

async function collectAllHadithIds(): Promise<string[]> {
  const ids: string[] = [];

  const rootCats = await fetchJson<Category[]>(`${BASE}/categories/roots/?language=en`);
  if (!rootCats) throw new Error('Could not fetch root categories');
  await delay(DELAY_MS);

  console.log(`  Found ${rootCats.length} root categories — paging through all...`);

  for (const root of rootCats) {
    let page = 1;
    while (true) {
      const data = await fetchJson<HadithListResponse>(
        `${BASE}/hadeeths/list/?language=en&category_id=${root.id}&page=${page}&per_page=${PER_PAGE}`,
      );
      await delay(DELAY_MS);
      if (!data?.data?.length) break;
      for (const h of data.data) ids.push(h.id);
      if (page >= (data.meta?.last_page ?? 1)) break;
      page++;
    }
  }

  // Deduplicate — a hadith can appear in multiple categories
  return [...new Set(ids)];
}

async function flush(pending: Row[]): Promise<void> {
  if (pending.length === 0) return;
  const batch = pending.splice(0, pending.length);

  // Deduplicate by hadith_number — last write wins
  const seen = new Map<number, Row>();
  for (const row of batch) seen.set(row.hadith_number, row);
  const deduped = Array.from(seen.values());

  const { error } = await supabase
    .from('library_riyad_salihin')
    .upsert(deduped, { onConflict: 'hadith_number', ignoreDuplicates: false });

  if (error) console.error(`  [upsert error] ${error.message}`);
}

async function main(): Promise<void> {
  console.log('=== Riyad al-Salihin import — hadeethenc.com ===\n');

  // Step 1: Collect all IDs
  console.log('Step 1: Collecting all hadith IDs...');
  const allIds = await collectAllHadithIds();
  console.log(`  ${allIds.size ?? allIds.length} unique IDs collected.\n`);

  // Step 2: For each ID, fetch Arabic to check if it belongs to Riyad al-Salihin.
  //         If yes, immediately fetch all 5 translations in parallel.
  console.log('Step 2: Identifying Riyad al-Salihin hadiths and fetching translations...');

  const pending: Row[] = [];
  let processed = 0;
  let matched = 0;
  let upserted = 0;

  for (const id of allIds) {
    processed++;

    const ar = await fetchJson<HadithDetail>(`${BASE}/hadeeths/one/?language=ar&id=${id}`);
    await delay(DELAY_MS);

    const hadithNumber = parseRiyadHadithNumber(ar?.reference ?? '');
    if (!hadithNumber) continue;

    // Fetch all translations in parallel
    const [en, tr, ur, fr, bn] = await Promise.all([
      fetchJson<HadithDetail>(`${BASE}/hadeeths/one/?language=en&id=${id}`),
      fetchJson<HadithDetail>(`${BASE}/hadeeths/one/?language=tr&id=${id}`),
      fetchJson<HadithDetail>(`${BASE}/hadeeths/one/?language=ur&id=${id}`),
      fetchJson<HadithDetail>(`${BASE}/hadeeths/one/?language=fr&id=${id}`),
      fetchJson<HadithDetail>(`${BASE}/hadeeths/one/?language=bn&id=${id}`),
    ]);
    await delay(DELAY_MS);

    matched++;
    pending.push({
      hadith_number: hadithNumber,
      arabic_text:  ar?.hadeeth?.trim()  ?? '',
      english_text: en?.hadeeth?.trim()  ?? '',
      turkish_text: tr?.hadeeth?.trim()  ?? '',
      urdu_text:    ur?.hadeeth?.trim()  ?? '',
      french_text:  fr?.hadeeth?.trim()  ?? '',
      bengali_text: bn?.hadeeth?.trim()  ?? '',
      grade:        en?.grade?.trim()    ?? ar?.grade?.trim() ?? null,
    });

    if (pending.length >= FLUSH_EVERY) {
      await flush(pending);
      upserted += FLUSH_EVERY;
      console.log(
        `  [${processed}/${allIds.length}] matched: ${matched}, upserted: ${upserted}`,
      );
    }
  }

  // Final flush
  const remaining = pending.length;
  await flush(pending);
  upserted += remaining;

  console.log(`\nDone.`);
  console.log(`  IDs scanned  : ${processed}`);
  console.log(`  Riyad matched: ${matched}`);
  console.log(`  Rows upserted: ${upserted}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
