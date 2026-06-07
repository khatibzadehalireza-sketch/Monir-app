import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { getSupabase } from '@/lib/supabase';

// Allow up to 300 s on Vercel Pro — translating 200 hadiths takes ~1-2 min
export const maxDuration = 300;

const PRIORITY_LANGUAGES = ['tr', 'fr', 'de', 'ur', 'id', 'bn', 'es'] as const;
type Lang = (typeof PRIORITY_LANGUAGES)[number];

const LANGUAGE_NAMES: Record<Lang, string> = {
  tr: 'Turkish',
  fr: 'French',
  de: 'German',
  ur: 'Urdu',
  id: 'Indonesian',
  bn: 'Bengali',
  es: 'Spanish',
};

const MODEL = 'llama-3.3-70b-versatile';
const BATCH_SIZE = 200;
const CONCURRENCY = 5;

interface Hadith {
  collection_key: string;
  hadith_number: number;
  english_text: string;
}

// ─── Translation ─────────────────────────────────────────────────────────────

async function translateHadith(
  groq: Groq,
  text: string,
  targetLang: Lang,
): Promise<string> {
  const langName = LANGUAGE_NAMES[targetLang];
  const res = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    max_tokens: 1024,
    messages: [
      {
        role: 'system',
        content:
          `You are a professional translator specializing in Islamic texts. ` +
          `Translate the following hadith from English to ${langName} accurately and naturally. ` +
          `Preserve Islamic terminology, proper nouns, and the reverential tone. ` +
          `Output only the ${langName} translation — no explanations, no headings.`,
      },
      { role: 'user', content: text },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? '';
}

// ─── Language priority ────────────────────────────────────────────────────────

async function findPriorityLanguage(): Promise<Lang | null> {
  const supabase = getSupabase();

  // Total hadiths with English text
  const { count: totalCount } = await supabase
    .from('library_hadiths')
    .select('*', { count: 'exact', head: true })
    .not('english_text', 'is', null)
    .neq('english_text', '');

  if (!totalCount) return null;

  for (const lang of PRIORITY_LANGUAGES) {
    const { count: translatedCount } = await supabase
      .from('library_hadith_translations')
      .select('*', { count: 'exact', head: true })
      .eq('language', lang);

    if ((translatedCount ?? 0) < totalCount) return lang;
  }

  return null; // all languages fully translated
}

// ─── Fetch untranslated ───────────────────────────────────────────────────────

async function fetchUntranslated(lang: Lang): Promise<Hadith[]> {
  const supabase = getSupabase();
  const collected: Hadith[] = [];
  const PAGE = 500;
  let offset = 0;

  while (collected.length < BATCH_SIZE) {
    const { data: hadiths, error } = await supabase
      .from('library_hadiths')
      .select('collection_key, hadith_number, english_text')
      .not('english_text', 'is', null)
      .neq('english_text', '')
      .order('collection_key')
      .order('hadith_number')
      .range(offset, offset + PAGE - 1);

    if (error) throw new Error(`Hadiths query failed: ${error.message}`);
    if (!hadiths?.length) break;

    // Fetch translation status for this page's collections
    const collectionKeys = [...new Set(hadiths.map((h) => h.collection_key))];
    const { data: existing } = await supabase
      .from('library_hadith_translations')
      .select('collection_key, hadith_number')
      .eq('language', lang)
      .in('collection_key', collectionKeys);

    const done = new Set(
      (existing ?? []).map((r) => `${r.collection_key}:${r.hadith_number}`),
    );

    for (const h of hadiths) {
      if (!done.has(`${h.collection_key}:${h.hadith_number}`)) {
        collected.push(h);
        if (collected.length >= BATCH_SIZE) break;
      }
    }

    if (hadiths.length < PAGE) break;
    offset += PAGE;
  }

  return collected;
}

// ─── Async concurrency pool ───────────────────────────────────────────────────

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()!;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 });
  }

  try {
    const lang = await findPriorityLanguage();
    if (!lang) {
      return NextResponse.json({ message: 'All languages fully translated', done: true });
    }

    const hadiths = await fetchUntranslated(lang);
    if (!hadiths.length) {
      return NextResponse.json({ lang, message: 'No untranslated hadiths found', done: true });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const supabase = getSupabase();
    let success = 0;
    let failed = 0;

    await runWithConcurrency(hadiths, CONCURRENCY, async (hadith) => {
      try {
        const translated = await translateHadith(groq, hadith.english_text, lang);
        if (!translated) { failed++; return; }

        const { error } = await supabase.from('library_hadith_translations').upsert(
          {
            collection_key: hadith.collection_key,
            hadith_number: hadith.hadith_number,
            language: lang,
            translated_text: translated,
            translated_by: 'groq',
          },
          { onConflict: 'collection_key,hadith_number,language' },
        );

        if (error) { failed++; } else { success++; }
      } catch {
        failed++;
      }
    });

    return NextResponse.json({
      lang,
      langName: LANGUAGE_NAMES[lang],
      processed: hadiths.length,
      success,
      failed,
    });
  } catch (err) {
    console.error('[cron/translate]', err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
