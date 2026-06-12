import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const maxDuration = 300;

const BASE = 'https://github.com/fawazahmed0/hadith-api/raw/1/editions';
const BATCH = 100;

const LANGS = ['ara', 'eng', 'tur', 'urd', 'fra', 'ben'] as const;
type Lang = (typeof LANGS)[number];

const COLLECTIONS = [
  { key: 'riyadussalihin', label: 'Riyad al-Salihin' },
  { key: 'nawawi40',       label: '40 Hadith Nawawi' },
  { key: 'adab',           label: 'Al-Adab al-Mufrad' },
  { key: 'bulugh',         label: 'Bulugh al-Maram' },
  { key: 'hisn',           label: 'Hisn al-Muslim' },
] as const;

interface HadithEntry {
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

interface EditionData {
  hadiths: HadithEntry[];
  metadata?: { section?: Record<string, string> };
}

async function fetchEdition(lang: Lang, collection: string): Promise<EditionData | null> {
  const url = `${BASE}/${lang}-${collection}.json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

function extractGrade(h: HadithEntry): string | null {
  if (!h.grades && !h.grade) return null;
  if (typeof h.grade === 'string') return h.grade;
  if (Array.isArray(h.grades) && h.grades.length > 0) {
    return h.grades.map((g) => g.grade).filter(Boolean).join('; ') || null;
  }
  return null;
}

function extractReference(h: HadithEntry): string | null {
  if (!h.reference) return null;
  if (typeof h.reference === 'string') return h.reference;
  if (typeof h.reference === 'object') {
    return Object.entries(h.reference)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  }
  return null;
}

async function processCollection(key: string, label: string) {
  const results = await Promise.all(
    LANGS.map((lang) => fetchEdition(lang, key).then((data) => ({ lang, data }))),
  );

  const editions: Partial<Record<Lang, EditionData>> = {};
  const found: Lang[] = [];
  const missing: Lang[] = [];

  for (const { lang, data } of results) {
    if (data && Array.isArray(data.hadiths)) {
      editions[lang] = data;
      found.push(lang);
    } else {
      missing.push(lang);
    }
  }

  if (!editions['ara']) {
    return { key, label, found, missing, inserted: 0, skipped: true };
  }

  const araData = editions['ara']!;
  const chapterMap: Record<string, string> = araData.metadata?.section ?? {};

  const textByLang: Partial<Record<Lang, Map<number, string>>> = {};
  for (const lang of found) {
    if (lang === 'ara') continue;
    const map = new Map<number, string>();
    for (const h of editions[lang]!.hadiths) {
      map.set(h.hadithnumber, h.text ?? '');
    }
    textByLang[lang] = map;
  }

  const rows = araData.hadiths.map((h) => {
    const chapterNum = h.section ?? h.chapterNumber ?? h.chapter ?? null;
    const chapterName = chapterNum != null ? (chapterMap[String(chapterNum)] ?? null) : null;
    const chapterNumParsed =
      typeof chapterNum === 'number' ? chapterNum : parseInt(String(chapterNum)) || null;

    return {
      collection_key:  key,
      hadith_number:   h.hadithnumber,
      book_number:     h.book ?? h.bookNumber ?? null,
      chapter_number:  chapterNumParsed,
      chapter_name:    chapterName,
      arabic_text:     h.text ?? '',
      english_text:    textByLang['eng']?.get(h.hadithnumber) ?? null,
      turkish_text:    textByLang['tur']?.get(h.hadithnumber) ?? null,
      urdu_text:       textByLang['urd']?.get(h.hadithnumber) ?? null,
      french_text:     textByLang['fra']?.get(h.hadithnumber) ?? null,
      bengali_text:    textByLang['ben']?.get(h.hadithnumber) ?? null,
      german_text:     null,
      dutch_text:      null,
      narrator:        h.narrator ?? null,
      grade:           extractGrade(h),
      reference:       extractReference(h),
    };
  });

  const supabase = getSupabase();
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from('library_hadiths')
      .upsert(rows.slice(i, i + BATCH), { onConflict: 'collection_key,hadith_number' });
    if (error) throw new Error(`Upsert failed for ${key}: ${error.message}`);
  }

  return { key, label, found, missing, inserted: rows.length, skipped: false };
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
      results.push(await processCollection(col.key, col.label));
    } catch (err) {
      results.push({ key: col.key, label: col.label, error: (err as Error).message });
    }
  }

  return NextResponse.json({ results });
}
