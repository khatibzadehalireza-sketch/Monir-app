# Monir Islamic Library — Status

> Last audited: 2026-07-01

---

## Table Row Counts

| Table | Rows | Notes |
|---|---:|---|
| `library_hadiths` | 48,931 | All collections combined |
| `library_hadith_embeddings` | 48,407 | 524 hadiths missing embeddings (no English text) |
| `library_hadith_topics` | 38,032 | ~12,556 hadiths untagged (Mishkat + Shamail now tagged) |
| `library_hadith_translations` | 131,456 | Multi-language hadith text |
| `library_quran_verses` | 6,236 | Complete — all 6,236 verses |
| `library_quran_embeddings` | 6,236 | 100% coverage |
| `library_quran_translations` | 43,652 | Multi-language Quran text |
| `library_quran_words` | 77,430 | Word-by-word: Arabic, transliteration, EN translation, audio URL |
| `library_tafsir` | 29,694 | Ibn Kathir (AR+EN), Muyassar (AR), Ma'arif al-Qur'an (EN), Tazkirul Quran (EN) |
| `library_riyad_salihin` | 1,896 | Standalone table (separate from hadiths) |
| `library_zakat_rules` | 10 | 9 categories + fallback |

---

## Hadiths by Collection

| Collection | Present | Expected | Gap | Status |
|---|---:|---:|---:|---|
| abudawud | 5,274 | 5,274 | — | ✅ Complete |
| adab_al_mufrad | 1,326 | — | — | ✅ Bonus (also stored as `adab`) |
| ahmad | 1,390 | 27,647 | −26,257 | ❌ Severely incomplete |
| bukhari | 7,563 | 7,563 | — | ✅ Complete |
| bulugh | 1,767 | 1,597 | +170 | ✅ OK (extra chaptering) |
| ibnmajah | 4,341 | 4,341 | — | ✅ Complete |
| malik | 1,858 | 1,852 | +6 | ✅ Complete |
| mishkat | 4,428 | — | — | ✅ Complete (added 2026-06-28) |
| muslim | 7,564 | 7,477 | +87 | ✅ Complete |
| nasai | 5,758 | 5,758 | — | ✅ Complete |
| nawawi40 | 42 | 42 | — | ✅ Complete |
| qudsi40 | 40 | — | — | ✅ Bonus |
| riyadussalihin | 1,896 | — | — | ✅ Complete (stored as `riyadussalihin`) |
| shamail | 402 | — | — | ✅ Complete (added 2026-06-28) |
| tirmidhi | 3,956 | 3,956 | — | ✅ Complete |
| **TOTAL** | **48,931** | | | |

> Ahmad Musnad is the only major collection with a critical gap — 95% missing. AhmedBaset/hadith-json only has ~1,390 of 27,647. A licensed dataset or sunnah.com API key is required for the rest.

---

## Tafsir by Author and Language

| Author | Arabic | English | Total |
|---|---:|---:|---:|
| Ibn Kathir | 6,205 | 6,231 | 12,436 |
| Ministry of Islamic Affairs, Saudi Arabia (Muyassar) | 5,278 | — | 5,278 |
| Mufti Muhammad Shafi (Ma'arif al-Qur'an) | — | 6,196 | 6,196 |
| Maulana Wahid Uddin Khan (Tazkirul Quran) | — | 5,784 | 5,784 |
| **TOTAL** | **11,483** | **18,211** | **29,694** |

- Ibn Kathir Arabic: full (6,205 verses)
- Ibn Kathir English: 6,231 / 6,236 (99.9%) — qurancdn.com ID 169; 5 verses in Surah 105 have no source block
- Muyassar Arabic: full (5,278 verses)
- Muyassar English: not available on qurancdn.com — no English version exists in the API
- Ma'arif al-Qur'an English (ID 168): 6,196 / 6,236 (99.4%) — qurancdn.com; block expansion
- Tazkirul Quran English (ID 817): 5,784 / 6,236 (92.8%) — qurancdn.com; block expansion; 452 verses uncovered (sparse blocks in shorter surahs)

---

## Embedding Coverage

| Domain | Total | Embedded | Coverage |
|---|---:|---:|---:|
| Hadiths | 48,931 | 48,407 | **98.9%** |
| Quran verses | 6,236 | 6,236 | **100.0%** |

Embedding model: Jina AI `jina-embeddings-v3`, 384-dim.  
The 524 unembedded hadiths have no English text — embeddings are generated from English text only.

---

## Topic Tagging Coverage

| Domain | Total | Topic Rows | Untagged Hadiths |
|---|---:|---:|---:|
| Hadiths | 48,931 | 38,032 | ~12,556 |

Tagging method: keyword-based. Mishkat (2,725 of 4,428 matched, 4,103 rows) and Shamail (393 of 402 matched, 672 rows) tagged 2026-07-01. Hadiths with at least one topic: ~36,375 (74.3%).

---

## What's Complete

- **Quran**: all 6,236 verses, 100% embeddings, multi-language translations, 77,430 word-by-word entries
- **Core hadith collections**: Bukhari, Muslim, Abu Dawud, Ibn Majah, Tirmidhi, Nasai, Malik, Nawawi 40, Qudsi 40, Bulugh al-Maram, Riyad al-Salihin, Adab al-Mufrad
- **Additional collections**: Mishkat al-Masabih (4,428), Shamail al-Tirmidhi (402)
- **Hadith embeddings**: 98.9% — all hadiths with English text are embedded
- **Hadith translations**: 131,456 rows across multiple languages
- **Tafsir Arabic**: Ibn Kathir (full) + Muyassar (full)
- **Ibn Kathir English tafsir**: 6,231 / 6,236 verses (99.9%) — expanded from 1,895 blocks via qurancdn.com
- **Ma'arif al-Qur'an English**: 6,196 / 6,236 verses (99.4%) — qurancdn.com ID 168
- **Tazkirul Quran English**: 5,784 / 6,236 verses (92.8%) — qurancdn.com ID 817
- **Hadith topic tags**: Mishkat + Shamail tagged 2026-07-01
- **Zakat rules**: all 10 categories

## What's Missing / Incomplete

| Item | Priority | Detail |
|---|---|---|
| Ahmad Musnad | 🔴 High | Only 1,390 of 27,647 imported (5%) — needs licensed source |
| Ibn Kathir EN tafsir (5 verses) | 🟢 Low | Surah 105 (Al-Fil) has no tafsir block in qurancdn.com source |
| Muyassar English tafsir | 🟡 Medium | Arabic complete; English version not available on qurancdn.com |
| Tazkirul Quran (452 verses) | 🟢 Low | 92.8% coverage; shorter surahs have sparse tafsir blocks in source |
| Hadith topic tags | 🟡 Medium | ~12,556 hadiths still untagged — keyword matching limitation |
| Hadith embeddings | 🟢 Low | 524 hadiths have no English text so cannot be embedded |

---

## GitHub Actions Workflows

Manual-trigger workflows in `.github/workflows/`:

| Workflow | Collection | Notes |
|---|---|---|
| `import-ahmad-musnad.yml` | ahmad | Re-imports ~1,390 from AhmedBaset (not the full 27,647) |
| `import-mishkat.yml` | mishkat | 4,428 hadiths; auto-registers collection |
| `import-shamail.yml` | shamail | 402 hadiths; auto-registers collection |
| `import-tafsir-ibn-kathir.yml` | tafsir | Ibn Kathir EN via api.quran.com (1,895 blocks only) |
| _(script)_ `import-ibn-kathir-qurancdn.ts` | tafsir | Expands 1,895 blocks to 6,231 verse rows via qurancdn.com |
| _(script)_ `import-en-tafsirs-qurancdn.ts` | tafsir | Ma'arif al-Qur'an (ID 168) + Tazkirul Quran (ID 817) English |
| `import-riyad-salihin.yml` | riyadussalihin | Riyad al-Salihin by chapter |

Secrets required: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
