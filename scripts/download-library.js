// node scripts/download-library.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE = 'https://github.com/fawazahmed0/hadith-api/raw/1/editions';
const BATCH = 100;

const LANGS = ['ara', 'eng', 'tur', 'urd', 'fra', 'ben'];

const LANG_TO_COLUMN = {
  ara: 'arabic_text',
  eng: 'english_text',
  tur: 'turkish_text',
  urd: 'urdu_text',
  fra: 'french_text',
  ben: 'bengali_text',
};

const COLLECTIONS = [
  { key: 'riyadussalihin', label: 'Riyad al-Salihin'  },
  { key: 'nawawi40',       label: '40 Hadith Nawawi'  },
  { key: 'adab',           label: 'Al-Adab al-Mufrad' },
  { key: 'bulugh',         label: 'Bulugh al-Maram'   },
  { key: 'hisn',           label: 'Hisn al-Muslim'    },
];

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------
async function fetchEdition(lang, collection) {
  const url = `${BASE}/${lang}-${collection}/1.json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

// ---------------------------------------------------------------------------
// Data extraction helpers
// ---------------------------------------------------------------------------
function extractGrade(h) {
  if (!h.grades && !h.grade) return null;
  if (typeof h.grade === 'string') return h.grade;
  if (Array.isArray(h.grades) && h.grades.length > 0) {
    return h.grades.map((g) => g.grade).filter(Boolean).join('; ') || null;
  }
  return null;
}

function extractReference(h) {
  if (!h.reference) return null;
  if (typeof h.reference === 'string') return h.reference;
  if (typeof h.reference === 'object') {
    return Object.entries(h.reference)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
  }
  return null;
}

function buildChapterMap(metadata) {
  // metadata.section is { "1": "Chapter Name", "2": "..." }
  if (!metadata?.section || typeof metadata.section !== 'object') return {};
  return metadata.section;
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------
async function upsertBatch(rows) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from('library_hadiths')
      .upsert(rows.slice(i, i + BATCH), { onConflict: 'collection_key,hadith_number' });
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------------
// Process one collection
// ---------------------------------------------------------------------------
async function processCollection({ key, label }) {
  console.log(`\n=== ${label} (${key}) ===`);

  // Fetch all language editions simultaneously
  const results = await Promise.all(
    LANGS.map((lang) =>
      fetchEdition(lang, key).then((data) => ({ lang, data }))
    )
  );

  const found   = [];
  const missing = [];
  const editions = {};

  for (const { lang, data } of results) {
    if (data && Array.isArray(data.hadiths)) {
      editions[lang] = data;
      found.push(lang);
      console.log(`  ${lang}: ${data.hadiths.length} hadiths`);
    } else {
      missing.push(lang);
      console.log(`  ${lang}: NOT FOUND`);
    }
  }

  if (!editions['ara']) {
    console.log(`  Skipping — no Arabic edition`);
    return { key, label, found, missing, inserted: 0 };
  }

  const araData     = editions['ara'];
  const chapterMap  = buildChapterMap(araData.metadata);

  // Index non-Arabic editions by hadith number for O(1) lookup
  const textByLang = {};
  for (const lang of found) {
    if (lang === 'ara') continue;
    textByLang[lang] = new Map();
    for (const h of editions[lang].hadiths) {
      textByLang[lang].set(h.hadithnumber, h.text ?? '');
    }
  }

  // Build rows
  const rows = araData.hadiths.map((h) => {
    const chapterNum = h.section ?? h.chapterNumber ?? h.chapter ?? null;
    const chapterName = chapterNum != null ? (chapterMap[String(chapterNum)] ?? null) : null;

    const row = {
      collection_key:  key,
      hadith_number:   h.hadithnumber,
      book_number:     h.book ?? h.bookNumber ?? null,
      chapter_number:  typeof chapterNum === 'number' ? chapterNum : (parseInt(chapterNum) || null),
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

    return row;
  });

  console.log(`  Upserting ${rows.length} rows in batches of ${BATCH} …`);
  await upsertBatch(rows);

  return { key, label, found, missing, inserted: rows.length };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('download-library starting …');

  const results = [];
  for (const col of COLLECTIONS) {
    try {
      results.push(await processCollection(col));
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      results.push({ key: col.key, label: col.label, error: err.message });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  for (const r of results) {
    console.log(`\n${r.label} (${r.key})`);
    if (r.error) {
      console.log(`  ERROR: ${r.error}`);
      continue;
    }
    console.log(`  Rows inserted/updated : ${r.inserted}`);
    console.log(`  Languages found       : ${r.found.join(', ') || '—'}`);
    if (r.missing.length > 0) {
      console.log(`  Languages NOT found   : ${r.missing.join(', ')}`);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
