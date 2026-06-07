import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai';
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

// Same model and dimensions used by the chat route for consistency
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

const BATCH_SIZE = 100;
const DELAY_BETWEEN_REQUESTS_MS = 50; // stay well within Gemini free-tier limit (1500 rpm)
const DELAY_BETWEEN_BATCHES_MS = 1000;
const EMBEDDING_DIMENSIONS = 384;
// Gemini text-embedding-004 has a ~2048-token limit; truncate to ~6000 chars to be safe
const MAX_TEXT_LENGTH = 6000;

interface Hadith {
  collection_key: string;
  hadith_number: number;
  english_text: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function embedText(text: string): Promise<number[]> {
  const truncated = text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
  const result = await embeddingModel.embedContent({
    content: { role: 'user', parts: [{ text: truncated }] },
    taskType: TaskType.SEMANTIC_SIMILARITY,
    outputDimensionality: EMBEDDING_DIMENSIONS,
  } as import('@google/generative-ai').EmbedContentRequest & { outputDimensionality: number });
  return result.embedding.values;
}

async function fetchUntranslatedBatch(offset: number): Promise<Hadith[]> {
  // Fetch hadiths with english_text
  const { data: hadiths, error: hErr } = await supabase
    .from('library_hadiths')
    .select('collection_key, hadith_number, english_text')
    .not('english_text', 'is', null)
    .neq('english_text', '')
    .order('collection_key')
    .order('hadith_number')
    .range(offset, offset + BATCH_SIZE * 3 - 1); // fetch extra to account for already embedded

  if (hErr) throw new Error(`Hadiths query failed: ${hErr.message}`);
  if (!hadiths?.length) return [];

  // Get embedding status for this page's collections
  const collectionKeys = [...new Set(hadiths.map((h) => h.collection_key))];
  const { data: existing, error: eErr } = await supabase
    .from('library_hadith_embeddings')
    .select('collection_key, hadith_number')
    .in('collection_key', collectionKeys);

  if (eErr) throw new Error(`Embeddings query failed: ${eErr.message}`);

  const done = new Set(
    (existing ?? []).map((r) => `${r.collection_key}:${r.hadith_number}`),
  );

  return hadiths
    .filter((h) => !done.has(`${h.collection_key}:${h.hadith_number}`))
    .slice(0, BATCH_SIZE);
}

async function processBatch(hadiths: Hadith[]): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const hadith of hadiths) {
    try {
      const embedding = await embedText(hadith.english_text);

      const { error } = await supabase.from('library_hadith_embeddings').upsert(
        {
          collection_key: hadith.collection_key,
          hadith_number: hadith.hadith_number,
          embedding,
        },
        { onConflict: 'collection_key,hadith_number' },
      );

      if (error) {
        console.error(
          `  [error] ${hadith.collection_key}:${hadith.hadith_number} — ${error.message}`,
        );
        failed++;
      } else {
        success++;
      }
    } catch (err) {
      console.error(
        `  [error] ${hadith.collection_key}:${hadith.hadith_number} — ${(err as Error).message}`,
      );
      failed++;
    }

    await delay(DELAY_BETWEEN_REQUESTS_MS);
  }

  return { success, failed };
}

async function main(): Promise<void> {
  console.log('Generating hadith embeddings using Gemini text-embedding-004 (384-dim)...');
  console.log(`Batch size: ${BATCH_SIZE} | Request delay: ${DELAY_BETWEEN_REQUESTS_MS}ms\n`);

  let offset = 0;
  let totalSuccess = 0;
  let totalFailed = 0;
  let batchNum = 0;

  while (true) {
    const hadiths = await fetchUntranslatedBatch(offset);

    if (!hadiths.length) {
      console.log('\nNo more hadiths without embeddings.');
      break;
    }

    batchNum++;
    console.log(`Batch ${batchNum}: embedding ${hadiths.length} hadiths (offset ${offset})...`);

    const { success, failed } = await processBatch(hadiths);
    totalSuccess += success;
    totalFailed += failed;

    console.log(
      `Batch ${batchNum} done — embedded: ${success}, failed: ${failed}` +
        ` | total: ${totalSuccess} embedded, ${totalFailed} failed`,
    );

    if (hadiths.length < BATCH_SIZE) break;

    offset += BATCH_SIZE;
    await delay(DELAY_BETWEEN_BATCHES_MS);
  }

  console.log(`\nDone — total embedded: ${totalSuccess}, total failed: ${totalFailed}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
