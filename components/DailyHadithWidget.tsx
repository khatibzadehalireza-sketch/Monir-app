"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

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

function toAr(n: number): string {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[+d]);
}

function dayOfYear(): number {
  const now   = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000);
}

function gradeClass(grade: string | null): string {
  if (!grade) return "";
  const g = grade.toLowerCase();
  if (g === "sahih" || g === "صحیح") return "dh-grade-sahih";
  if (g === "hasan" || g === "حسن")  return "dh-grade-hasan";
  return "dh-grade-other";
}

interface HadithRow {
  collection_key: string;
  hadith_number:  number;
  arabic_text:    string;
  grade:          string | null;
}

interface TranslationRow {
  translated_text: string;
  language:        string;
}

export function DailyHadithWidget({ onClose }: { onClose: () => void }) {
  const [hadith,      setHadith]      = useState<HadithRow | null>(null);
  const [translation, setTranslation] = useState<TranslationRow | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [shareState,  setShareState]  = useState<"idle" | "sharing" | "copied">("idle");
  const [savingImg,   setSavingImg]   = useState(false);
  const storyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const sb = getSupabaseBrowser();

        const { count, error: cErr } = await sb
          .from("library_hadiths")
          .select("*", { count: "exact", head: true });
        if (cErr || !count) throw new Error("خطا در بارگذاری احادیث");

        const offset = dayOfYear() % count;

        const { data: h, error: hErr } = await sb
          .from("library_hadiths")
          .select("collection_key, hadith_number, arabic_text, grade")
          .range(offset, offset)
          .single();
        if (hErr || !h) throw new Error("حدیثی یافت نشد");
        if (!cancelled) setHadith(h);

        // Try Farsi first, fall back to English
        const { data: fa } = await sb
          .from("library_hadith_translations")
          .select("translated_text, language")
          .eq("collection_key", h.collection_key)
          .eq("hadith_number", h.hadith_number)
          .eq("language", "fa")
          .maybeSingle();

        if (fa) {
          if (!cancelled) setTranslation(fa);
        } else {
          const { data: en } = await sb
            .from("library_hadith_translations")
            .select("translated_text, language")
            .eq("collection_key", h.collection_key)
            .eq("hadith_number", h.hadith_number)
            .eq("language", "en")
            .maybeSingle();
          if (!cancelled) setTranslation(en ?? null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "خطایی رخ داد");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const shareText = useCallback(() => {
    if (!hadith) return "";
    const name = COLLECTION_NAMES[hadith.collection_key] ?? hadith.collection_key;
    return [
      hadith.arabic_text,
      "",
      translation?.translated_text ?? "",
      "",
      `— ${name}، حدیث ${toAr(hadith.hadith_number)}`,
      "",
      "از منیر",
    ].join("\n");
  }, [hadith, translation]);

  const handleShare = useCallback(async () => {
    if (!hadith || shareState !== "idle") return;
    const text = shareText();

    if (navigator.share) {
      setShareState("sharing");
      try { await navigator.share({ text }); } catch { /* cancelled */ }
      setShareState("idle");
    } else {
      await navigator.clipboard.writeText(text).catch(() => {});
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 2200);
    }
  }, [hadith, shareState, shareText]);

  const handleSaveImage = useCallback(async () => {
    if (!storyRef.current || savingImg || !hadith) return;
    setSavingImg(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(storyRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#020a1a",
        logging: false,
      });
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `hadith-${hadith.collection_key}-${hadith.hadith_number}.png`;
      link.click();
    } catch { /* silent */ }
    setSavingImg(false);
  }, [hadith, savingImg]);

  const name = hadith ? (COLLECTION_NAMES[hadith.collection_key] ?? hadith.collection_key) : "";

  return (
    <div className="dh">
      <div className="dh-bg" />
      <div className="dh-dim" />

      {/* ── Header ── */}
      <header className="dh-hdr">
        <button className="dh-ibtn" onClick={onClose} aria-label="بستن">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6"  x2="6"  y2="18" />
            <line x1="6"  y1="6"  x2="18" y2="18" />
          </svg>
        </button>

        <div className="dh-hdr-mid">
          <span className="dh-hdr-icon">☽</span>
          <div>
            <div className="dh-hdr-title">حدیث روز</div>
            <div className="dh-hdr-sub">سخنان پیامبر ﷺ</div>
          </div>
        </div>

        <button className="dh-ibtn" onClick={handleShare} aria-label="اشتراک‌گذاری" disabled={!hadith || loading}>
          {shareState === "copied"
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4caf70" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
          }
        </button>
      </header>

      {/* ── Body ── */}
      <div className="dh-body">

        {/* Loading */}
        {loading && (
          <div className="dh-state">
            <div className="dh-spinner" />
            <p className="dh-state-txt">در حال بارگذاری...</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="dh-state">
            <p className="dh-state-txt dh-state-err">⚠ {error}</p>
            <button className="dh-retry" onClick={() => window.location.reload()}>تلاش مجدد</button>
          </div>
        )}

        {/* Content */}
        {!loading && hadith && (
          <>
            {/* Collection + number */}
            <div className="dh-badge-row">
              <span className="dh-badge">{name}</span>
              <span className="dh-num">حدیث {toAr(hadith.hadith_number)}</span>
            </div>

            <div className="dh-ornament">✦ ✦ ✦</div>

            {/* Arabic */}
            <div className="dh-arabic-wrap">
              <p className="dh-arabic">{hadith.arabic_text}</p>
            </div>

            <div className="dh-divider" />

            {/* Translation */}
            {translation
              ? <p className={`dh-tr${translation.language === "en" ? " dh-tr-en" : ""}`}>{translation.translated_text}</p>
              : <p className="dh-no-tr">ترجمه فارسی در دسترس نیست</p>
            }

            {/* Source badge */}
            <div className="dh-meta">
              <span className="dh-source">{name}، حدیث {toAr(hadith.hadith_number)}</span>
              {hadith.grade && (
                <span className={`dh-grade ${gradeClass(hadith.grade)}`}>{hadith.grade}</span>
              )}
            </div>

            {/* Actions */}
            <div className="dh-actions">
              <button
                className="dh-action-btn dh-share-btn"
                onClick={handleShare}
                disabled={shareState === "sharing"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                {shareState === "copied" ? "کپی شد ✓" : shareState === "sharing" ? "..." : "اشتراک‌گذاری"}
              </button>

              <button
                className="dh-action-btn dh-img-btn"
                onClick={handleSaveImage}
                disabled={savingImg}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                {savingImg ? "در حال ذخیره..." : "ذخیره به عنوان تصویر"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Offscreen story card captured by html2canvas ── */}
      {hadith && (
        <div ref={storyRef} className="dh-story" aria-hidden="true">
          {/* Allah calligraphy watermark */}
          <div className="dh-story-wm">ﷲ</div>

          <div className="dh-story-inner">
            <div className="dh-story-badge">{name} · {toAr(hadith.hadith_number)}</div>
            <div className="dh-story-ornament">✦ ✦ ✦</div>
            <p className="dh-story-arabic">{hadith.arabic_text}</p>
            <div className="dh-story-divider" />
            {translation && (
              <p className="dh-story-fa">{translation.translated_text}</p>
            )}
            <div className="dh-story-footer">
              <span className="dh-story-brand">از منیر</span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .dh {
          position: fixed; inset: 0; z-index: 200;
          display: flex; flex-direction: column; align-items: center;
          font-family: 'Vazirmatn', sans-serif; direction: rtl; color: #e8dfc8;
          overflow: hidden; -webkit-user-select: none; user-select: none;
        }

        /* Background */
        .dh-bg {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 50% 0%, #0d1a3a 0%, #020a1a 60%, #000 100%);
        }
        .dh-dim {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(2,5,18,0.85) 0%, rgba(1,3,12,0.40) 50%, rgba(2,3,10,0.92) 100%);
        }

        /* Header */
        .dh-hdr {
          position: relative; z-index: 2; flex-shrink: 0;
          width: 100%; display: flex; align-items: center; justify-content: space-between;
          padding: 12px 14px;
          background: rgba(2,6,20,0.85); backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(212,160,23,0.15);
        }
        .dh-ibtn {
          width: 40px; height: 40px; border-radius: 50%;
          background: rgba(255,255,255,0.07); border: 1px solid rgba(212,160,23,0.12);
          color: rgba(212,160,23,0.65); flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background .2s, color .2s, border-color .2s;
        }
        .dh-ibtn:hover:not(:disabled) { background: rgba(212,160,23,0.14); border-color: rgba(212,160,23,0.40); color: #d4a017; }
        .dh-ibtn:disabled { opacity: 0.35; cursor: default; }
        .dh-hdr-mid  { display: flex; align-items: center; gap: 10px; }
        .dh-hdr-icon { font-size: 20px; color: #d4a017; }
        .dh-hdr-title { font-size: 15px; font-weight: 600; color: #d4a017; }
        .dh-hdr-sub   { font-size: 11px; color: rgba(212,160,23,0.45); margin-top: 2px; }

        /* Body */
        .dh-body {
          position: relative; z-index: 1;
          flex: 1; min-height: 0; width: 100%; max-width: 520px;
          display: flex; flex-direction: column; align-items: center;
          padding: 20px 24px 24px; overflow-y: auto;
          scrollbar-width: none;
        }
        .dh-body::-webkit-scrollbar { display: none; }

        /* Loading / error state */
        .dh-state {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 16px; padding: 60px 0;
        }
        .dh-spinner {
          width: 36px; height: 36px; border-radius: 50%;
          border: 2px solid rgba(212,160,23,0.15);
          border-top-color: #d4a017;
          animation: dh-spin 0.8s linear infinite;
        }
        @keyframes dh-spin { to { transform: rotate(360deg); } }
        .dh-state-txt { font-size: 14px; color: rgba(212,160,23,0.50); text-align: center; }
        .dh-state-err { color: rgba(255,120,100,0.75); }
        .dh-retry {
          margin-top: 4px; padding: 8px 22px; border-radius: 20px;
          background: rgba(212,160,23,0.10); border: 1px solid rgba(212,160,23,0.28);
          color: rgba(212,160,23,0.70); font-family: 'Vazirmatn', sans-serif; font-size: 13px;
          cursor: pointer; transition: all .18s;
        }
        .dh-retry:hover { background: rgba(212,160,23,0.20); color: #d4a017; }

        /* Badge row */
        .dh-badge-row {
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
          justify-content: center; margin-bottom: 4px;
        }
        .dh-badge {
          font-size: 12px; padding: 4px 14px; border-radius: 20px;
          background: rgba(212,160,23,0.10); border: 1px solid rgba(212,160,23,0.28);
          color: #d4a017; letter-spacing: 0.04em;
        }
        .dh-num { font-size: 12px; color: rgba(212,160,23,0.50); }

        /* Ornament */
        .dh-ornament {
          font-size: 10px; letter-spacing: .40em;
          color: rgba(212,160,23,0.28); margin: 14px 0 18px;
        }

        /* Arabic */
        .dh-arabic-wrap { width: 100%; }
        .dh-arabic {
          font-family: 'Scheherazade New', serif;
          font-size: clamp(20px, 5.5vw, 30px); font-weight: 600;
          line-height: 2.1; color: #f5ecd0;
          text-align: center; direction: rtl;
          text-shadow: 0 0 40px rgba(212,160,23,0.18), 0 2px 10px rgba(0,0,0,0.60);
        }

        /* Divider */
        .dh-divider {
          width: 56px; height: 1px; margin: 20px auto;
          background: linear-gradient(90deg, transparent, rgba(212,160,23,0.35), transparent);
        }

        /* Translation */
        .dh-tr {
          font-size: 15px; line-height: 1.90; font-weight: 400;
          color: rgba(240,230,192,0.80); text-align: center; direction: rtl;
          width: 100%;
        }
        .dh-tr-en { direction: ltr; text-align: center; font-family: Georgia, serif; font-style: italic; }
        .dh-no-tr { font-size: 13px; color: rgba(212,160,23,0.30); text-align: center; }

        /* Meta */
        .dh-meta {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
          justify-content: center; margin-top: 20px;
        }
        .dh-source { font-size: 11px; color: rgba(212,160,23,0.48); }
        .dh-grade  {
          font-size: 10px; padding: 2px 9px; border-radius: 10px;
          border: 1px solid; letter-spacing: .04em;
        }
        .dh-grade-sahih { color: rgba(80,200,120,0.80); border-color: rgba(80,200,120,0.28); background: rgba(80,200,120,0.08); }
        .dh-grade-hasan { color: rgba(100,180,255,0.75); border-color: rgba(100,180,255,0.26); background: rgba(100,180,255,0.07); }
        .dh-grade-other { color: rgba(212,160,23,0.55); border-color: rgba(212,160,23,0.22); background: rgba(212,160,23,0.06); }

        /* Action buttons */
        .dh-actions {
          display: flex; gap: 10px; margin-top: 28px; flex-wrap: wrap; justify-content: center;
        }
        .dh-action-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 11px 20px; border-radius: 24px;
          font-family: 'Vazirmatn', sans-serif; font-size: 13px;
          cursor: pointer; transition: all .20s; border: 1px solid;
        }
        .dh-share-btn {
          background: rgba(212,160,23,0.10); border-color: rgba(212,160,23,0.30);
          color: rgba(212,160,23,0.80);
        }
        .dh-share-btn:hover:not(:disabled) { background: rgba(212,160,23,0.20); border-color: rgba(212,160,23,0.55); color: #d4a017; }
        .dh-img-btn {
          background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.12);
          color: rgba(232,223,200,0.65);
        }
        .dh-img-btn:hover:not(:disabled) { background: rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.22); color: #e8dfc8; }
        .dh-action-btn:disabled { opacity: 0.40; cursor: default; }

        /* ── Story card (offscreen, captured by html2canvas) ── */
        .dh-story {
          position: fixed;
          left: -4000px; top: 0;
          width: 360px; height: 640px;
          background: #020a1a;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          font-family: 'Vazirmatn', sans-serif;
          direction: rtl;
        }

        /* Watermark */
        .dh-story-wm {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Scheherazade New', serif;
          font-size: 280px; line-height: 1;
          color: rgba(212,160,23,0.06);
          pointer-events: none; user-select: none;
          letter-spacing: -0.02em;
        }

        /* Story inner */
        .dh-story-inner {
          position: relative; z-index: 1;
          width: 100%; padding: 48px 36px;
          display: flex; flex-direction: column; align-items: center;
          gap: 0;
        }

        .dh-story-badge {
          font-size: 11px; padding: 4px 16px; border-radius: 20px;
          background: rgba(212,160,23,0.12); border: 1px solid rgba(212,160,23,0.32);
          color: rgba(212,160,23,0.85); margin-bottom: 20px;
        }
        .dh-story-ornament {
          font-size: 9px; letter-spacing: .40em;
          color: rgba(212,160,23,0.30); margin-bottom: 20px;
        }
        .dh-story-arabic {
          font-family: 'Scheherazade New', serif;
          font-size: 22px; font-weight: 600; line-height: 2.2;
          color: #f5ecd0; text-align: center; direction: rtl;
          margin: 0;
          text-shadow: 0 0 30px rgba(212,160,23,0.20);
        }
        .dh-story-divider {
          width: 50px; height: 1px; margin: 20px auto;
          background: linear-gradient(90deg, transparent, rgba(212,160,23,0.40), transparent);
        }
        .dh-story-fa {
          font-size: 14px; line-height: 1.95; font-weight: 400;
          color: rgba(240,230,192,0.75); text-align: center; direction: rtl;
          margin: 0;
        }
        .dh-story-footer {
          margin-top: 32px;
          display: flex; align-items: center; justify-content: center;
        }
        .dh-story-brand {
          font-size: 13px; color: rgba(212,160,23,0.45);
          letter-spacing: 0.08em; padding: 5px 18px;
          border: 1px solid rgba(212,160,23,0.18); border-radius: 20px;
        }
      `}</style>
    </div>
  );
}
