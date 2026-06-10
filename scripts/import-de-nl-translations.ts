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
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BASE = 'https://hadeethenc.com/api/v1';
const DELAY_MS = 150;
const PER_PAGE = 100;

// Arabic book name → our collection_key
const ARABIC_TO_COLLECTION: Record<string, string> = {
  'صحيح البخاري': 'bukhari',
  'صحيح مسلم': 'muslim',
  'سنن أبي داود': 'abudawud',
  'سنن ابن ماجه': 'ibnmajah',
  'جامع الترمذي': 'tirmidhi',
  'سنن الترمذي': 'tirmidhi',
  'السنن الصغرى': 'nasai',
  'سنن النسائي': 'nasai',
  'موطأ مالك': 'malik',
  'الأربعون النووية': 'nawawi40',
  'مسند أحمد': 'ahmad',
  'رياض الصالحين': 'riyadussalihin',
  'بلوغ المرام': 'bulugh',
};

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
  translations?: string[];
}

function delay(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
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

// Parse the Arabic reference field to extract collection + hadith number.
// Format: "صحيح البخاري (6/ 192) (5027).\n..."
function parseReference(ref: string): { collectionKey: string; hadithNumber: number } | null {
  if (!ref) return null;
  const firstLine = ref.split('\n')[0].trim().replace(/\.$/, '');
  // Match: {book name} (vol/ page) (hadith_number)
  const match = firstLine.match(/^(.+?)\s*\(\d+\/\s*\d+\)\s*\((\d+)\)/);
  if (!match) return null;
  const bookName = match[1].trim();
  const hadithNumber = parseInt(match[2], 10);
  const collectionKey = ARABIC_TO_COLLECTION[bookName];
  if (!collectionKey || isNaN(hadithNumber)) return null;
  return { collectionKey, hadithNumber };
}

// Collect all hadith IDs using only the 7 root categories.
// The list endpoint returns hadiths for the full category tree under each root,
// so there's no need to enumerate sub-categories.
async function collectAllHadithIds(): Promise<Set<string>> {
  const ids = new Set<string>();

  const rootCats = await fetchJson<Category[]>(`${BASE}/categories/roots/?language=en`);
  if (!rootCats) throw new Error('Could not fetch root categories');
  await delay(DELAY_MS);

  console.log(`  Paging through ${rootCats.length} root categories...`);

  for (const root of rootCats) {
    let page = 1;
    while (true) {
      const data = await fetchJson<HadithListResponse>(
        `${BASE}/hadeeths/list/?language=en&category_id=${root.id}&page=${page}&per_page=${PER_PAGE}`,
      );
      await delay(DELAY_MS);
      if (!data?.data?.length) break;
      for (const h of data.data) ids.add(h.id);
      if (page >= (data.meta?.last_page ?? 1)) break;
      page++;
    }
    console.log(`  Category ${root.id} done — running total: ${ids.size} IDs`);
  }

  return ids;
}

interface UpsertRow {
  collection_key: string;
  hadith_number: number;
  german_text?: string;
  dutch_text?: string;
}

async function main(): Promise<void> {
  console.log('=== hadeethenc.com → German & Dutch import ===\n');

  console.log('Step 1: Collecting all hadith IDs...');
  const allIds = await collectAllHadithIds();
  console.log(`  Found ${allIds.size} unique hadith IDs.\n`);

  console.log('Step 2: Fetching Arabic references + DE/NL translations...');

  let processed = 0;
  let matched = 0;
  let unmatched = 0;
  let noTranslation = 0;

  const rows: UpsertRow[] = [];
  const FLUSH_EVERY = 50;

  async function flush(): Promise<void> {
    if (rows.length === 0) return;
    const batch = rows.splice(0, rows.length);
    // Deduplicate by collection_key+hadith_number — last write wins.
    // Required because multiple hadeethenc IDs can resolve to the same row,
    // and PostgreSQL rejects ON CONFLICT DO UPDATE when the same row appears twice.
    const seen = new Map<string, UpsertRow>();
    for (const row of batch) {
      seen.set(`${row.collection_key}:${row.hadith_number}`, row);
    }
    const deduped = Array.from(seen.values());
    const { error } = await supabase
      .from('library_hadiths')
      .upsert(deduped, {
        onConflict: 'collection_key,hadith_number',
        ignoreDuplicates: false,
      });
    if (error) console.error(`  [upsert error] ${error.message}`);
    else console.log(`  Flushed ${deduped.length} rows (total matched: ${matched})`);
  }

  for (const id of allIds) {
    processed++;

    // Fetch Arabic (for reference) + German + Dutch all in parallel
    const [ar, de, nl] = await Promise.all([
      fetchJson<HadithDetail>(`${BASE}/hadeeths/one/?language=ar&id=${id}`),
      fetchJson<HadithDetail>(`${BASE}/hadeeths/one/?language=de&id=${id}`),
      fetchJson<HadithDetail>(`${BASE}/hadeeths/one/?language=nl&id=${id}`),
    ]);
    await delay(DELAY_MS);

    const parsed = parseReference(ar?.reference ?? '');
    if (!parsed) {
      unmatched++;
      continue;
    }

    const germanText = de?.hadeeth?.trim() || null;
    const dutchText = nl?.hadeeth?.trim() || null;

    if (!germanText && !dutchText) {
      noTranslation++;
      continue;
    }

    matched++;
    const row: UpsertRow = {
      collection_key: parsed.collectionKey,
      hadith_number: parsed.hadithNumber,
    };
    if (germanText) row.german_text = germanText;
    if (dutchText) row.dutch_text = dutchText;
    rows.push(row);

    if (rows.length >= FLUSH_EVERY) await flush();

    if (processed % 100 === 0) {
      console.log(
        `  Progress: ${processed}/${allIds.size} processed ` +
          `| matched: ${matched} | unmatched: ${unmatched} | no-translation: ${noTranslation}`,
      );
    }
  }

  await flush();

  console.log(`\nDone.`);
  console.log(`  Total IDs processed : ${processed}`);
  console.log(`  Matched to our DB   : ${matched}`);
  console.log(`  Unmatched (unknown source): ${unmatched}`);
  console.log(`  No DE/NL translation: ${noTranslation}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
