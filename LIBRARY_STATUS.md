# Monir Islamic Library — Status

> Last audited: 2026-06-28 | Updated: 2026-06-28 (Mishkat + Shamail imported)

---

## Table Row Counts

| Table | Rows | Notes |
|---|---:|---|
| `library_hadiths` | 44,101 | All collections combined |
| `library_hadith_embeddings` | 43,577 | 524 hadiths missing embeddings |
| `library_hadith_topics` | 33,257 | 10,844 hadiths untagged |
| `library_hadith_translations` | 131,456 | Multi-language hadith text |
| `library_quran_verses` | 6,236 | Complete — all 6,236 verses |
| `library_quran_embeddings` | 6,236 | 100% coverage |
| `library_quran_translations` | 43,652 | Multi-language Quran text |
| `library_tafsir` | 13,378 | Ibn Kathir + Muyassar (Arabic) |
| `library_riyad_salihin` | 1,896 | Standalone table (separate from hadiths) |
| `library_zakat_rules` | 10 | 9 categories + fallback |

> **Updated 2026-06-28:** Added Mishkat al-Masabih (4,428) and Shamail al-Tirmidhi (402) to `library_hadiths`. Both are new `collection_key` values registered in `library_hadith_collections`.

---

## Hadiths by Collection

| Collection | Present | Expected | Gap | Status |
|---|---:|---:|---:|---|
| abudawud | 5,274 | 5,274 | — | ✅ Complete |
| adab_al_mufrad | 1,326 | — | — | ✅ Bonus |
| ahmad | 1,390 | 27,647 | −26,257 | ❌ Severely incomplete |
| bukhari | 7,563 | 7,563 | — | ✅ Complete |
| bulugh | 1,767 | 1,597 | +170 | ✅ OK (extra chaptering) |
| ibnmajah | 4,341 | 4,341 | — | ✅ Complete |
| malik | 1,858 | 1,852 | +6 | ✅ Complete |
| muslim | 7,564 | 7,477 | +87 | ✅ Complete |
| nasai | 5,758 | 5,758 | — | ✅ Complete |
| nawawi40 | 42 | 42 | — | ✅ Complete |
| qudsi40 | 40 | — | — | ✅ Bonus |
| riyadussalihin | 1,896 | — | — | ✅ Complete (stored as `riyadussalihin`) |
| tirmidhi | 3,956 | 3,956 | — | ✅ Complete |
| mishkat | 4,428 | — | — | ✅ Complete (AhmedBaset) |
| shamail | 402 | — | — | ✅ Complete (AhmedBaset) |
| **TOTAL** | **48,931** | | | |

> Note: Ahmad Musnad is the only major collection with a critical gap — 95% of hadiths are missing.
> Mishkat and Shamail were added 2026-06-28 from AhmedBaset/hadith-json v1.2.0.

---

## Tafsir by Author and Language

| Author | Arabic | English | Total |
|---|---:|---:|---:|
| Ibn Kathir | 6,205 | 1,895 | 8,100 |
| Ministry of Islamic Affairs, Saudi Arabia (Muyassar) | 5,278 | — | 5,278 |
| **TOTAL** | **11,483** | **1,895** | **13,378** |

- Ibn Kathir Arabic: full (6,205 verses = all 6,236 minus ~31 combined/missing)
- Ibn Kathir English: partial — 1,895 of 6,236 verses imported
- Muyassar Arabic: full (5,278 verses)
- Muyassar English: **not yet imported**

---

## Embedding Coverage

| Domain | Total | Embedded | Coverage |
|---|---:|---:|---:|
| Hadiths | 44,101 | 43,577 | **98.8%** |
| Quran verses | 6,236 | 6,236 | **100.0%** |

Embedding model: Jina AI (1024-dim vectors)

---

## Topic Tagging Coverage

| Domain | Total | Tagged | Coverage |
|---|---:|---:|---:|
| Hadiths | 44,101 | 33,257 | **75.4%** |

Tagging method: keyword-based (`tag-topics-keyword.ts`)

---

## What's Complete

- **Quran**: all 6,236 verses, 100% embeddings, multi-language translations
- **Core hadith collections**: Bukhari, Muslim, Abu Dawud, Ibn Majah, Tirmidhi, Nasai, Malik, Nawawi 40, Qudsi 40, Bulugh al-Maram, Riyad al-Salihin, Adab al-Mufrad
- **Additional collections**: Mishkat al-Masabih (4,428), Shamail al-Tirmidhi (402)
- **Hadith embeddings**: 98.8% done
- **Hadith translations**: 131,456 rows across multiple languages
- **Tafsir Arabic**: both Ibn Kathir and Muyassar fully imported
- **Zakat rules**: all 10 categories imported

## What's Missing / Incomplete

| Item | Priority | Detail |
|---|---|---|
| Ahmad Musnad | 🔴 High | Only 1,390 of 27,647 imported (5%) |
| Muyassar English tafsir | 🟡 Medium | Arabic complete; English translation not imported |
| Ibn Kathir English tafsir | 🟡 Medium | Only 1,895 of 6,236 verses have English — api.quran.com ID 169 is incomplete at verse level; full text requires alternative source |
| Hadith embeddings | 🟢 Low | 524 hadiths missing (98.8% done) |
| Hadith topic tags | 🟢 Low | 10,844 untagged (75.4% done) |
