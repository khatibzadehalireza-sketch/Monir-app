/**
 * Import word-by-word Quran data from api.qurancdn.com into library_quran_words.
 * Fields: arabic_text (text_uthmani), transliteration, translation_en, audio_url.
 * Skips verse-end markers (char_type_name === 'end').
 * Uses ON CONFLICT DO NOTHING on (surah_number, verse_number, word_position).
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

const BASE       = 'https://api.qurancdn.com/api/qdc/verses/by_chapter';
const AUDIO_BASE = 'https://audio.qurancdn.com/';
const PER_PAGE   = 50;
const DELAY_MS   = 400;
const BATCH_SIZE = 500;

interface ApiWord {
  position:       number;
  char_type_name: string;
  text_uthmani:   string;
  audio_url:      string | null;
  transliteration: { text: string } | null;
  translation:     { text: string } | null;
}

interface ApiVerse {
  verse_key: string;
  words:     ApiWord[];
}

interface ApiResponse {
  verses: ApiVerse[];
}

interface WordRow {
  surah_number:   number;
  verse_number:   number;
  word_position:  number;
  arabic_text:    string;
  transliteration: string;
  translation_en: string;
  audio_url:      string;
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

async function fetchPage(surah: number, page: number): Promise<ApiVerse[]> {
  const url = `${BASE}/${surah}?words=true&word_fields=text_uthmani,transliteration&per_page=${PER_PAGE}&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} surah=${surah} page=${page}`);
  const json = await res.json() as ApiResponse;
  return json.verses ?? [];
}

async function fetchAllVerses(surah: number): Promise<ApiVerse[]> {
  const all: ApiVerse[] = [];
  let page = 1;
  while (true) {
    const verses = await fetchPage(surah, page);
    all.push(...verses);
    if (verses.length < PER_PAGE) break;
    page++;
    await sleep(150);
  }
  return all;
}

async function upsertBatch(rows: WordRow[]): Promise<number> {
  const { error, count } = await sb
    .from('library_quran_words')
    .upsert(rows, {
      onConflict: 'surah_number,verse_number,word_position',
      ignoreDuplicates: true,
      count: 'exact',
    });
  if (error) { console.error(`  [error] upsert: ${error.message}`); return 0; }
  return count ?? 0;
}

async function main() {
  console.log('=== Quran Word-by-Word Import — api.qurancdn.com ===\n');

  const { count: before } = await sb
    .from('library_quran_words')
    .select('*', { count: 'exact', head: true });
  console.log(`Rows before: ${before ?? 0}\n`);

  const pending: WordRow[] = [];
  let totalWords = 0, totalInserted = 0, totalSkipped = 0;

  for (let surah = 1; surah <= 114; surah++) {
    let verses: ApiVerse[];
    try {
      verses = await fetchAllVerses(surah);
    } catch (err) {
      console.error(`  [error] surah ${surah}: ${(err as Error).message}`);
      await sleep(DELAY_MS * 3);
      continue;
    }

    let surahWords = 0;
    for (const verse of verses) {
      const parts = verse.verse_key?.split(':');
      if (parts?.length !== 2) continue;
      const verseNum = parseInt(parts[1], 10);
      if (isNaN(verseNum)) continue;

      for (const word of verse.words ?? []) {
        if (word.char_type_name === 'end') continue;

        const audio = word.audio_url ? `${AUDIO_BASE}${word.audio_url}` : '';
        pending.push({
          surah_number:    surah,
          verse_number:    verseNum,
          word_position:   word.position,
          arabic_text:     word.text_uthmani ?? '',
          transliteration: word.transliteration?.text ?? '',
          translation_en:  word.translation?.text ?? '',
          audio_url:       audio,
        });
        surahWords++;
        totalWords++;
      }
    }

    process.stdout.write(
      `\r  Surah ${String(surah).padStart(3)}/114  verses=${String(verses.length).padStart(3)}  words=${String(surahWords).padStart(4)}  total=${String(totalWords).padStart(6)}  inserted=${String(totalInserted).padStart(6)}`
    );

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
  process.stdout.write('\n\n');

  const { count: after } = await sb
    .from('library_quran_words')
    .select('*', { count: 'exact', head: true });

  totalSkipped = (before ?? 0) > 0 ? totalWords - totalInserted : 0;

  console.log('── Result ───────────────────────────────────────────────');
  console.log(`  Words extracted  : ${totalWords}`);
  console.log(`  Rows inserted    : ${totalInserted}`);
  console.log(`  Rows skipped     : ${totalSkipped} (already existed)`);
  console.log(`  DB before/after  : ${before ?? 0} → ${after ?? 0}`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
