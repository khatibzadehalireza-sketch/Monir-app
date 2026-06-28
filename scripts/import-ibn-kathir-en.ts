/**
 * Import Ibn Kathir English tafsir from api.quran.com (tafsir ID 169).
 * Uses by_chapter endpoint — 114 API calls instead of 6,236.
 * Strips HTML from text field. Skips verses already in DB (ignoreDuplicates).
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

const BASE        = 'https://api.quran.com/api/v4/tafsirs/169/by_chapter';
const AUTHOR      = 'Ibn Kathir';
const LANG        = 'en';
const DELAY_MS    = 800;
const BATCH_SIZE  = 200;

interface TafsirItem { verse_key: string; text: string }
interface ApiResponse { tafsirs: TafsirItem[] }

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

async function fetchSurah(surah: number): Promise<TafsirItem[]> {
  const res = await fetch(`${BASE}/${surah}?per_page=300`);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching surah ${surah}`);
  const json = await res.json() as ApiResponse;
  return json.tafsirs ?? [];
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
  console.log('=== Ibn Kathir English Tafsir — api.quran.com (ID 169) ===\n');
  console.log(`Author   : ${AUTHOR}`);
  console.log(`Language : ${LANG}`);
  console.log(`Strategy : fetch by chapter (114 calls), skip existing rows\n`);

  // Check starting count
  const { count: before } = await sb
    .from('library_tafsir')
    .select('*', { count: 'exact', head: true })
    .eq('author_name', AUTHOR).eq('language_code', LANG);
  console.log(`Existing Ibn Kathir EN rows: ${before ?? 0} / 6,236\n`);

  const pending: TafsirRow[] = [];
  let fetched = 0, skipped = 0, inserted = 0;

  for (let surah = 1; surah <= 114; surah++) {
    let items: TafsirItem[];
    try {
      items = await fetchSurah(surah);
    } catch (err) {
      console.error(`  [error] surah ${surah}: ${(err as Error).message}`);
      await sleep(DELAY_MS * 2);
      continue;
    }

    for (const item of items) {
      const parts = item.verse_key?.split(':');
      const verseNum = parts?.length === 2 ? parseInt(parts[1], 10) : NaN;
      const text = item.text ? stripHtml(item.text) : '';

      if (!verseNum || !text) { skipped++; continue; }

      fetched++;
      pending.push({ surah_number: surah, verse_number: verseNum, language_code: LANG, author_name: AUTHOR, tafsir_text: text });
    }

    console.log(`  Surah ${String(surah).padStart(3)} → ${items.length} verses (pending: ${pending.length})`);

    if (pending.length >= BATCH_SIZE) {
      const batch = pending.splice(0, BATCH_SIZE);
      inserted += await upsertBatch(batch);
    }

    if (surah < 114) await sleep(DELAY_MS);
  }

  // Final flush
  if (pending.length > 0) {
    inserted += await upsertBatch(pending);
  }

  const { count: after } = await sb
    .from('library_tafsir')
    .select('*', { count: 'exact', head: true })
    .eq('author_name', AUTHOR).eq('language_code', LANG);

  console.log(`\n── Result ───────────────────────────────`);
  console.log(`  Verses fetched : ${fetched}`);
  console.log(`  Verses skipped : ${skipped} (no text)`);
  console.log(`  Rows inserted  : ${inserted}`);
  console.log(`  DB before      : ${before ?? 0}`);
  console.log(`  DB after       : ${after ?? 0}`);
  console.log(`  Net added      : ${(after ?? 0) - (before ?? 0)}`);
  console.log(`  Coverage       : ${after ?? 0} / 6,236 (${(((after ?? 0) / 6236) * 100).toFixed(1)}%)`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
