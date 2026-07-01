/**
 * Import Ibn Kathir English tafsir from api.qurancdn.com (tafsir ID 169).
 * Strategy: fetch grouped tafsir blocks per chapter, then expand each block
 * to cover every verse in its range (start → next block start − 1).
 * This fills the 4,341 verse-level gaps left by the quran.com API import
 * which only stored the lead verse of each group.
 * Uses ON CONFLICT DO NOTHING — existing rows are never overwritten.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

try {
  const buf = readFileSync(join(process.cwd(), '.env.local'));
  const raw = buf[0] === 0xff && buf[1] === 0xfe
    ? buf.slice(2).toString('utf16le')
    : buf.toString('utf-8');
  for (const line of raw.split(/\r?\n/)) {
    const t = line.replace(/^﻿/, '').trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
} catch {}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const BASE       = 'https://api.qurancdn.com/api/qdc/tafsirs/169/by_chapter';
const AUTHOR     = 'Ibn Kathir';
const LANG       = 'en';
const DELAY_MS   = 600;
const BATCH_SIZE = 300;

const VERSE_COUNTS = [
   7, 286, 200, 176, 120, 165, 206,  75, 129, 109,
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

interface TafsirItem { verse_key: string; text: string }
interface ApiResponse {
  tafsirs: TafsirItem[];
  pagination: { total_pages: number; current_page: number };
}

interface TafsirRow {
  surah_number: number;
  verse_number: number;
  language_code: string;
  author_name: string;
  tafsir_text: string;
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchAllPages(surah: number): Promise<TafsirItem[]> {
  const all: TafsirItem[] = [];
  let page = 1;
  while (true) {
    const url = `${BASE}/${surah}?per_page=300&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} surah ${surah} page ${page}`);
    const json = await res.json() as ApiResponse;
    all.push(...(json.tafsirs ?? []));
    if (page >= (json.pagination?.total_pages ?? 1)) break;
    page++;
    await sleep(200);
  }
  return all;
}

async function upsertBatch(rows: TafsirRow[]): Promise<number> {
  const { error, count } = await sb
    .from('library_tafsir')
    .upsert(rows, {
      onConflict: 'surah_number,verse_number,language_code,author_name',
      ignoreDuplicates: true,
      count: 'exact',
    });
  if (error) { console.error(`  [error] upsert: ${error.message}`); return 0; }
  return count ?? 0;
}

async function main() {
  console.log('=== Ibn Kathir EN Tafsir — api.qurancdn.com (ID 169) — Verse Expansion ===\n');

  const { count: before } = await sb
    .from('library_tafsir')
    .select('*', { count: 'exact', head: true })
    .eq('author_name', AUTHOR).eq('language_code', LANG);
  console.log(`Before: ${before ?? 0} Ibn Kathir EN rows in DB\n`);

  const pending: TafsirRow[] = [];
  let totalBlocks = 0, totalExpanded = 0, totalInserted = 0;

  for (let surah = 1; surah <= 114; surah++) {
    const verseCount = VERSE_COUNTS[surah - 1];
    let items: TafsirItem[];
    try {
      items = await fetchAllPages(surah);
    } catch (err) {
      console.error(`  [error] surah ${surah}: ${(err as Error).message}`);
      await sleep(DELAY_MS * 3);
      continue;
    }

    // Sort by verse number (they should already be ordered, but be safe)
    const parsed = items
      .map(item => {
        const parts = item.verse_key?.split(':');
        const vNum = parts?.length === 2 ? parseInt(parts[1], 10) : NaN;
        const text = item.text ? stripHtml(item.text) : '';
        return { vNum, text };
      })
      .filter(x => !isNaN(x.vNum) && x.text)
      .sort((a, b) => a.vNum - b.vNum);

    totalBlocks += parsed.length;

    // Expand each block to every verse in its range
    for (let i = 0; i < parsed.length; i++) {
      const startV = parsed[i].vNum;
      const endV   = i + 1 < parsed.length ? parsed[i + 1].vNum - 1 : verseCount;
      for (let v = startV; v <= endV; v++) {
        pending.push({
          surah_number:  surah,
          verse_number:  v,
          language_code: LANG,
          author_name:   AUTHOR,
          tafsir_text:   parsed[i].text,
        });
        totalExpanded++;
      }
    }

    console.log(`  Surah ${String(surah).padStart(3)} (${verseCount} verses): ${parsed.length} blocks → ${totalExpanded - (totalExpanded - (pending.length > BATCH_SIZE ? 0 : 0))} pending`);

    // Flush when buffer is large enough
    while (pending.length >= BATCH_SIZE) {
      const batch = pending.splice(0, BATCH_SIZE);
      totalInserted += await upsertBatch(batch);
    }

    if (surah < 114) await sleep(DELAY_MS);
  }

  // Final flush
  if (pending.length > 0) {
    totalInserted += await upsertBatch(pending);
  }

  const { count: after } = await sb
    .from('library_tafsir')
    .select('*', { count: 'exact', head: true })
    .eq('author_name', AUTHOR).eq('language_code', LANG);

  console.log('\n── Result ───────────────────────────────────────────────');
  console.log(`  Tafsir blocks fetched  : ${totalBlocks}`);
  console.log(`  Verse rows expanded to : ${totalExpanded}`);
  console.log(`  Rows inserted (new)    : ${totalInserted}`);
  console.log(`  DB before              : ${before ?? 0}`);
  console.log(`  DB after               : ${after ?? 0}`);
  console.log(`  Net added              : ${(after ?? 0) - (before ?? 0)}`);
  console.log(`  Coverage               : ${after ?? 0} / 6,236 (${(((after ?? 0) / 6236) * 100).toFixed(1)}%)`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
