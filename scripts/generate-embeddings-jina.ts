/**
 * Generate Jina embeddings for library_quran_verses then library_hadiths.
 * Model: jina-embeddings-v3, 384-dim (matryoshka), task: retrieval.passage.
 * Skips rows that already have an embedding. Batch size: 100.
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

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JINA_API_KEY     = process.env.JINA_API_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing Supabase env'); process.exit(1); }
if (!JINA_API_KEY)                 { console.error('Missing JINA_API_KEY'); process.exit(1); }

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const JINA_URL     = 'https://api.jina.ai/v1/embeddings';
const BATCH        = 100;
const DELAY_MS     = 500;   // Jina is fast; 500ms between calls keeps us well under rate limits
const EMBED_DIM    = 384;
const MAX_TEXT     = 8000;

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

// ── Quran ──────────────────────────────────────────────────────────────────

async function runQuran() {
  console.log('\n=== Quran Verse Embeddings (jina-embeddings-v3, 384-dim) ===\n');

  // Load existing
  const embedded = new Set<string>();
  let page = 0;
  process.stdout.write('Loading existing quran embeddings');
  while (true) {
    const { data } = await sb.from('library_quran_embeddings')
      .select('surah_number, verse_number').range(page, page + 999);
    if (!data?.length) break;
    for (const r of data) embedded.add(`${r.surah_number}:${r.verse_number}`);
    page += data.length;
    process.stdout.write('.');
    if (data.length < 1000) break;
  }
  console.log(` ${embedded.size} already done.\n`);

  // Load todo
  interface Verse { surah_number: number; verse_number: number; english_text: string }
  const todo: Verse[] = [];
  page = 0;
  process.stdout.write('Loading quran verses');
  while (true) {
    const { data } = await sb.from('library_quran_verses')
      .select('surah_number, verse_number, english_text')
      .not('english_text', 'is', null).neq('english_text', '')
      .range(page, page + 999);
    if (!data?.length) break;
    for (const v of data)
      if (!embedded.has(`${v.surah_number}:${v.verse_number}`)) todo.push(v);
    page += data.length;
    process.stdout.write('.');
    if (data.length < 1000) break;
  }
  console.log(` ${todo.length} need embedding.\n`);
  if (!todo.length) { console.log('Quran: nothing to do.\n'); return; }

  let inserted = 0, failed = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const chunk = todo.slice(i, i + BATCH);
    let embeddings: number[][];
    try {
      embeddings = await batchEmbed(chunk.map(v => v.english_text));
    } catch (e) {
      console.error(`  [error] embed chunk ${i}: ${(e as Error).message}`);
      failed += chunk.length;
      await sleep(DELAY_MS);
      continue;
    }

    const rows = chunk.map((v, idx) => ({
      surah_number: v.surah_number,
      verse_number: v.verse_number,
      embedding: embeddings[idx],
    }));

    const { error } = await sb.from('library_quran_embeddings')
      .upsert(rows, { onConflict: 'surah_number,verse_number', ignoreDuplicates: true });

    if (error) {
      console.error(`  [error] upsert chunk ${i}: ${error.message}`);
      failed += chunk.length;
    } else {
      inserted += chunk.length;
    }

    const done = Math.min(i + BATCH, todo.length);
    if (done % 500 === 0 || done === todo.length)
      console.log(`  [${done}/${todo.length}] inserted: ${inserted}, failed: ${failed}`);

    await sleep(DELAY_MS);
  }

  const { count } = await sb.from('library_quran_embeddings').select('*', { count: 'exact', head: true });
  console.log(`\nQuran done — ${inserted} new, ${failed} failed. Total in DB: ${count} / 6236\n`);
}

// ── Hadiths ────────────────────────────────────────────────────────────────

async function runHadiths() {
  console.log('\n=== Hadith Embeddings (jina-embeddings-v3, 384-dim) ===\n');

  // Load existing into Set
  const embedded = new Set<string>();
  let page = 0;
  process.stdout.write('Loading existing hadith embeddings');
  while (true) {
    const { data } = await sb.from('library_hadith_embeddings')
      .select('collection_key, hadith_number').range(page, page + 999);
    if (!data?.length) break;
    for (const r of data) embedded.add(`${r.collection_key}:${r.hadith_number}`);
    page += data.length;
    process.stdout.write('.');
    if (data.length < 1000) break;
  }
  console.log(` ${embedded.size} already done.\n`);

  // Stream hadiths in chunks to avoid loading all 43k into memory
  interface Hadith { collection_key: string; hadith_number: number; english_text: string }
  let offset = 0;
  let totalInserted = 0, totalFailed = 0, batchNum = 0;
  const FETCH = 1000;

  while (true) {
    const { data } = await sb.from('library_hadiths')
      .select('collection_key, hadith_number, english_text')
      .not('english_text', 'is', null).neq('english_text', '')
      .order('collection_key').order('hadith_number')
      .range(offset, offset + FETCH - 1);

    if (!data?.length) break;

    const todo = (data as Hadith[]).filter(h => !embedded.has(`${h.collection_key}:${h.hadith_number}`));

    for (let i = 0; i < todo.length; i += BATCH) {
      const chunk = todo.slice(i, i + BATCH);
      if (!chunk.length) continue;

      let embeddings: number[][];
      try {
        embeddings = await batchEmbed(chunk.map(h => h.english_text));
      } catch (e) {
        console.error(`  [error] embed chunk offset=${offset} i=${i}: ${(e as Error).message}`);
        totalFailed += chunk.length;
        await sleep(DELAY_MS);
        continue;
      }

      const rows = chunk.map((h, idx) => ({
        collection_key: h.collection_key,
        hadith_number: h.hadith_number,
        embedding: embeddings[idx],
      }));

      const { error } = await sb.from('library_hadith_embeddings')
        .upsert(rows, { onConflict: 'collection_key,hadith_number', ignoreDuplicates: true });

      if (error) {
        console.error(`  [error] upsert: ${error.message}`);
        totalFailed += chunk.length;
      } else {
        totalInserted += chunk.length;
        for (const h of chunk) embedded.add(`${h.collection_key}:${h.hadith_number}`);
      }

      batchNum++;
      if (batchNum % 10 === 0)
        console.log(`  [batch ${batchNum}] total inserted: ${totalInserted}, failed: ${totalFailed}`);

      await sleep(DELAY_MS);
    }

    if (data.length < FETCH) break;
    offset += FETCH;
  }

  const { count } = await sb.from('library_hadith_embeddings').select('*', { count: 'exact', head: true });
  console.log(`\nHadiths done — ${totalInserted} new, ${totalFailed} failed. Total in DB: ${count} / 43577\n`);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('Jina Embedding Generator — jina-embeddings-v3, 384-dim, batch=100');
  console.log(`API key: ${JINA_API_KEY.slice(0, 12)}...\n`);
  await runQuran();
  await runHadiths();
  console.log('=== All done ===');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
