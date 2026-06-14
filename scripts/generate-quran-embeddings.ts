/**
 * Generate Gemini embeddings for all library_quran_verses rows.
 * Uses the same model and batch size as generate-embeddings.ts (hadith version).
 * Skips verses that already have an embedding.
 * Conflict resolution: ON CONFLICT (surah_number, verse_number) DO NOTHING.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

try {
  const buf = readFileSync(join(process.cwd(), '.env.local'));
  const raw = buf[0]===0xff&&buf[1]===0xfe ? buf.slice(2).toString('utf16le') : buf.toString('utf-8');
  for (const line of raw.split(/\r\n|\n/)) {
    const t = line.replace(/^﻿/,'').trim();
    if (!t||t.startsWith('#')) continue;
    const eq = t.indexOf('='); if (eq===-1) continue;
    const k=t.slice(0,eq).trim(), v=t.slice(eq+1).trim().replace(/^["']|["']$/g,'');
    if (!process.env[k]) process.env[k]=v;
  }
} catch {}

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_API_KEY    = process.env.GEMINI_API_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) { console.error('Missing Supabase env'); process.exit(1); }
if (!GEMINI_API_KEY) { console.error('Missing GEMINI_API_KEY'); process.exit(1); }

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {auth:{persistSession:false}});

const GEMINI_BATCH_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-embedding-001:batchEmbedContents?key=${GEMINI_API_KEY}`;
const EMBED_BATCH        = 20;
const DELAY_MS           = 1500;
const EMBEDDING_DIM      = 384;
const MAX_TEXT           = 6000;

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }

async function batchEmbed(texts: string[], retries = 4): Promise<number[][]> {
  const requests = texts.map(text => ({
    model: 'models/gemini-embedding-001',
    content: { parts: [{ text: text.slice(0, MAX_TEXT) }] },
    taskType: 'SEMANTIC_SIMILARITY',
    outputDimensionality: EMBEDDING_DIM,
  }));
  const res = await fetch(GEMINI_BATCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });
  if (res.status === 429 && retries > 0) {
    const body = await res.text();
    const m = body.match(/retry in ([\d.]+)s/i);
    const wait = m ? Math.ceil(parseFloat(m[1]) * 1000) + 1000 : 65_000;
    console.warn(`  [rate-limit] waiting ${(wait/1000).toFixed(0)}s (${retries} retries left)`);
    await sleep(wait);
    return batchEmbed(texts, retries - 1);
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err.slice(0, 200)}`);
  }
  const json = await res.json() as { embeddings: Array<{ values: number[] }> };
  return json.embeddings.map(e => e.values);
}

async function main() {
  console.log('=== TASK 2b — Quran Verse Embeddings (gemini-embedding-001, 384-dim) ===\n');

  // Load all existing embedded verses into a Set for fast lookup
  const embedded = new Set<string>();
  let ePage = 0;
  process.stdout.write('Loading existing embeddings');
  while (true) {
    const { data } = await sb.from('library_quran_embeddings').select('surah_number, verse_number').range(ePage, ePage+999);
    if (!data || data.length === 0) break;
    for (const r of data) embedded.add(`${r.surah_number}:${r.verse_number}`);
    ePage += data.length;
    process.stdout.write('.');
    if (data.length < 1000) break;
  }
  console.log(` ${embedded.size} already embedded.\n`);

  // Load all verses that need embedding
  interface Verse { surah_number: number; verse_number: number; english_text: string; }
  const todo: Verse[] = [];
  let vPage = 0;
  process.stdout.write('Loading quran verses');
  while (true) {
    const { data } = await sb.from('library_quran_verses')
      .select('surah_number, verse_number, english_text')
      .not('english_text', 'is', null)
      .neq('english_text', '')
      .range(vPage, vPage+999);
    if (!data || data.length === 0) break;
    for (const v of data) {
      if (!embedded.has(`${v.surah_number}:${v.verse_number}`)) todo.push(v);
    }
    vPage += data.length;
    process.stdout.write('.');
    if (data.length < 1000) break;
  }
  console.log(` ${todo.length} verses need embedding.\n`);

  if (todo.length === 0) { console.log('Nothing to do.'); return; }

  const estMin = Math.ceil((todo.length / EMBED_BATCH) * DELAY_MS / 60_000);
  console.log(`Estimated time: ~${estMin} minutes (${EMBED_BATCH} verses/call, ${DELAY_MS}ms delay)\n`);

  let totalInserted = 0, totalFailed = 0;

  for (let i = 0; i < todo.length; i += EMBED_BATCH) {
    const chunk = todo.slice(i, i + EMBED_BATCH);

    let embeddings: number[][];
    try {
      embeddings = await batchEmbed(chunk.map(v => v.english_text));
    } catch (e) {
      console.error(`  [error] embed chunk ${i}: ${(e as Error).message}`);
      totalFailed += chunk.length;
      await sleep(DELAY_MS);
      continue;
    }

    const rows = chunk.map((v, idx) => ({
      surah_number: v.surah_number,
      verse_number: v.verse_number,
      embedding:    embeddings[idx],
    }));

    const { error } = await sb.from('library_quran_embeddings')
      .upsert(rows, { onConflict: 'surah_number,verse_number', ignoreDuplicates: true });

    if (error) {
      console.error(`  [error] upsert chunk ${i}: ${error.message}`);
      totalFailed += chunk.length;
    } else {
      totalInserted += chunk.length;
    }

    const done = Math.min(i + EMBED_BATCH, todo.length);
    if (done % 200 === 0 || done === todo.length) {
      console.log(`  [${done}/${todo.length}] embedded: ${totalInserted}, failed: ${totalFailed}`);
    }

    await sleep(DELAY_MS);
  }

  const { count } = await sb.from('library_quran_embeddings').select('*',{count:'exact',head:true});
  console.log(`\nResult: ${totalInserted} new embeddings inserted, ${totalFailed} failed.`);
  console.log(`Total library_quran_embeddings: ${count} / 6,236`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
