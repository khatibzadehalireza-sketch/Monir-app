"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const COLLECTIONS = [
  { key: "bukhari",  name: "صحیح البخاری",  short: "بخاری"    },
  { key: "muslim",   name: "صحیح مسلم",     short: "مسلم"     },
  { key: "abudawud", name: "سنن أبی داود",   short: "أبو داود" },
  { key: "ibnmajah", name: "سنن ابن ماجه",  short: "ابن ماجه" },
  { key: "tirmidhi", name: "سنن الترمذی",   short: "ترمذی"    },
  { key: "nasai",    name: "سنن النسائی",   short: "نسائی"    },
  { key: "malik",    name: "موطأ مالک",      short: "مالک"     },
  { key: "nawawi40", name: "اربعین نووی",    short: "نووی"     },
] as const;

const TOPICS = [
  { key: "prayer",      label: "نماز"      },
  { key: "fasting",     label: "روزه"      },
  { key: "charity",     label: "صدقه"      },
  { key: "family",      label: "خانواده"   },
  { key: "patience",    label: "صبر"       },
  { key: "gratitude",   label: "شکرگزاری" },
  { key: "forgiveness", label: "بخشش"      },
  { key: "death",       label: "مرگ"       },
  { key: "jannah",      label: "بهشت"      },
  { key: "business",    label: "معاملات"   },
  { key: "knowledge",   label: "علم"       },
  { key: "marriage",    label: "ازدواج"    },
  { key: "parents",     label: "والدین"    },
  { key: "honesty",     label: "صداقت"     },
  { key: "kindness",    label: "مهربانی"   },
  { key: "anger",       label: "خشم"       },
  { key: "dua",         label: "دعا"       },
  { key: "tawakkul",    label: "توکل"      },
  { key: "repentance",  label: "توبه"      },
  { key: "quran",       label: "قرآن"      },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toAr(n: number) {
  return String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[+d]);
}

function gradeInfo(grade: string | null): { text: string; cls: string } | null {
  if (!grade) return null;
  const g = grade.toLowerCase();
  if (g.includes("sahih"))                              return { text: "صحیح", cls: "g-sahih" };
  if (g.includes("hasan"))                              return { text: "حسن",  cls: "g-hasan" };
  if (g.includes("da'if") || g.includes("daif") || g.includes("weak"))
                                                        return { text: "ضعیف", cls: "g-daif"  };
  return { text: grade, cls: "g-other" };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface HadithRow {
  collection_key: string;
  hadith_number:  number;
  arabic_text:    string;
  english_text:   string;
  grade:          string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LibraryPage() {
  // Filter state
  const [selectedColl,   setSelectedColl]   = useState<string | null>(null);
  const [page,           setPage]           = useState(0);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [debSearch,      setDebSearch]      = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [gradeFilter,    setGradeFilter]    = useState<"" | "sahih" | "hasan">("");

  // Data
  const [counts,       setCounts]       = useState<Record<string, number>>({});
  const [hadiths,      setHadiths]      = useState<HadithRow[]>([]);
  const [translations, setTranslations] = useState<Map<string, string>>(new Map());
  const [topicsMap,    setTopicsMap]    = useState<Map<string, string[]>>(new Map());
  const [total,        setTotal]        = useState(0);

  // UI state
  const [loading,       setLoading]       = useState(false);
  const [countsLoading, setCountsLoading] = useState(true);
  const [copied,        setCopied]        = useState<string | null>(null);
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [rightOpen,     setRightOpen]     = useState(false);

  const mainRef    = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Debounce search ────────────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebSearch(searchQuery);
      setPage(0);
    }, 380);
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery]);

  // ── Fetch collection counts once ───────────────────────────────────────────
  useEffect(() => {
    const sb = getSupabaseBrowser();
    setCountsLoading(true);
    Promise.all(
      COLLECTIONS.map(async c => {
        const { count } = await sb
          .from("library_hadiths")
          .select("*", { count: "exact", head: true })
          .eq("collection_key", c.key);
        return [c.key, count ?? 0] as const;
      })
    ).then(entries => {
      setCounts(Object.fromEntries(entries));
      setCountsLoading(false);
    });
  }, []);

  // ── Fetch hadiths whenever filters change ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const sb = getSupabaseBrowser();
        let hadithData: HadithRow[] = [];
        let totalCount = 0;

        // Step 1 — topic filter: collect eligible (collection_key, hadith_number) pairs
        let filteredPairs: Array<{ collection_key: string; hadith_number: number }> | null = null;

        if (selectedTopics.length > 0) {
          let tq = sb
            .from("library_hadith_topics")
            .select("collection_key, hadith_number")
            .in("topic_key", selectedTopics);
          if (selectedColl) tq = tq.eq("collection_key", selectedColl);

          const { data: tData } = await tq;
          if (!cancelled && tData) {
            const seen = new Set<string>();
            filteredPairs = tData.filter(r => {
              const k = `${r.collection_key}:${r.hadith_number}`;
              if (seen.has(k)) return false;
              seen.add(k);
              return true;
            });
          }
        }

        // Step 2 — fetch hadiths
        if (filteredPairs !== null) {
          totalCount = filteredPairs.length;
          const slice = filteredPairs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

          if (slice.length > 0) {
            const byCollection = new Map<string, number[]>();
            slice.forEach(r => {
              const arr = byCollection.get(r.collection_key) ?? [];
              arr.push(r.hadith_number);
              byCollection.set(r.collection_key, arr);
            });

            const parts: HadithRow[] = [];
            for (const [coll, nums] of byCollection) {
              const { data } = await sb
                .from("library_hadiths")
                .select("collection_key, hadith_number, arabic_text, english_text, grade")
                .eq("collection_key", coll)
                .in("hadith_number", nums);
              if (data) parts.push(...data);
            }

            const order = new Map(
              slice.map((r, i) => [`${r.collection_key}:${r.hadith_number}`, i])
            );
            hadithData = parts.sort(
              (a, b) =>
                (order.get(`${a.collection_key}:${a.hadith_number}`) ?? 0) -
                (order.get(`${b.collection_key}:${b.hadith_number}`) ?? 0)
            );
          }
        } else {
          // Standard paginated query
          let q = sb
            .from("library_hadiths")
            .select("collection_key, hadith_number, arabic_text, english_text, grade", { count: "exact" });

          if (selectedColl)        q = q.eq("collection_key", selectedColl);
          if (debSearch.trim())    q = q.ilike("english_text", `%${debSearch.trim()}%`);
          if (gradeFilter === "sahih") q = q.ilike("grade", "%Sahih%");
          if (gradeFilter === "hasan") q = q.ilike("grade", "%Hasan%");

          const { data, count, error } = await q
            .order("collection_key")
            .order("hadith_number")
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

          if (error) throw error;
          hadithData = data ?? [];
          totalCount = count ?? 0;
        }

        if (cancelled) return;
        setHadiths(hadithData);
        setTotal(totalCount);

        // Step 3 — batch-fetch translations + topic tags for visible hadiths
        if (hadithData.length > 0) {
          const nums  = hadithData.map(h => h.hadith_number);
          const colls = [...new Set(hadithData.map(h => h.collection_key))];

          const [trRes, tpRes] = await Promise.all([
            sb.from("library_hadith_translations")
              .select("collection_key, hadith_number, translated_text")
              .in("collection_key", colls)
              .in("hadith_number", nums)
              .eq("language", "fa"),
            sb.from("library_hadith_topics")
              .select("collection_key, hadith_number, topic_key")
              .in("collection_key", colls)
              .in("hadith_number", nums)
              .gte("confidence_score", 0.65),
          ]);

          if (!cancelled) {
            const trMap = new Map<string, string>();
            (trRes.data ?? []).forEach(r =>
              trMap.set(`${r.collection_key}:${r.hadith_number}`, r.translated_text)
            );
            setTranslations(trMap);

            const tpMap = new Map<string, string[]>();
            (tpRes.data ?? []).forEach(r => {
              const k = `${r.collection_key}:${r.hadith_number}`;
              const arr = tpMap.get(k) ?? [];
              arr.push(r.topic_key);
              tpMap.set(k, arr);
            });
            setTopicsMap(tpMap);
          }
        }
      } catch (e) {
        if (!cancelled) console.error("[library]", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [selectedColl, page, debSearch, selectedTopics, gradeFilter]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const selectCollection = useCallback((key: string | null) => {
    setSelectedColl(key);
    setPage(0);
    setSidebarOpen(false);
  }, []);

  const toggleTopic = useCallback((topic: string) => {
    setSelectedTopics(prev =>
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    );
    setPage(0);
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedTopics([]);
    setGradeFilter("");
    setSearchQuery("");
    setPage(0);
  }, []);

  const copyHadith = useCallback((h: HadithRow) => {
    const coll = COLLECTIONS.find(c => c.key === h.collection_key);
    const tr   = translations.get(`${h.collection_key}:${h.hadith_number}`);
    const text = [
      h.arabic_text,
      tr ? `\n${tr}` : "",
      `\n— ${coll?.name ?? h.collection_key}، حدیث ${toAr(h.hadith_number)}`,
    ].join("");
    navigator.clipboard.writeText(text).catch(() => {});
    const k = `${h.collection_key}:${h.hadith_number}`;
    setCopied(k);
    setTimeout(() => setCopied(null), 2000);
  }, [translations]);

  const goPage = useCallback((delta: number) => {
    setPage(p => p + delta);
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const totalPages    = Math.ceil(total / PAGE_SIZE);
  const totalAllCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const hasFilters    = selectedTopics.length > 0 || gradeFilter !== "" || debSearch.trim() !== "";
  const collName      = selectedColl
    ? (COLLECTIONS.find(c => c.key === selectedColl)?.name ?? selectedColl)
    : "همه احادیث";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="lib">

      {/* ─── Mobile top bar ──────────────────────────────────────────── */}
      <div className="lib-topbar">
        <button className="lib-topbtn" onClick={() => setSidebarOpen(s => !s)} aria-label="مجموعه‌ها">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6"  x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="lib-topbar-title">کتابخانه اسلامی</span>
        <button className="lib-topbtn" onClick={() => setRightOpen(s => !s)} aria-label="جستجو و فیلتر">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>

      <div className="lib-body">

        {/* ─── LEFT SIDEBAR ──────────────────────────────────────────── */}
        <aside className={`lib-sidebar${sidebarOpen ? " lib-sidebar--open" : ""}`}>
          <div className="lib-sb-header">
            <div className="lib-sb-logo">
              <span className="lib-sb-logo-ar">ﷲ</span>
            </div>
            <div className="lib-sb-title">کتابخانه اسلامی</div>
            <div className="lib-sb-sub">مجموعه احادیث نبوی</div>
          </div>

          <nav className="lib-sb-nav">
            <button
              className={`lib-sb-item${selectedColl === null ? " lib-sb-item--active" : ""}`}
              onClick={() => selectCollection(null)}
            >
              <span className="lib-sb-name">همه مجموعه‌ها</span>
              <span className="lib-sb-badge">
                {countsLoading ? "·" : toAr(totalAllCount)}
              </span>
            </button>

            <div className="lib-sb-divider" />

            {COLLECTIONS.map(c => (
              <button
                key={c.key}
                className={`lib-sb-item${selectedColl === c.key ? " lib-sb-item--active" : ""}`}
                onClick={() => selectCollection(c.key)}
              >
                <span className="lib-sb-name">{c.name}</span>
                <span className="lib-sb-badge">
                  {countsLoading ? "·" : toAr(counts[c.key] ?? 0)}
                </span>
              </button>
            ))}
          </nav>
        </aside>
        {sidebarOpen && <div className="lib-overlay" onClick={() => setSidebarOpen(false)} />}

        {/* ─── MAIN PANEL ────────────────────────────────────────────── */}
        <main className="lib-main" ref={mainRef}>

          {/* Main header */}
          <div className="lib-main-hdr">
            <div className="lib-main-hdr-left">
              <h1 className="lib-main-title">{collName}</h1>
              {!loading && (
                <span className="lib-main-count">{toAr(total)} حدیث</span>
              )}
            </div>
            {hasFilters && (
              <button className="lib-clear-btn" onClick={clearFilters}>
                پاک کردن فیلترها ×
              </button>
            )}
          </div>

          {/* Active filter pills */}
          {(selectedTopics.length > 0 || gradeFilter) && (
            <div className="lib-active-pills">
              {selectedTopics.map(t => {
                const tp = TOPICS.find(x => x.key === t);
                return (
                  <button key={t} className="lib-pill" onClick={() => toggleTopic(t)}>
                    {tp?.label ?? t} ×
                  </button>
                );
              })}
              {gradeFilter && (
                <button className="lib-pill" onClick={() => setGradeFilter("")}>
                  {gradeFilter === "sahih" ? "صحیح" : "حسن"} ×
                </button>
              )}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="lib-state">
              <div className="lib-spinner" />
              <span>در حال بارگذاری...</span>
            </div>
          )}

          {/* Empty */}
          {!loading && hadiths.length === 0 && (
            <div className="lib-state lib-empty">
              <div className="lib-empty-icon">📚</div>
              <p>حدیثی یافت نشد</p>
              <p className="lib-empty-sub">فیلترها را تغییر دهید یا مجموعه دیگری انتخاب کنید</p>
            </div>
          )}

          {/* Hadith cards */}
          {!loading && hadiths.map(h => {
            const coll    = COLLECTIONS.find(c => c.key === h.collection_key);
            const tr      = translations.get(`${h.collection_key}:${h.hadith_number}`);
            const tpKeys  = topicsMap.get(`${h.collection_key}:${h.hadith_number}`) ?? [];
            const grade   = gradeInfo(h.grade);
            const cardKey = `${h.collection_key}:${h.hadith_number}`;

            return (
              <article key={cardKey} className="lib-card">
                {/* Card header row */}
                <div className="lib-card-hdr">
                  <div className="lib-card-ref">
                    <span className="lib-card-coll">{coll?.short ?? h.collection_key}</span>
                    <span className="lib-card-num">{toAr(h.hadith_number)}</span>
                  </div>
                  <div className="lib-card-actions">
                    {grade && (
                      <span className={`lib-grade-badge ${grade.cls}`}>{grade.text}</span>
                    )}
                    <button
                      className="lib-copy-btn"
                      onClick={() => copyHadith(h)}
                      title="کپی متن"
                    >
                      {copied === cardKey
                        ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4caf70" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                      }
                    </button>
                  </div>
                </div>

                {/* Arabic text */}
                <p className="lib-arabic">{h.arabic_text}</p>

                {/* Translation */}
                {tr
                  ? <p className="lib-tr">{tr}</p>
                  : h.english_text
                    ? <p className="lib-tr lib-tr--en">{h.english_text}</p>
                    : null
                }

                {/* Topic tags */}
                {tpKeys.length > 0 && (
                  <div className="lib-card-topics">
                    {tpKeys.map(tk => {
                      const tp = TOPICS.find(t => t.key === tk);
                      return (
                        <button
                          key={tk}
                          className={`lib-topic-tag${selectedTopics.includes(tk) ? " lib-topic-tag--on" : ""}`}
                          onClick={() => toggleTopic(tk)}
                        >
                          {tp?.label ?? tk}
                        </button>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="lib-pager">
              <button
                className="lib-pager-btn"
                onClick={() => goPage(-1)}
                disabled={page === 0}
              >
                ← قبلی
              </button>
              <span className="lib-pager-info">
                صفحه {toAr(page + 1)} از {toAr(totalPages)}
              </span>
              <button
                className="lib-pager-btn"
                onClick={() => goPage(1)}
                disabled={page >= totalPages - 1}
              >
                بعدی →
              </button>
            </div>
          )}
        </main>

        {/* ─── RIGHT PANEL ───────────────────────────────────────────── */}
        <aside className={`lib-right${rightOpen ? " lib-right--open" : ""}`}>

          {/* Search */}
          <div className="lib-right-section">
            <div className="lib-right-label">جستجو</div>
            <div className={`lib-search-box${searchQuery ? " lib-search-box--filled" : ""}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="lib-search-ico">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="lib-search-input"
                placeholder="جستجو..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                dir="rtl"
              />
              {searchQuery && (
                <button className="lib-search-clear" onClick={() => setSearchQuery("")}>×</button>
              )}
            </div>
          </div>

          {/* Grade filter */}
          <div className="lib-right-section">
            <div className="lib-right-label">درجه صحت</div>
            <div className="lib-grade-row">
              {(["", "sahih", "hasan"] as const).map(g => (
                <button
                  key={g}
                  className={`lib-grade-btn${gradeFilter === g ? " lib-grade-btn--on" : ""}`}
                  onClick={() => { setGradeFilter(g); setPage(0); }}
                >
                  {g === "" ? "همه" : g === "sahih" ? "صحیح" : "حسن"}
                </button>
              ))}
            </div>
          </div>

          {/* Topic chips */}
          <div className="lib-right-section">
            <div className="lib-right-label">
              موضوع
              {selectedTopics.length > 0 && (
                <button className="lib-clear-topics" onClick={() => { setSelectedTopics([]); setPage(0); }}>
                  پاک کردن
                </button>
              )}
            </div>
            <div className="lib-chips">
              {TOPICS.map(t => (
                <button
                  key={t.key}
                  className={`lib-chip${selectedTopics.includes(t.key) ? " lib-chip--on" : ""}`}
                  onClick={() => toggleTopic(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </aside>
        {rightOpen && <div className="lib-overlay" onClick={() => setRightOpen(false)} />}

      </div>

      {/* ─── Styles ──────────────────────────────────────────────────── */}
      <style>{`
        /* Root */
        .lib {
          height: 100dvh; display: flex; flex-direction: column;
          background: #060e22; color: #e2d9c5;
          font-family: 'Vazirmatn', sans-serif; overflow: hidden;
        }

        /* Top bar (mobile only) */
        .lib-topbar {
          display: none; align-items: center; justify-content: space-between;
          padding: 10px 14px; flex-shrink: 0;
          background: rgba(3,7,22,0.97);
          border-bottom: 1px solid rgba(212,160,23,0.14);
          z-index: 5;
        }
        .lib-topbar-title { font-size: 15px; font-weight: 600; color: #d4a017; }
        .lib-topbtn {
          width: 36px; height: 36px; border-radius: 9px;
          background: rgba(212,160,23,0.09); border: 1px solid rgba(212,160,23,0.18);
          color: rgba(212,160,23,0.65); display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all .18s;
        }
        .lib-topbtn:hover { background: rgba(212,160,23,0.18); color: #d4a017; }

        /* Body */
        .lib-body {
          flex: 1; min-height: 0; display: flex; overflow: hidden;
        }

        /* ─── LEFT SIDEBAR ─────────────────────── */
        .lib-sidebar {
          width: 260px; flex-shrink: 0;
          background: rgba(3,7,22,0.97);
          border-right: 1px solid rgba(212,160,23,0.10);
          display: flex; flex-direction: column; overflow: hidden;
        }
        .lib-sb-header {
          padding: 22px 18px 16px; flex-shrink: 0;
          border-bottom: 1px solid rgba(212,160,23,0.08);
        }
        .lib-sb-logo {
          width: 40px; height: 40px; border-radius: 12px;
          background: rgba(212,160,23,0.10); border: 1px solid rgba(212,160,23,0.22);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 12px;
        }
        .lib-sb-logo-ar {
          font-family: 'Scheherazade New', serif; font-size: 22px; color: #d4a017;
        }
        .lib-sb-title { font-size: 14px; font-weight: 700; color: #d4a017; }
        .lib-sb-sub   { font-size: 11px; color: rgba(212,160,23,0.38); margin-top: 3px; }

        .lib-sb-nav {
          flex: 1; overflow-y: auto; padding: 8px 0;
          scrollbar-width: thin; scrollbar-color: rgba(212,160,23,0.12) transparent;
        }
        .lib-sb-nav::-webkit-scrollbar { width: 3px; }
        .lib-sb-nav::-webkit-scrollbar-thumb { background: rgba(212,160,23,0.15); border-radius: 4px; }

        .lib-sb-item {
          width: 100%; display: flex; align-items: center; justify-content: space-between;
          padding: 9px 18px; background: transparent; border: none; cursor: pointer;
          transition: background .15s; direction: rtl; gap: 8px; text-align: right;
        }
        .lib-sb-item:hover { background: rgba(212,160,23,0.06); }
        .lib-sb-item--active { background: rgba(212,160,23,0.11) !important; }

        .lib-sb-name {
          font-family: 'Scheherazade New', serif; font-size: 14px;
          color: rgba(226,217,197,0.68); line-height: 1.4;
        }
        .lib-sb-item--active .lib-sb-name { color: #d4a017; }

        .lib-sb-badge {
          font-size: 10.5px; padding: 2px 8px; border-radius: 10px;
          background: rgba(212,160,23,0.09); color: rgba(212,160,23,0.50);
          flex-shrink: 0; font-family: 'Scheherazade New', serif; min-width: 28px;
          text-align: center;
        }
        .lib-sb-item--active .lib-sb-badge { color: rgba(212,160,23,0.75); }

        .lib-sb-divider { height: 1px; background: rgba(212,160,23,0.08); margin: 4px 14px; }

        /* ─── MAIN PANEL ───────────────────────── */
        .lib-main {
          flex: 1; min-width: 0; overflow-y: auto; padding: 28px 32px;
          scrollbar-width: thin; scrollbar-color: rgba(212,160,23,0.10) transparent;
        }
        .lib-main::-webkit-scrollbar { width: 4px; }
        .lib-main::-webkit-scrollbar-thumb { background: rgba(212,160,23,0.14); border-radius: 4px; }

        .lib-main-hdr {
          display: flex; align-items: flex-start; justify-content: space-between;
          direction: rtl; margin-bottom: 8px; gap: 12px; flex-wrap: wrap;
        }
        .lib-main-hdr-left { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
        .lib-main-title {
          font-family: 'Scheherazade New', serif; font-size: 24px; font-weight: 700;
          color: #d4a017; margin: 0;
        }
        .lib-main-count { font-size: 12px; color: rgba(212,160,23,0.38); }

        .lib-clear-btn {
          padding: 6px 14px; border-radius: 16px; white-space: nowrap;
          background: rgba(212,160,23,0.07); border: 1px solid rgba(212,160,23,0.20);
          color: rgba(212,160,23,0.58); font-size: 12px; font-family: 'Vazirmatn', sans-serif;
          cursor: pointer; transition: all .18s;
        }
        .lib-clear-btn:hover { background: rgba(212,160,23,0.15); color: #d4a017; }

        .lib-active-pills {
          display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 18px; direction: rtl;
        }
        .lib-pill {
          padding: 4px 12px; border-radius: 14px; font-size: 12px;
          background: rgba(212,160,23,0.14); border: 1px solid rgba(212,160,23,0.34);
          color: #d4a017; font-family: 'Vazirmatn', sans-serif;
          cursor: pointer; transition: all .15s;
        }
        .lib-pill:hover { background: rgba(212,160,23,0.22); }

        /* Loading / empty */
        .lib-state {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 12px; padding: 80px 20px;
          color: rgba(212,160,23,0.40); font-size: 14px;
        }
        .lib-spinner {
          width: 28px; height: 28px; border-radius: 50%;
          border: 2px solid rgba(212,160,23,0.14);
          border-top-color: #d4a017;
          animation: lib-spin 0.75s linear infinite;
        }
        @keyframes lib-spin { to { transform: rotate(360deg); } }
        .lib-empty { text-align: center; }
        .lib-empty-icon { font-size: 42px; margin-bottom: 10px; }
        .lib-empty p { margin: 4px 0; font-size: 15px; }
        .lib-empty-sub { font-size: 12px; opacity: .65; }

        /* Hadith card */
        .lib-card {
          background: rgba(255,255,255,0.022);
          border: 1px solid rgba(212,160,23,0.09);
          border-radius: 16px; padding: 20px 24px;
          margin-bottom: 14px; direction: rtl;
          transition: border-color .20s, background .20s, box-shadow .20s;
        }
        .lib-card:hover {
          border-color: rgba(212,160,23,0.20);
          background: rgba(255,255,255,0.036);
          box-shadow: 0 4px 24px rgba(0,0,0,0.25);
        }

        .lib-card-hdr {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 14px;
        }
        .lib-card-ref { display: flex; align-items: baseline; gap: 6px; }
        .lib-card-coll {
          font-family: 'Scheherazade New', serif; font-size: 13px;
          color: #d4a017; font-weight: 700;
        }
        .lib-card-num {
          font-family: 'Scheherazade New', serif; font-size: 12px;
          color: rgba(212,160,23,0.48);
        }
        .lib-card-actions { display: flex; align-items: center; gap: 8px; }

        /* Grade badges */
        .lib-grade-badge {
          font-size: 10px; padding: 2px 9px; border-radius: 10px; border: 1px solid;
          letter-spacing: .03em;
        }
        .g-sahih { color: rgba(80,200,120,0.88);  border-color: rgba(80,200,120,0.26);  background: rgba(80,200,120,0.07);  }
        .g-hasan { color: rgba(100,180,255,0.82); border-color: rgba(100,180,255,0.24); background: rgba(100,180,255,0.06); }
        .g-daif  { color: rgba(255,140,100,0.72); border-color: rgba(255,140,100,0.22); background: rgba(255,140,100,0.06); }
        .g-other { color: rgba(212,160,23,0.55);  border-color: rgba(212,160,23,0.20);  background: rgba(212,160,23,0.05);  }

        .lib-copy-btn {
          width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
          color: rgba(226,217,197,0.40); display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all .18s;
        }
        .lib-copy-btn:hover { background: rgba(255,255,255,0.09); color: rgba(226,217,197,0.80); }

        /* Arabic text */
        .lib-arabic {
          font-family: 'Scheherazade New', serif;
          font-size: clamp(18px, 2.2vw, 24px); font-weight: 600;
          line-height: 2.2; color: #f0e6c8;
          text-align: right; direction: rtl;
          margin: 0 0 14px;
          text-shadow: 0 1px 12px rgba(0,0,0,0.40);
        }

        /* Translation */
        .lib-tr {
          font-size: 13.5px; line-height: 1.90;
          color: rgba(226,217,197,0.60); text-align: right; direction: rtl;
          margin: 0 0 14px;
          padding-top: 12px; border-top: 1px solid rgba(212,160,23,0.07);
        }
        .lib-tr--en {
          direction: ltr; text-align: left; font-style: italic;
          font-family: Georgia, serif; font-size: 13px;
        }

        /* Topic tags on card */
        .lib-card-topics {
          display: flex; gap: 5px; flex-wrap: wrap;
          padding-top: 12px; border-top: 1px solid rgba(212,160,23,0.06);
        }
        .lib-topic-tag {
          font-size: 11px; padding: 3px 10px; border-radius: 12px;
          background: rgba(212,160,23,0.05); border: 1px solid rgba(212,160,23,0.14);
          color: rgba(212,160,23,0.50); cursor: pointer;
          font-family: 'Vazirmatn', sans-serif; transition: all .15s;
        }
        .lib-topic-tag:hover { background: rgba(212,160,23,0.13); color: #d4a017; border-color: rgba(212,160,23,0.34); }
        .lib-topic-tag--on  { background: rgba(212,160,23,0.16); color: #d4a017; border-color: rgba(212,160,23,0.42); }

        /* Pagination */
        .lib-pager {
          display: flex; align-items: center; justify-content: center; gap: 16px;
          padding: 28px 0 20px; direction: rtl;
        }
        .lib-pager-btn {
          padding: 9px 22px; border-radius: 22px; font-size: 13px;
          background: rgba(212,160,23,0.07); border: 1px solid rgba(212,160,23,0.20);
          color: rgba(212,160,23,0.60); font-family: 'Vazirmatn', sans-serif;
          cursor: pointer; transition: all .18s;
        }
        .lib-pager-btn:hover:not(:disabled) { background: rgba(212,160,23,0.17); color: #d4a017; border-color: rgba(212,160,23,0.45); }
        .lib-pager-btn:disabled { opacity: .25; cursor: default; }
        .lib-pager-info { font-size: 13px; color: rgba(212,160,23,0.40); }

        /* ─── RIGHT PANEL ──────────────────────── */
        .lib-right {
          width: 280px; flex-shrink: 0;
          background: rgba(3,7,22,0.97);
          border-left: 1px solid rgba(212,160,23,0.10);
          overflow-y: auto; padding: 22px 16px;
          scrollbar-width: thin; scrollbar-color: rgba(212,160,23,0.10) transparent;
        }
        .lib-right::-webkit-scrollbar { width: 3px; }
        .lib-right::-webkit-scrollbar-thumb { background: rgba(212,160,23,0.14); border-radius: 4px; }

        .lib-right-section { margin-bottom: 26px; }
        .lib-right-label {
          font-size: 10.5px; font-weight: 700; letter-spacing: .10em; text-transform: uppercase;
          color: rgba(212,160,23,0.42); margin-bottom: 10px;
          display: flex; align-items: center; justify-content: space-between;
          direction: rtl;
        }
        .lib-clear-topics {
          font-size: 10px; padding: 2px 8px; border-radius: 8px; letter-spacing: 0;
          background: rgba(212,160,23,0.09); border: 1px solid rgba(212,160,23,0.18);
          color: rgba(212,160,23,0.55); cursor: pointer; font-family: 'Vazirmatn', sans-serif;
          text-transform: none; transition: all .15s;
        }
        .lib-clear-topics:hover { background: rgba(212,160,23,0.18); color: #d4a017; }

        /* Search box */
        .lib-search-box {
          display: flex; align-items: center; gap: 8px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(212,160,23,0.13);
          border-radius: 10px; padding: 9px 12px; transition: border-color .18s;
        }
        .lib-search-box:focus-within,
        .lib-search-box--filled { border-color: rgba(212,160,23,0.34); }
        .lib-search-ico { color: rgba(212,160,23,0.32); flex-shrink: 0; }
        .lib-search-input {
          flex: 1; min-width: 0; background: transparent; border: none; outline: none;
          color: #e2d9c5; font-family: 'Vazirmatn', sans-serif; font-size: 13px;
          direction: rtl;
        }
        .lib-search-input::placeholder { color: rgba(212,160,23,0.26); }
        .lib-search-clear {
          background: transparent; border: none;
          color: rgba(212,160,23,0.38); font-size: 18px; line-height: 1;
          cursor: pointer; flex-shrink: 0; transition: color .15s;
        }
        .lib-search-clear:hover { color: rgba(212,160,23,0.75); }

        /* Grade filter */
        .lib-grade-row { display: flex; gap: 6px; direction: rtl; }
        .lib-grade-btn {
          flex: 1; padding: 8px 6px; border-radius: 10px; font-size: 12px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(212,160,23,0.13);
          color: rgba(226,217,197,0.50); font-family: 'Vazirmatn', sans-serif;
          cursor: pointer; transition: all .18s;
        }
        .lib-grade-btn:hover { background: rgba(212,160,23,0.09); color: rgba(212,160,23,0.80); }
        .lib-grade-btn--on {
          background: rgba(212,160,23,0.15); border-color: rgba(212,160,23,0.42); color: #d4a017;
        }

        /* Topic chips */
        .lib-chips { display: flex; gap: 5px; flex-wrap: wrap; direction: rtl; }
        .lib-chip {
          font-size: 12px; padding: 5px 12px; border-radius: 14px;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(212,160,23,0.12);
          color: rgba(226,217,197,0.52); font-family: 'Vazirmatn', sans-serif;
          cursor: pointer; transition: all .15s;
        }
        .lib-chip:hover { background: rgba(212,160,23,0.09); color: rgba(212,160,23,0.82); border-color: rgba(212,160,23,0.28); }
        .lib-chip--on {
          background: rgba(212,160,23,0.16); border-color: rgba(212,160,23,0.46); color: #d4a017;
        }

        /* Overlay */
        .lib-overlay {
          display: none; position: fixed; inset: 0; z-index: 18;
          background: rgba(0,0,0,0.58); backdrop-filter: blur(3px);
        }

        /* ─── Responsive ───────────────────────── */
        @media (max-width: 960px) {
          .lib-right { display: none; }
        }

        @media (max-width: 840px) {
          .lib-topbar { display: flex; }

          .lib-sidebar {
            position: fixed; top: 57px; left: 0; bottom: 0; z-index: 20;
            transform: translateX(-100%); transition: transform .26s ease;
            border-right: 1px solid rgba(212,160,23,0.18);
          }
          .lib-sidebar--open { transform: translateX(0); }

          .lib-right {
            display: flex; flex-direction: column;
            position: fixed; top: 57px; right: 0; bottom: 0; z-index: 20;
            transform: translateX(100%); transition: transform .26s ease;
            border-left: 1px solid rgba(212,160,23,0.18);
          }
          .lib-right--open { transform: translateX(0); }

          .lib-overlay { display: block; }
          .lib-main { padding: 18px 16px; }
          .lib-arabic { font-size: 18px; }
        }

        @media (max-width: 520px) {
          .lib-card { padding: 16px; }
          .lib-card-hdr { gap: 6px; }
        }
      `}</style>
    </div>
  );
}
