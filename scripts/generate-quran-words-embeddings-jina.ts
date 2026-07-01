/**
 * Generate Jina embeddings for library_quran_words (word-by-word translation_en).
 * Model: jina-embeddings-v3, 384-dim (matryoshka), task: retrieval.passage.
 * Skips words that already have an embedding. Batch size: 100.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

try {
  const buf = readFileSync(join(process.cwd(), '.env.local'));
  const raw = buf[0] === 0xff && buf[1] === 0xfe
    ? buf.slice(2).toString('utf16le')
    : buf.toString('utf-8');
  for (const line of raw.split(/\r\n|\n/)) {
    const t = line.replace(/^﻿/, '').trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
} catch {}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JINA_API_KEY = process.env.JINA_API_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing Supabase env'); process.exit(1); }
if (!JINA_API_KEY)                 { console.error('Missing JINA_API_KEY'); process.exit(1); }

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const JINA_URL  = 'https://api.jina.ai/v1/embeddings';
const BATCH     = 100;
const DELAY_MS  = 500;
const EMBED_DIM = 384;
const MAX_TEXT  = 8000;
const FETCH     = 1000;
const TOTAL_WORDS = 77_430;

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

async function batchEmbed(texts: string[], retries = 4): Promise<number[][]> {
  const res = await fetch(JINA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${JINA_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'jina-embeddings-v3',
      input: texts.map(t => t.slice(0, MAX_TEXT)),
      task: 'retrieval.passage',
      dimensions: EMBED_DIM,
    }),
  });

  if (res.status === 429 && retries > 0) {
    const wait = 65_000;
    console.warn(`  [rate-limit] 429 — waiting ${wait / 1000}s (${retries} retries left)`);
    await sleep(wait);
    return batchEmbed(texts, retries - 1);
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Jina ${res.status}: ${err.slice(0, 200)}`);
  }

  const json = await res.json() as { data: Array<{ embedding: number[] }> };
  return json.data.map(d => d.embedding);
}

interface Word {
  surah_number: number;
  verse_number: number;
  word_position: number;
  translation_en: string;
}

async function main() {
  console.log('=== Quran Word Embeddings (jina-embeddings-v3, 384-dim) ===\n');

  // Load existing keys into a Set
  const embedded = new Set<string>();
  let page = 0;
  process.stdout.write('Loading existing word embeddings');
  while (true) {
    const { data, error } = await sb.from('library_quran_words_embeddings')
      .select('surah_number, verse_number, word_position')
      .range(page, page + 999);
    if (error) { console.error(`\n[error] ${error.message}`); process.exit(1); }
    if (!data?.length) break;
    for (const r of data) embedded.add(`${r.surah_number}:${r.verse_number}:${r.word_position}`);
    page += data.length;
    process.stdout.write('.');
    if (data.length < 1000) break;
  }
  console.log(` ${embedded.size} already embedded.\n`);

  let offset = 0;
  let totalInserted = 0, totalFailed = 0, totalSeen = 0, batchNum = 0;

  while (true) {
    const { data, error } = await sb.from('library_quran_words')
      .select('surah_number, verse_number, word_position, translation_en')
      .not('translation_en', 'is', null).neq('translation_en', '')
      .order('surah_number').order('verse_number').order('word_position')
      .range(offset, offset + FETCH - 1);

    if (error) { console.error(`\n[error] fetch: ${error.message}`); process.exit(1); }
    if (!data?.length) break;

    totalSeen += data.length;
    const todo = (data as Word[]).filter(
      w => !embedded.has(`${w.surah_number}:${w.verse_number}:${w.word_position}`)
    );

    for (let i = 0; i < todo.length; i += BATCH) {
      const chunk = todo.slice(i, i + BATCH);
      if (!chunk.length) continue;

      let embeddings: number[][];
      try {
        embeddings = await batchEmbed(chunk.map(w => w.translation_en));
      } catch (e) {
        console.error(`  [error] embed chunk offset=${offset} i=${i}: ${(e as Error).message}`);
        totalFailed += chunk.length;
        await sleep(DELAY_MS);
        continue;
      }

      const rows = chunk.map((w, idx) => ({
        surah_number: w.surah_number,
        verse_number: w.verse_number,
        word_position: w.word_position,
        embedding: embeddings[idx],
      }));

      const { error: upsertError } = await sb.from('library_quran_words_embeddings')
        .upsert(rows, { onConflict: 'surah_number,verse_number,word_position', ignoreDuplicates: true });

      if (upsertError) {
        console.error(`  [error] upsert: ${upsertError.message}`);
        totalFailed += chunk.length;
      } else {
        totalInserted += chunk.length;
        for (const w of chunk) embedded.add(`${w.surah_number}:${w.verse_number}:${w.word_position}`);
      }

      batchNum++;
      if (batchNum % 5 === 0 || i + BATCH >= todo.length) {
        console.log(`  [seen ${totalSeen}] inserted: ${totalInserted}, failed: ${totalFailed}`);
      }

      await sleep(DELAY_MS);
    }

    if (data.length < FETCH) break;
    offset += FETCH;
  }

  const { count } = await sb.from('library_quran_words_embeddings')
    .select('*', { count: 'exact', head: true });

  console.log(`\n=== Done — ${totalInserted} new, ${totalFailed} failed ===`);
  console.log(`Total library_quran_words_embeddings: ${count} / ${TOTAL_WORDS}`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
