import { createClient } from '@supabase/supabase-js';
import Groq from 'groq-sdk';
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
const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!GROQ_API_KEY) {
  console.error('Missing GROQ_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const groq = new Groq({ apiKey: GROQ_API_KEY });

const MODEL = 'llama-3.3-70b-versatile';
const BATCH_SIZE = 50;
const DELAY_MS = 200;

const VALID_TOPICS = [
  'prayer', 'fasting', 'charity', 'family', 'patience',
  'gratitude', 'forgiveness', 'death', 'jannah', 'business',
  'knowledge', 'marriage', 'parents', 'honesty', 'kindness',
  'anger', 'dua', 'tawakkul', 'repentance', 'quran',
] as const;

type TopicKey = (typeof VALID_TOPICS)[number];

interface TagResult {
  topic_key: TopicKey;
  confidence_score: number;
}

interface Hadith {
  collection_key: string;
  hadith_number: number;
  english_text: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function assignTopics(hadith: Hadith): Promise<TagResult[]> {
  const text = hadith.english_text.slice(0, 2000); // keep prompt concise

  const res = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    max_tokens: 512,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are an Islamic scholar assistant that categorizes hadiths by topic.

Given a hadith text, return a JSON object with a single key "topics" containing an array of objects.
Each object must have:
  - "topic_key": one of the valid topics listed below
  - "confidence_score": a float from 0.0 to 1.0

Only include topics that are genuinely relevant (confidence >= 0.5).
Return between 1 and 5 topics per hadith. Return an empty array if none apply.

Valid topic_keys:
${VALID_TOPICS.join(', ')}`,
      },
      {
        role: 'user',
        content: text,
      },
    ],
  });

  const raw = res.choices[0]?.message?.content ?? '{}';

  let parsed: { topics?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(`  [warn] JSON parse failed for ${hadith.collection_key}:${hadith.hadith_number}`);
    return [];
  }

  if (!Array.isArray(parsed.topics)) return [];

  return (parsed.topics as Array<{ topic_key?: unknown; confidence_score?: unknown }>)
    .filter(
      (t) =>
        typeof t.topic_key === 'string' &&
        (VALID_TOPICS as readonly string[]).includes(t.topic_key) &&
        typeof t.confidence_score === 'number' &&
        t.confidence_score >= 0.5,
    )
    .map((t) => ({
      topic_key: t.topic_key as TopicKey,
      confidence_score: Math.min(1, Math.max(0, t.confidence_score as number)),
    }));
}

async function fetchUntaggedBatch(offset: number): Promise<Hadith[]> {
  const { data: hadiths, error: hErr } = await supabase
    .from('library_hadiths')
    .select('collection_key, hadith_number, english_text')
    .not('english_text', 'is', null)
    .neq('english_text', '')
    .order('collection_key')
    .order('hadith_number')
    .range(offset, offset + BATCH_SIZE * 3 - 1);

  if (hErr) throw new Error(`Hadiths query failed: ${hErr.message}`);
  if (!hadiths?.length) return [];

  // Find which hadiths in this page already have at least one topic tag
  const collectionKeys = [...new Set(hadiths.map((h) => h.collection_key))];
  const { data: existing, error: eErr } = await supabase
    .from('library_hadith_topics')
    .select('collection_key, hadith_number')
    .eq('tagged_by', 'groq')
    .in('collection_key', collectionKeys);

  if (eErr) throw new Error(`Topics query failed: ${eErr.message}`);

  const tagged = new Set(
    (existing ?? []).map((r) => `${r.collection_key}:${r.hadith_number}`),
  );

  return hadiths
    .filter((h) => !tagged.has(`${h.collection_key}:${h.hadith_number}`))
    .slice(0, BATCH_SIZE);
}

async function processBatch(hadiths: Hadith[]): Promise<{ success: number; failed: number; topicsAssigned: number }> {
  let success = 0;
  let failed = 0;
  let topicsAssigned = 0;

  for (const hadith of hadiths) {
    try {
      const tags = await assignTopics(hadith);

      if (tags.length === 0) {
        console.log(`  [skip] ${hadith.collection_key}:${hadith.hadith_number} — no matching topics`);
        success++; // counted as processed, just no topics
        await delay(DELAY_MS);
        continue;
      }

      const rows = tags.map((t) => ({
        collection_key: hadith.collection_key,
        hadith_number: hadith.hadith_number,
        topic_key: t.topic_key,
        confidence_score: t.confidence_score,
        tagged_by: 'groq',
      }));

      const { error } = await supabase
        .from('library_hadith_topics')
        .upsert(rows, { onConflict: 'collection_key,hadith_number,topic_key' });

      if (error) {
        console.error(
          `  [error] ${hadith.collection_key}:${hadith.hadith_number} — ${error.message}`,
        );
        failed++;
      } else {
        const topicList = tags.map((t) => `${t.topic_key}(${t.confidence_score.toFixed(2)})`).join(', ');
        console.log(`  [ok] ${hadith.collection_key}:${hadith.hadith_number} → ${topicList}`);
        success++;
        topicsAssigned += tags.length;
      }
    } catch (err) {
      console.error(
        `  [error] ${hadith.collection_key}:${hadith.hadith_number} — ${(err as Error).message}`,
      );
      failed++;
    }

    await delay(DELAY_MS);
  }

  return { success, failed, topicsAssigned };
}

async function main(): Promise<void> {
  console.log('Starting hadith topic tagging using Groq...');
  console.log(`Model: ${MODEL} | Batch size: ${BATCH_SIZE} | Delay: ${DELAY_MS}ms`);
  console.log(`Topics: ${VALID_TOPICS.join(', ')}\n`);

  let offset = 0;
  let totalSuccess = 0;
  let totalFailed = 0;
  let totalTopics = 0;
  let batchNum = 0;

  while (true) {
    const hadiths = await fetchUntaggedBatch(offset);

    if (!hadiths.length) {
      console.log('\nNo more untagged hadiths.');
      break;
    }

    batchNum++;
    console.log(`\nBatch ${batchNum}: tagging ${hadiths.length} hadiths (offset ${offset})...`);

    const { success, failed, topicsAssigned } = await processBatch(hadiths);
    totalSuccess += success;
    totalFailed += failed;
    totalTopics += topicsAssigned;

    console.log(
      `Batch ${batchNum} done — processed: ${success}, failed: ${failed}, topics assigned: ${topicsAssigned}` +
        ` | totals: ${totalSuccess} processed, ${totalTopics} topic rows`,
    );

    if (hadiths.length < BATCH_SIZE) break;

    offset += BATCH_SIZE;
  }

  console.log(
    `\nTagging complete — processed: ${totalSuccess}, failed: ${totalFailed}, total topic rows: ${totalTopics}`,
  );
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
