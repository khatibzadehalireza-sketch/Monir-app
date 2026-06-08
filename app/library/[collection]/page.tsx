"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;
const BOOKMARKS_KEY = "monir-bookmarks";

const COLLECTION_NAMES: Record<string, string> = {
  bukhari:  "صحیح البخاری",
  muslim:   "صحیح مسلم",
  abudawud: "سنن أبی داود",
  ibnmajah: "سنن ابن ماجه",
  tirmidhi: "سنن الترمذی",
  nasai:    "سنن النسائی",
  malik:    "موطأ مالک",
  nawawi40: "اربعین نووی",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toAr(n: number) {
  return String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[+d]);
}

function gradeInfo(grade: string | null): { text: string; cls: string } | null {
  if (!grade) return null;
  const g = grade.toLowerCase();
  if (g.includes("sahih"))                                              return { text: "صحیح", cls: "g-s" };
  if (g.includes("hasan"))                                              return { text: "حسن",  cls: "g-h" };
  if (g.includes("da'if") || g.includes("daif") || g.includes("weak")) return { text: "ضعیف", cls: "g-d" };
  return { text: grade, cls: "g-o" };
}

// ─── Bookmark helpers (localStorage) ─────────────────────────────────────────

interface BookmarkEntry {
  collection_key: string;
  hadith_number:  number;
  arabic_text:    string;
  timestamp:      string;
}

function readBookmarks(): Set<string> {
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as BookmarkEntry[];
    return new Set(arr.map(b => `${b.collection_key}:${b.hadith_number}`));
  } catch {
    return new Set();
  }
}

function toggleBookmarkStorage(h: HadithRow): boolean {
  try {
    const raw  = localStorage.getItem(BOOKMARKS_KEY);
    const arr: BookmarkEntry[] = raw ? JSON.parse(raw) : [];
    const k    = `${h.collection_key}:${h.hadith_number}`;
    const idx  = arr.findIndex(b => `${b.collection_key}:${b.hadith_number}` === k);

    if (idx !== -1) {
      arr.splice(idx, 1);
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(arr));
      return false; // removed
    }
    arr.push({
      collection_key: h.collection_key,
      hadith_number:  h.hadith_number,
      arabic_text:    h.arabic_text,
      timestamp:      new Date().toISOString(),
    });
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(arr));
    return true; // added
  } catch {
    return false;
  }
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

export default function CollectionPage({
  params,
}: {
  params: Promise<{ collection: string }>;
}) {
  const { collection: collectionKey } = use(params);
  const router      = useRouter();
  const collName    = COLLECTION_NAMES[collectionKey] ?? collectionKey;

  // Filter state
  const [page,        setPage]        = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [debSearch,   setDebSearch]   = useState("");

  // Data
  const [hadiths,      setHadiths]      = useState<HadithRow[]>([]);
  const [translations, setTranslations] = useState<Map<string, string>>(new Map());
  const [total,        setTotal]        = useState(0);
  const [totalFull,    setTotalFull]    = useState<number | null>(null);

  // UI state
  const [loading,   setLoading]   = useState(false);
  const [copied,    setCopied]    = useState<string | null>(null);
  const [shared,    setShared]    = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());

  const mainRef     = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Load bookmarks from localStorage ────────────────────────────────────────
  useEffect(() => { setBookmarks(readBookmarks()); }, []);

  // ── Debounce search query ────────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebSearch(searchQuery);
      setPage(0);
    }, 380);
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery]);

  // ── Fetch total collection count (once) ──────────────────────────────────────
  useEffect(() => {
    if (!collectionKey) return;
    getSupabaseBrowser()
      .from("library_hadiths")
      .select("*", { count: "exact", head: true })
      .eq("collection_key", collectionKey)
      .then(({ count }) => setTotalFull(count ?? 0));
  }, [collectionKey]);

  // ── Fetch page of hadiths + translations ────────────────────────────────────
  useEffect(() => {
    if (!collectionKey) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const sb = getSupabaseBrowser();

        // Base query
        let q = sb
          .from("library_hadiths")
          .select("collection_key, hadith_number, arabic_text, english_text, grade", { count: "exact" })
          .eq("collection_key", collectionKey);

        if (debSearch.trim()) {
          q = q.or(
            `english_text.ilike.%${debSearch.trim()}%,arabic_text.ilike.%${debSearch.trim()}%`
          );
        }

        const { data, count, error } = await q
          .order("hadith_number")
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (error) throw error;
        if (cancelled) return;

        const rows = data ?? [];
        setHadiths(rows);
        setTotal(count ?? 0);

        // Fetch translations: Farsi first, then English fallback
        if (rows.length > 0) {
          const nums = rows.map(h => h.hadith_number);

          const { data: faData } = await sb
            .from("library_hadith_translations")
            .select("hadith_number, translated_text")
            .eq("collection_key", collectionKey)
            .in("hadith_number", nums)
            .eq("language", "fa");

          const trMap = new Map<string, string>();
          (faData ?? []).forEach(r => trMap.set(String(r.hadith_number), r.translated_text));

          // English translation fallback for hadiths with no Farsi
          const missing = nums.filter(n => !trMap.has(String(n)));
          if (missing.length > 0) {
            const { data: enData } = await sb
              .from("library_hadith_translations")
              .select("hadith_number, translated_text")
              .eq("collection_key", collectionKey)
              .in("hadith_number", missing)
              .eq("language", "en");
            (enData ?? []).forEach(r => {
              if (!trMap.has(String(r.hadith_number)))
                trMap.set(String(r.hadith_number), r.translated_text);
            });
          }

          if (!cancelled) setTranslations(trMap);
        }
      } catch (e) {
        console.error("[collection-page]", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [collectionKey, page, debSearch]);

  // ── Action handlers ──────────────────────────────────────────────────────────
  const goPage = useCallback((delta: number) => {
    setPage(p => p + delta);
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const copyHadith = useCallback((h: HadithRow) => {
    const tr   = translations.get(String(h.hadith_number));
    const text = `${h.arabic_text}${tr ? `\n\n${tr}` : ""}\n\n— ${collName}، حدیث ${toAr(h.hadith_number)}`;
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(String(h.hadith_number));
    setTimeout(() => setCopied(null), 2000);
  }, [translations, collName]);

  const shareHadith = useCallback(async (h: HadithRow) => {
    const tr   = translations.get(String(h.hadith_number));
    const text = `${h.arabic_text}${tr ? `\n\n${tr}` : ""}\n\n— ${collName}، حدیث ${toAr(h.hadith_number)}\n\nاز منیر`;
    if (navigator.share) {
      try { await navigator.share({ text }); } catch { /* cancelled */ }
    } else {
      navigator.clipboard.writeText(text).catch(() => {});
      setShared(String(h.hadith_number));
      setTimeout(() => setShared(null), 2000);
    }
  }, [translations, collName]);

  const handleBookmark = useCallback((h: HadithRow) => {
    toggleBookmarkStorage(h);
    setBookmarks(readBookmarks());
  }, []);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="cp">

      {/* ─── Header ──────────────────────────────────────────────────── */}
      <header className="cp-header">
        <button className="cp-back" onClick={() => router.push("/library")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          کتابخانه
        </button>

        <div className="cp-header-info">
          <h1 className="cp-title">{collName}</h1>
          {totalFull !== null && (
            <span className="cp-subtitle">{toAr(totalFull)} حدیث</span>
          )}
        </div>

        <div className="cp-header-gap" />
      </header>

      {/* ─── Search bar ──────────────────────────────────────────────── */}
      <div className="cp-search-row">
        <div className={`cp-search-box${searchQuery ? " cp-search-box--active" : ""}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="cp-search-ico">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="cp-search-input"
            placeholder={`جستجو در ${collName}...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            dir="rtl"
          />
          {searchQuery && (
            <button className="cp-search-clear" onClick={() => setSearchQuery("")}>×</button>
          )}
        </div>
        {debSearch && !loading && (
          <span className="cp-result-count">{toAr(total)} نتیجه</span>
        )}
      </div>

      {/* ─── Main scrollable body ─────────────────────────────────────── */}
      <div className="cp-main" ref={mainRef}>

        {/* Loading */}
        {loading && (
          <div className="cp-state">
            <div className="cp-spinner" />
            <span>در حال بارگذاری...</span>
          </div>
        )}

        {/* Empty */}
        {!loading && hadiths.length === 0 && (
          <div className="cp-state cp-empty">
            <span className="cp-empty-icon">📭</span>
            <p>حدیثی یافت نشد</p>
            {debSearch && <p className="cp-empty-sub">عبارت جستجو را تغییر دهید</p>}
          </div>
        )}

        {/* Hadith cards */}
        {!loading && hadiths.map(h => {
          const tr          = translations.get(String(h.hadith_number));
          const grade       = gradeInfo(h.grade);
          const numKey      = String(h.hadith_number);
          const bmKey       = `${h.collection_key}:${h.hadith_number}`;
          const isBookmarked = bookmarks.has(bmKey);

          return (
            <article key={numKey} className="cp-card">

              {/* Card top row */}
              <div className="cp-card-top">
                <div className="cp-card-ref">
                  <span className="cp-ref-label">حدیث</span>
                  <span className="cp-ref-num">{toAr(h.hadith_number)}</span>
                </div>

                <div className="cp-card-actions">
                  {grade && (
                    <span className={`cp-grade ${grade.cls}`}>{grade.text}</span>
                  )}

                  {/* Bookmark */}
                  <button
                    className={`cp-action-btn${isBookmarked ? " cp-action-btn--bookmarked" : ""}`}
                    onClick={() => handleBookmark(h)}
                    title={isBookmarked ? "حذف از نشانک‌ها" : "افزودن به نشانک‌ها"}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24"
                      fill={isBookmarked ? "currentColor" : "none"}
                      stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"
                    >
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                  </button>

                  {/* Share */}
                  <button
                    className="cp-action-btn"
                    onClick={() => shareHadith(h)}
                    title="اشتراک‌گذاری"
                  >
                    {shared === numKey
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4caf70" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                        </svg>
                    }
                  </button>

                  {/* Copy */}
                  <button
                    className="cp-action-btn"
                    onClick={() => copyHadith(h)}
                    title="کپی"
                  >
                    {copied === numKey
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4caf70" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                    }
                  </button>
                </div>
              </div>

              {/* Arabic text */}
              <p className="cp-arabic">{h.arabic_text}</p>

              {/* Translation */}
              {tr
                ? <p className="cp-tr">{tr}</p>
                : h.english_text
                  ? <p className="cp-tr cp-tr--en">{h.english_text}</p>
                  : null
              }
            </article>
          );
        })}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="cp-pager">
            <button
              className="cp-pager-btn"
              onClick={() => goPage(-1)}
              disabled={page === 0}
            >
              ← قبلی
            </button>
            <span className="cp-pager-info">
              صفحه {toAr(page + 1)} از {toAr(totalPages)}
            </span>
            <button
              className="cp-pager-btn"
              onClick={() => goPage(1)}
              disabled={page >= totalPages - 1}
            >
              بعدی →
            </button>
          </div>
        )}
      </div>

      {/* ─── Styles ──────────────────────────────────────────────────── */}
      <style>{`
        /* Root */
        .cp {
          height: 100dvh; display: flex; flex-direction: column;
          background: #060e22; color: #e2d9c5;
          font-family: 'Vazirmatn', sans-serif; overflow: hidden;
        }

        /* ── Header ──────────────────────────── */
        .cp-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px; flex-shrink: 0;
          background: rgba(3,7,22,0.97);
          border-bottom: 1px solid rgba(212,160,23,0.13);
          gap: 12px; direction: rtl;
        }
        .cp-back {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 20px;
          background: rgba(212,160,23,0.08); border: 1px solid rgba(212,160,23,0.20);
          color: rgba(212,160,23,0.68); font-family: 'Vazirmatn', sans-serif; font-size: 13px;
          cursor: pointer; transition: all .18s; white-space: nowrap;
        }
        .cp-back:hover { background: rgba(212,160,23,0.16); color: #d4a017; border-color: rgba(212,160,23,0.42); }
        .cp-header-info { text-align: center; }
        .cp-title {
          font-family: 'Scheherazade New', serif; font-size: 20px; font-weight: 700;
          color: #d4a017; margin: 0; line-height: 1.3;
        }
        .cp-subtitle { font-size: 12px; color: rgba(212,160,23,0.40); }
        .cp-header-gap { width: 80px; flex-shrink: 0; }

        /* ── Search ──────────────────────────── */
        .cp-search-row {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 20px; flex-shrink: 0;
          background: rgba(4,9,26,0.90);
          border-bottom: 1px solid rgba(212,160,23,0.09);
          direction: rtl;
        }
        .cp-search-box {
          flex: 1; display: flex; align-items: center; gap: 8px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(212,160,23,0.14);
          border-radius: 12px; padding: 10px 14px; transition: border-color .18s;
        }
        .cp-search-box--active,
        .cp-search-box:focus-within { border-color: rgba(212,160,23,0.38); }
        .cp-search-ico { color: rgba(212,160,23,0.34); flex-shrink: 0; }
        .cp-search-input {
          flex: 1; min-width: 0; background: transparent; border: none; outline: none;
          color: #e2d9c5; font-family: 'Vazirmatn', sans-serif; font-size: 14px;
          direction: rtl;
        }
        .cp-search-input::placeholder { color: rgba(212,160,23,0.26); }
        .cp-search-clear {
          background: transparent; border: none;
          color: rgba(212,160,23,0.38); font-size: 20px; line-height: 1;
          cursor: pointer; flex-shrink: 0; transition: color .15s;
        }
        .cp-search-clear:hover { color: rgba(212,160,23,0.75); }
        .cp-result-count { font-size: 12px; color: rgba(212,160,23,0.40); white-space: nowrap; flex-shrink: 0; }

        /* ── Main body ───────────────────────── */
        .cp-main {
          flex: 1; min-height: 0; overflow-y: auto;
          padding: 20px 20px 28px;
          scrollbar-width: thin; scrollbar-color: rgba(212,160,23,0.10) transparent;
          max-width: 780px; width: 100%; margin: 0 auto;
        }
        .cp-main::-webkit-scrollbar { width: 4px; }
        .cp-main::-webkit-scrollbar-thumb { background: rgba(212,160,23,0.14); border-radius: 4px; }

        /* Loading / empty */
        .cp-state {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 12px; padding: 80px 20px;
          color: rgba(212,160,23,0.40); font-size: 14px;
        }
        .cp-spinner {
          width: 28px; height: 28px; border-radius: 50%;
          border: 2px solid rgba(212,160,23,0.14);
          border-top-color: #d4a017;
          animation: cp-spin 0.75s linear infinite;
        }
        @keyframes cp-spin { to { transform: rotate(360deg); } }
        .cp-empty { text-align: center; }
        .cp-empty-icon { font-size: 40px; margin-bottom: 8px; display: block; }
        .cp-empty p { margin: 4px 0; font-size: 15px; }
        .cp-empty-sub { font-size: 12px; opacity: .65; }

        /* ── Hadith card ─────────────────────── */
        .cp-card {
          background: rgba(255,255,255,0.022);
          border: 1px solid rgba(212,160,23,0.09);
          border-radius: 18px; padding: 20px 24px;
          margin-bottom: 14px; direction: rtl;
          transition: border-color .20s, background .20s, box-shadow .20s;
        }
        .cp-card:hover {
          border-color: rgba(212,160,23,0.20);
          background: rgba(255,255,255,0.036);
          box-shadow: 0 4px 28px rgba(0,0,0,0.28);
        }

        /* Card top row */
        .cp-card-top {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 16px; gap: 8px;
        }
        .cp-card-ref { display: flex; align-items: baseline; gap: 6px; }
        .cp-ref-label {
          font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
          color: rgba(212,160,23,0.38);
        }
        .cp-ref-num {
          font-family: 'Scheherazade New', serif; font-size: 18px; font-weight: 700;
          color: #d4a017; line-height: 1;
        }
        .cp-card-actions { display: flex; align-items: center; gap: 6px; }

        /* Grade badges */
        .cp-grade {
          font-size: 10px; padding: 2px 9px; border-radius: 10px; border: 1px solid;
          font-weight: 500; letter-spacing: .02em;
        }
        .g-s { color: rgba(60,210,100,0.90);  border-color: rgba(60,210,100,0.30);  background: rgba(60,210,100,0.08);  }
        .g-h { color: rgba(230,180,40,0.90);  border-color: rgba(230,180,40,0.30);  background: rgba(230,180,40,0.08);  }
        .g-d { color: rgba(240,80,60,0.85);   border-color: rgba(240,80,60,0.28);   background: rgba(240,80,60,0.07);   }
        .g-o { color: rgba(212,160,23,0.55);  border-color: rgba(212,160,23,0.20);  background: rgba(212,160,23,0.05);  }

        /* Action buttons */
        .cp-action-btn {
          width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          color: rgba(212,160,23,0.45); display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all .18s;
        }
        .cp-action-btn:hover {
          background: rgba(212,160,23,0.10); border-color: rgba(212,160,23,0.28);
          color: rgba(212,160,23,0.85);
        }
        .cp-action-btn--bookmarked {
          background: rgba(212,160,23,0.14); border-color: rgba(212,160,23,0.42);
          color: #d4a017;
        }

        /* Arabic text */
        .cp-arabic {
          font-family: 'Scheherazade New', serif;
          font-size: clamp(18px, 2.4vw, 26px); font-weight: 600;
          line-height: 2.2; color: #f0e6c8;
          text-align: right; direction: rtl;
          margin: 0 0 16px;
          text-shadow: 0 1px 12px rgba(0,0,0,0.40);
        }

        /* Translation */
        .cp-tr {
          font-size: 14px; line-height: 1.95;
          color: rgba(226,217,197,0.62); text-align: right; direction: rtl;
          margin: 0; padding-top: 14px;
          border-top: 1px solid rgba(212,160,23,0.07);
        }
        .cp-tr--en {
          direction: ltr; text-align: left;
          font-style: italic; font-family: Georgia, serif; font-size: 13.5px;
        }

        /* ── Pagination ───────────────────────── */
        .cp-pager {
          display: flex; align-items: center; justify-content: center; gap: 16px;
          padding: 28px 0 12px; direction: rtl;
        }
        .cp-pager-btn {
          padding: 9px 24px; border-radius: 22px; font-size: 13px;
          background: rgba(212,160,23,0.07); border: 1px solid rgba(212,160,23,0.20);
          color: rgba(212,160,23,0.60); font-family: 'Vazirmatn', sans-serif;
          cursor: pointer; transition: all .18s;
        }
        .cp-pager-btn:hover:not(:disabled) { background: rgba(212,160,23,0.18); color: #d4a017; border-color: rgba(212,160,23,0.46); }
        .cp-pager-btn:disabled { opacity: .22; cursor: default; }
        .cp-pager-info { font-size: 13px; color: rgba(212,160,23,0.40); }

        /* ── Responsive ──────────────────────── */
        @media (max-width: 600px) {
          .cp-header { padding: 10px 14px; }
          .cp-header-gap { width: 60px; }
          .cp-title { font-size: 17px; }
          .cp-search-row { padding: 10px 14px; }
          .cp-main { padding: 14px 12px 24px; }
          .cp-card { padding: 16px; }
          .cp-arabic { font-size: 18px; }
        }
      `}</style>
    </div>
  );
}
