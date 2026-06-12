import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const maxDuration = 300;

const BASE = 'https://raw.githubusercontent.com/fawazahmed0/hadith-api/1/editions';
const DB_BATCH = 100;
const FETCH_CONCURRENCY = 20;

const LANGS = ['ara', 'eng', 'tur', 'urd', 'fra', 'ben'] as const;
type Lang = (typeof LANGS)[number];

// urlSlug: the segment used in the URL, e.g. "nawawi" → {lang}-nawawi/{n}.json
// count: total number of hadiths in the collection
const COLLECTIONS = [
  { key: 'nawawi40', label: '40 Hadith Nawawi', urlSlug: 'nawawi', count: 42 },
] as const;

interface HadithFile {
  hadithnumber: number;
  text?: string;
  section?: number | string | null;
  chapterNumber?: number | null;
  chapter?: number | string | null;
  book?: number | null;
  bookNumber?: number | null;
  narrator?: string | null;
  grade?: string | null;
  grades?: { grade: string }[] | null;
  reference?: string | Record<string, unknown> | null;
}

function extractGrade(h: HadithFile): string | null {
  if (!h.grades && !h.grade) return null;
  if (typeof h.grade === 'string') return h.grade;
  if (Array.isArray(h.grades) && h.grades.length > 0) {
    return h.grades.map((g) => g.grade).filter(Boolean).join('; ') || null;
  }
  return null;
}

function extractReference(h: HadithFile): string | null {
  if (!h.reference) return null;
  if (typeof h.reference === 'string') return h.reference;
  if (typeof h.reference === 'object') {
    return Object.entries(h.reference)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  }
  return null;
}

async function withConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (index < tasks.length) {
        const i = index++;
        results[i] = await tasks[i]();
      }
    }),
  );
  return results;
}

async function processCollection(
  key: string,
  label: string,
  urlSlug: string,
  count: number,
) {
  // Build fetch tasks for every (lang, number) pair
  type FetchResult = { lang: Lang; num: number; data: HadithFile | null };

  const tasks = LANGS.flatMap((lang) =>
    Array.from({ length: count }, (_, i) => {
      const num = i + 1;
      return async (): Promise<FetchResult> => {
        const url = `${BASE}/${lang}-${urlSlug}/${num}.json`;
        const res = await fetch(url);
        const data: HadithFile | null = res.ok ? await res.json() : null;
        return { lang, num, data };
      };
    }),
  );

  const fetched = await withConcurrency(tasks, FETCH_CONCURRENCY);

  // Group by hadith number
  const byNumber = new Map<number, Partial<Record<Lang, HadithFile>>>();
  const missingByLang: Partial<Record<Lang, number>> = {};

  for (const { lang, num, data } of fetched) {
    if (data) {
      if (!byNumber.has(num)) byNumber.set(num, {});
      byNumber.get(num)![lang] = data;
    } else {
      missingByLang[lang] = (missingByLang[lang] ?? 0) + 1;
    }
  }

  const rows = [];
  for (const [num, langs] of byNumber.entries()) {
    const ara = langs['ara'];
    if (!ara) continue;

    const chapterNum = ara.section ?? ara.chapterNumber ?? ara.chapter ?? null;
    const chapterNumParsed =
      typeof chapterNum === 'number' ? chapterNum : parseInt(String(chapterNum)) || null;

    rows.push({
      collection_key: key,
      hadith_number:  num,
      book_number:    ara.book ?? ara.bookNumber ?? null,
      chapter_number: chapterNumParsed,
      chapter_name:   null,
      arabic_text:    ara.text ?? '',
      english_text:   langs['eng']?.text ?? null,
      turkish_text:   langs['tur']?.text ?? null,
      urdu_text:      langs['urd']?.text ?? null,
      french_text:    langs['fra']?.text ?? null,
      bengali_text:   langs['ben']?.text ?? null,
      german_text:    null,
      dutch_text:     null,
      narrator:       ara.narrator ?? null,
      grade:          extractGrade(ara),
      reference:      extractReference(ara),
    });
  }

  const supabase = getSupabase();
  for (let i = 0; i < rows.length; i += DB_BATCH) {
    const { error } = await supabase
      .from('library_hadiths')
      .upsert(rows.slice(i, i + DB_BATCH), { onConflict: 'collection_key,hadith_number' });
    if (error) throw new Error(`Upsert failed for ${key}: ${error.message}`);
  }

  return { key, label, inserted: rows.length, missingByLang };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const collectionParam = searchParams.get('collection');

  const targets = collectionParam
    ? COLLECTIONS.filter((c) => c.key === collectionParam)
    : [...COLLECTIONS];

  if (collectionParam && targets.length === 0) {
    return NextResponse.json(
      { error: `Unknown collection: ${collectionParam}` },
      { status: 400 },
    );
  }

  const results = [];
  for (const col of targets) {
    try {
      results.push(await processCollection(col.key, col.label, col.urlSlug, col.count));
    } catch (err) {
      results.push({ key: col.key, label: col.label, error: (err as Error).message });
    }
  }

  return NextResponse.json({ results });
}
