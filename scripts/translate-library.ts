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
const BATCH_SIZE = 100;
const DELAY_MS = 200;

interface Hadith {
  collection_key: string;
  hadith_number: number;
  english_text: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function translateToTurkish(text: string): Promise<string> {
  const chat = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are a professional translator specializing in Islamic texts. Translate the given hadith text from English to Turkish accurately and naturally. Output only the Turkish translation with no additional commentary.',
      },
      {
        role: 'user',
        content: text,
      },
    ],
    temperature: 0.3,
    max_tokens: 1024,
  });

  return chat.choices[0]?.message?.content?.trim() ?? '';
}

async function fetchUntranslatedBatch(offset: number): Promise<Hadith[]> {
  // Fetch hadiths that have english_text but no Turkish translation yet
  const { data, error } = await supabase.rpc('get_untranslated_hadiths', {
    p_language: 'tr',
    p_limit: BATCH_SIZE,
    p_offset: offset,
  });

  if (error) {
    // Fallback: manual join if the RPC doesn't exist
    if (error.message.includes('does not exist') || error.code === '42883') {
      return fetchUntranslatedBatchManual(offset);
    }
    throw new Error(`Failed to fetch untranslated hadiths: ${error.message}`);
  }

  return (data as Hadith[]) ?? [];
}

async function fetchUntranslatedBatchManual(offset: number): Promise<Hadith[]> {
  // Get hadiths with english_text
  const { data: hadiths, error: hadithError } = await supabase
    .from('library_hadiths')
    .select('collection_key, hadith_number, english_text')
    .not('english_text', 'is', null)
    .neq('english_text', '')
    .range(offset, offset + BATCH_SIZE - 1);

  if (hadithError) throw new Error(`Failed to fetch hadiths: ${hadithError.message}`);
  if (!hadiths?.length) return [];

  // Get existing Turkish translations for this batch
  const keys = hadiths.map((h) => `${h.collection_key}:${h.hadith_number}`);
  const { data: existing, error: trError } = await supabase
    .from('library_hadith_translations')
    .select('collection_key, hadith_number')
    .eq('language', 'tr')
    .in(
      'collection_key',
      hadiths.map((h) => h.collection_key),
    );

  if (trError) throw new Error(`Failed to fetch existing translations: ${trError.message}`);

  const translated = new Set(
    (existing ?? []).map((r) => `${r.collection_key}:${r.hadith_number}`),
  );

  return hadiths.filter((h) => !translated.has(`${h.collection_key}:${h.hadith_number}`));
}

async function processBatch(hadiths: Hadith[]): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const hadith of hadiths) {
    try {
      const translated = await translateToTurkish(hadith.english_text);

      if (!translated) {
        console.warn(
          `  [warn] Empty translation for ${hadith.collection_key}:${hadith.hadith_number}`,
        );
        failed++;
        await delay(DELAY_MS);
        continue;
      }

      const { error } = await supabase.from('library_hadith_translations').upsert(
        {
          collection_key: hadith.collection_key,
          hadith_number: hadith.hadith_number,
          language: 'tr',
          translated_text: translated,
          translated_by: 'groq',
        },
        { onConflict: 'collection_key,hadith_number,language' },
      );

      if (error) {
        console.error(
          `  [error] Insert failed for ${hadith.collection_key}:${hadith.hadith_number}: ${error.message}`,
        );
        failed++;
      } else {
        console.log(
          `  [ok] ${hadith.collection_key}:${hadith.hadith_number} translated`,
        );
        success++;
      }
    } catch (err) {
      console.error(
        `  [error] Translation failed for ${hadith.collection_key}:${hadith.hadith_number}: ${(err as Error).message}`,
      );
      failed++;
    }

    await delay(DELAY_MS);
  }

  return { success, failed };
}

async function main(): Promise<void> {
  console.log('Starting hadith translation (English → Turkish) using Groq...');
  console.log(`Model: ${MODEL} | Batch size: ${BATCH_SIZE} | Delay: ${DELAY_MS}ms\n`);

  let offset = 0;
  let totalSuccess = 0;
  let totalFailed = 0;
  let batchNum = 0;

  while (true) {
    const hadiths = await fetchUntranslatedBatch(offset);

    if (!hadiths.length) {
      console.log('\nNo more untranslated hadiths found.');
      break;
    }

    batchNum++;
    console.log(`\nBatch ${batchNum}: processing ${hadiths.length} hadiths (offset ${offset})...`);

    const { success, failed } = await processBatch(hadiths);
    totalSuccess += success;
    totalFailed += failed;

    console.log(
      `Batch ${batchNum} done — translated: ${success}, failed: ${failed}` +
        ` | total so far: ${totalSuccess} translated, ${totalFailed} failed`,
    );

    // If fewer than BATCH_SIZE were returned, we've reached the end
    if (hadiths.length < BATCH_SIZE) break;

    offset += BATCH_SIZE;
  }

  console.log(`\nTranslation complete — total translated: ${totalSuccess}, total failed: ${totalFailed}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
