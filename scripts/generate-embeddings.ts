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
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!GEMINI_API_KEY) {
  console.error('Missing GEMINI_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// gemini-embedding-001 via v1 REST API (text-embedding-004 is unavailable on this key).
// batchEmbedContents sends up to EMBED_BATCH texts per API call — 20× fewer quota hits.
const GEMINI_BATCH_URL =
  `https://generativelanguage.googleapis.com/v1/models/gemini-embedding-001:batchEmbedContents?key=${GEMINI_API_KEY}`;

const FETCH_BATCH_SIZE = 100;   // hadiths fetched from Supabase per loop iteration
const EMBED_BATCH = 20;         // texts per batchEmbedContents call (max ~100, 20 is safe)
// Free tier: ~100 API calls/min. At EMBED_BATCH=20, that's 2000 embeddings/min.
// 1500ms between API calls stays well under the RPM limit.
const DELAY_BETWEEN_API_CALLS_MS = 1500;
const DELAY_BETWEEN_FETCH_BATCHES_MS = 2000;
const EMBEDDING_DIMENSIONS = 384;
const MAX_TEXT_LENGTH = 6000;   // ~2048 token limit; 6000 chars is safely within it

interface Hadith {
  collection_key: string;
  hadith_number: number;
  english_text: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function batchEmbed(texts: string[], retries = 4): Promise<number[][]> {
  const requests = texts.map((text) => ({
    model: 'models/gemini-embedding-001',
    content: { parts: [{ text: text.slice(0, MAX_TEXT_LENGTH) }] },
    taskType: 'SEMANTIC_SIMILARITY',
    outputDimensionality: EMBEDDING_DIMENSIONS,
  }));

  const res = await fetch(GEMINI_BATCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });

  if (res.status === 429 && retries > 0) {
    const errBody = await res.text();
    const match = errBody.match(/retry in ([\d.]+)s/i);
    const waitMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 1000 : 65_000;
    console.warn(`  [rate-limit] 429 — waiting ${(waitMs / 1000).toFixed(0)}s (${retries} retries left)`);
    await delay(waitMs);
    return batchEmbed(texts, retries - 1);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini batch embed error ${res.status}: ${err.slice(0, 200)}`);
  }

  const json = (await res.json()) as { embeddings: Array<{ values: number[] }> };
  return json.embeddings.map((e) => e.values);
}

async function fetchUnembeddedBatch(offset: number): Promise<Hadith[]> {
  const { data: hadiths, error: hErr } = await supabase
    .from('library_hadiths')
    .select('collection_key, hadith_number, english_text')
    .not('english_text', 'is', null)
    .neq('english_text', '')
    .order('collection_key')
    .order('hadith_number')
    .range(offset, offset + FETCH_BATCH_SIZE * 3 - 1);

  if (hErr) throw new Error(`Hadiths query failed: ${hErr.message}`);
  if (!hadiths?.length) return [];

  const collectionKeys = [...new Set(hadiths.map((h) => h.collection_key))];
  const { data: existing, error: eErr } = await supabase
    .from('library_hadith_embeddings')
    .select('collection_key, hadith_number')
    .in('collection_key', collectionKeys);

  if (eErr) throw new Error(`Embeddings query failed: ${eErr.message}`);

  const done = new Set((existing ?? []).map((r) => `${r.collection_key}:${r.hadith_number}`));

  return hadiths
    .filter((h) => !done.has(`${h.collection_key}:${h.hadith_number}`))
    .slice(0, FETCH_BATCH_SIZE);
}

async function processBatch(hadiths: Hadith[]): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  // Split into mini-batches of EMBED_BATCH for the API call
  for (let i = 0; i < hadiths.length; i += EMBED_BATCH) {
    const chunk = hadiths.slice(i, i + EMBED_BATCH);

    let embeddings: number[][];
    try {
      embeddings = await batchEmbed(chunk.map((h) => h.english_text));
    } catch (err) {
      console.error(`  [error] batch embed failed (chunk ${i}–${i + chunk.length}): ${(err as Error).message}`);
      failed += chunk.length;
      await delay(DELAY_BETWEEN_API_CALLS_MS);
      continue;
    }

    const rows = chunk.map((h, idx) => ({
      collection_key: h.collection_key,
      hadith_number: h.hadith_number,
      embedding: embeddings[idx],
    }));

    const { error } = await supabase
      .from('library_hadith_embeddings')
      .upsert(rows, { onConflict: 'collection_key,hadith_number' });

    if (error) {
      console.error(`  [error] upsert failed (chunk ${i}–${i + chunk.length}): ${error.message}`);
      failed += chunk.length;
    } else {
      console.log(`  [ok] ${i + chunk.length}/${hadiths.length} embedded`);
      success += chunk.length;
    }

    await delay(DELAY_BETWEEN_API_CALLS_MS);
  }

  return { success, failed };
}

async function main(): Promise<void> {
  console.log('Generating hadith embeddings — Gemini gemini-embedding-001 (384-dim, batch mode)');
  console.log(`Fetch batch: ${FETCH_BATCH_SIZE} hadiths | API batch: ${EMBED_BATCH} texts/call | Delay: ${DELAY_BETWEEN_API_CALLS_MS}ms\n`);

  let offset = 0;
  let totalSuccess = 0;
  let totalFailed = 0;
  let batchNum = 0;

  while (true) {
    const hadiths = await fetchUnembeddedBatch(offset);

    if (!hadiths.length) {
      console.log('\nNo more hadiths without embeddings.');
      break;
    }

    batchNum++;
    console.log(`Batch ${batchNum}: ${hadiths.length} hadiths (offset ${offset})...`);

    const { success, failed } = await processBatch(hadiths);
    totalSuccess += success;
    totalFailed += failed;

    console.log(
      `Batch ${batchNum} done — embedded: ${success}, failed: ${failed}` +
        ` | total: ${totalSuccess} embedded, ${totalFailed} failed`,
    );

    if (hadiths.length < FETCH_BATCH_SIZE) break;

    offset += FETCH_BATCH_SIZE;
    await delay(DELAY_BETWEEN_FETCH_BATCHES_MS);
  }

  console.log(`\nDone — total embedded: ${totalSuccess}, total failed: ${totalFailed}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
