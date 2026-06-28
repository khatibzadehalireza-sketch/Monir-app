# Monir Islamic Library — Status

> Last audited: 2026-06-28

---

## Table Row Counts

| Table | Rows | Notes |
|---|---:|---|
| `library_hadiths` | 48,931 | All collections combined |
| `library_hadith_embeddings` | 48,407 | 524 hadiths missing embeddings (no English text) |
| `library_hadith_topics` | 33,257 | 15,674 hadiths untagged |
| `library_hadith_translations` | 131,456 | Multi-language hadith text |
| `library_quran_verses` | 6,236 | Complete — all 6,236 verses |
| `library_quran_embeddings` | 6,236 | 100% coverage |
| `library_quran_translations` | 43,652 | Multi-language Quran text |
| `library_tafsir` | 13,378 | Ibn Kathir (AR+EN partial) + Muyassar (AR) |
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
| Ibn Kathir | 6,205 | 1,895 | 8,100 |
| Ministry of Islamic Affairs, Saudi Arabia (Muyassar) | 5,278 | — | 5,278 |
| **TOTAL** | **11,483** | **1,895** | **13,378** |

- Ibn Kathir Arabic: full (6,205 verses)
- Ibn Kathir English: 1,895 of 6,236 verses — **api.quran.com ID 169 is incomplete at verse level**; the tafsir comments on many verses in groups so 4,341 verse slots are empty. A different source (e.g. complete digitised text) is needed to fill the gap.
- Muyassar Arabic: full (5,278 verses)
- Muyassar English: not yet imported

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

| Domain | Total | Tagged | Coverage |
|---|---:|---:|---:|
| Hadiths | 48,931 | 33,257 | **68.0%** |

Tagging method: keyword-based (`tag-topics-keyword.ts`). Mishkat and Shamail hadiths are not yet tagged.

---

## What's Complete

- **Quran**: all 6,236 verses, 100% embeddings, multi-language translations
- **Core hadith collections**: Bukhari, Muslim, Abu Dawud, Ibn Majah, Tirmidhi, Nasai, Malik, Nawawi 40, Qudsi 40, Bulugh al-Maram, Riyad al-Salihin, Adab al-Mufrad
- **Additional collections**: Mishkat al-Masabih (4,428), Shamail al-Tirmidhi (402)
- **Hadith embeddings**: 98.9% — all hadiths with English text are embedded
- **Hadith translations**: 131,456 rows across multiple languages
- **Tafsir Arabic**: Ibn Kathir (full) + Muyassar (full)
- **Zakat rules**: all 10 categories

## What's Missing / Incomplete

| Item | Priority | Detail |
|---|---|---|
| Ahmad Musnad | 🔴 High | Only 1,390 of 27,647 imported (5%) — needs licensed source |
| Ibn Kathir English tafsir | 🟡 Medium | 1,895 of 6,236 verses; api.quran.com ID 169 is incomplete — needs alternative dataset |
| Muyassar English tafsir | 🟡 Medium | Arabic complete; English not imported |
| Hadith topic tags | 🟡 Medium | 15,674 untagged (68%); Mishkat + Shamail not yet tagged |
| Hadith embeddings | 🟢 Low | 524 hadiths have no English text so cannot be embedded |

---

## GitHub Actions Workflows

Manual-trigger workflows in `.github/workflows/`:

| Workflow | Collection | Notes |
|---|---|---|
| `import-ahmad-musnad.yml` | ahmad | Re-imports ~1,390 from AhmedBaset (not the full 27,647) |
| `import-mishkat.yml` | mishkat | 4,428 hadiths; auto-registers collection |
| `import-shamail.yml` | shamail | 402 hadiths; auto-registers collection |
| `import-tafsir-ibn-kathir.yml` | tafsir | Ibn Kathir EN via api.quran.com (1,895 max) |
| `import-riyad-salihin.yml` | riyadussalihin | Riyad al-Salihin by chapter |

Secrets required: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
