"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Surah {
  number: number;
  name: string;
  englishName: string;
  numberOfAyahs: number;
  revelationType: string;
}

interface Ayah {
  numberInSurah: number;
  arabic: string;
  persian: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toArabic(n: number): string {
  return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]);
}

function revFa(t: string): string {
  return t === 'Meccan' ? 'مکی' : 'مدنی';
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function QuranPage() {
  const router = useRouter();

  const [surahs,        setSurahs]        = useState<Surah[]>([]);
  const [loadingSurahs, setLoadingSurahs] = useState(true);
  const [activeSurah,   setActiveSurah]   = useState<Surah | null>(null);
  const [ayahs,         setAyahs]         = useState<Ayah[]>([]);
  const [loadingAyahs,  setLoadingAyahs]  = useState(false);
  const [errorSurahs,   setErrorSurahs]   = useState(false);

  useEffect(() => {
    fetch('https://api.alquran.cloud/v1/surah')
      .then(r => r.json())
      .then(d => {
        if (d.data) setSurahs(d.data);
        else setErrorSurahs(true);
      })
      .catch(() => setErrorSurahs(true))
      .finally(() => setLoadingSurahs(false));
  }, []);

  const openSurah = useCallback((surah: Surah) => {
    setActiveSurah(surah);
    setAyahs([]);
    setLoadingAyahs(true);
    Promise.all([
      fetch(`https://api.alquran.cloud/v1/surah/${surah.number}`).then(r => r.json()),
      fetch(`https://api.alquran.cloud/v1/surah/${surah.number}/fa.makarem`).then(r => r.json()),
    ])
      .then(([ar, fa]) => {
        const arAyahs = ar.data?.ayahs ?? [];
        const faAyahs = fa.data?.ayahs ?? [];
        setAyahs(arAyahs.map((a: { numberInSurah: number; text: string }, i: number) => ({
          numberInSurah: a.numberInSurah,
          arabic: a.text,
          persian: faAyahs[i]?.text ?? '',
        })));
      })
      .catch(() => {})
      .finally(() => setLoadingAyahs(false));
  }, []);

  const goBack = useCallback(() => {
    if (activeSurah) { setActiveSurah(null); setAyahs([]); }
    else router.push('/');
  }, [activeSurah, router]);

  return (
    <>
      <div className="bg"/>

      <div className="app">

        {/* ── Header ── */}
        <header className="hdr">
          <button className="ibtn" onClick={goBack} aria-label="بازگشت">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15,18 9,12 15,6"/>
            </svg>
          </button>
          <div className="hdr-mid">
            <div className="logo">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </div>
            <div>
              <div className="hdr-title">
                {activeSurah ? activeSurah.name : 'قرآن کریم'}
              </div>
              <div className="hdr-sub">
                {activeSurah
                  ? `${activeSurah.englishName} · ${toArabic(activeSurah.numberOfAyahs)} آیه`
                  : 'Holy Quran · ١١۴ سوره'}
              </div>
            </div>
          </div>
          <div style={{ width: 40 }}/>
        </header>

        {/* ── Surah list ── */}
        {!activeSurah && (
          <div className="scroll">
            {loadingSurahs && (
              <div className="loading-wrap">
                <div className="spinner"/>
                <span>در حال بارگذاری سوره‌ها...</span>
              </div>
            )}
            {errorSurahs && !loadingSurahs && (
              <div className="error-wrap">
                <span>خطا در بارگذاری. اتصال اینترنت را بررسی کنید.</span>
              </div>
            )}
            {!loadingSurahs && !errorSurahs && (
              <div className="surah-list">
                {surahs.map(s => (
                  <button key={s.number} className="surah-row" onClick={() => openSurah(s)}>
                    <div className="surah-num-badge">
                      <span>{toArabic(s.number)}</span>
                    </div>
                    <div className="surah-info">
                      <span className="surah-name">{s.name}</span>
                      <span className="surah-meta">{s.englishName} · {toArabic(s.numberOfAyahs)} آیه</span>
                    </div>
                    <div className={`surah-tag ${s.revelationType === 'Meccan' ? 'tag-mekki' : 'tag-madani'}`}>
                      {revFa(s.revelationType)}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div style={{ height: 32 }}/>
          </div>
        )}

        {/* ── Ayah reader ── */}
        {activeSurah && (
          <div className="scroll">
            {loadingAyahs && (
              <div className="loading-wrap">
                <div className="spinner"/>
                <span>در حال بارگذاری آیات...</span>
              </div>
            )}
            {!loadingAyahs && ayahs.length > 0 && (
              <>
                <div className="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
                <div className="ayah-list">
                  {ayahs.map(a => (
                    <div key={a.numberInSurah} className="ayah-card">
                      <div className="ayah-num-badge">﴾{toArabic(a.numberInSurah)}﴿</div>
                      <p className="ayah-arabic">{a.arabic}</p>
                      {a.persian && <p className="ayah-persian">{a.persian}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}
            <div style={{ height: 32 }}/>
          </div>
        )}
      </div>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #020810; overflow: hidden; }

        .bg {
          position: fixed; inset: 0; z-index: 0;
          background-image: url('https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1080&q=85');
          background-size: cover; background-position: center;
        }
        .bg::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(180deg,
            rgba(2,8,22,0.45) 0%,
            rgba(4,10,24,0.28) 30%,
            rgba(6,4,1,0.40) 65%,
            rgba(4,2,0,0.94) 100%);
        }

        .app {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          z-index: 1; overflow: hidden;
          display: flex; flex-direction: column;
          font-family: 'Vazirmatn', sans-serif; direction: rtl; color: #e8dfc8;
        }

        /* ── header ── */
        .hdr {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; flex-shrink: 0;
          background: rgba(2,8,26,0.82);
          backdrop-filter: blur(22px) saturate(170%);
          border-bottom: 1px solid rgba(212,160,23,0.14);
          box-shadow: 0 8px 40px rgba(0,0,0,0.45);
        }
        .hdr-mid { display: flex; align-items: center; gap: 11px; }
        .logo {
          width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
          background: radial-gradient(circle at 36% 36%, #fff5d0, #d4a017 42%, #7a5200 88%);
          display: flex; align-items: center; justify-content: center;
          color: #3a1e00;
          animation: lp 3.2s ease-in-out infinite;
        }
        @keyframes lp {
          0%,100% { box-shadow: 0 0 14px rgba(212,160,23,.55), 0 0 28px rgba(212,160,23,.28); }
          50%      { box-shadow: 0 0 26px rgba(212,160,23,.85), 0 0 52px rgba(212,160,23,.45); }
        }
        .hdr-title { color: #d4a017; font-weight: 700; font-size: 17px; }
        .hdr-sub   { color: rgba(212,160,23,0.46); font-size: 11px; font-weight: 300; margin-top: 1px; }
        .ibtn {
          width: 40px; height: 40px; border-radius: 50%; border: none;
          background: rgba(255,255,255,0.09); backdrop-filter: blur(14px);
          color: rgba(212,160,23,0.80);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background .2s;
        }
        .ibtn:hover { background: rgba(255,255,255,0.14); }

        /* ── scroll container ── */
        .scroll {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          min-height: 0;
          padding: 14px 14px;
          display: flex; flex-direction: column; gap: 0;
        }
        .scroll::-webkit-scrollbar { width: 3px; }
        .scroll::-webkit-scrollbar-thumb { background: rgba(212,160,23,0.20); border-radius: 2px; }

        /* ── loading / error ── */
        .loading-wrap {
          display: flex; flex-direction: column; align-items: center; gap: 14px;
          padding: 60px 20px;
          color: rgba(212,160,23,0.55); font-size: 14px;
        }
        .error-wrap {
          display: flex; align-items: center; justify-content: center;
          padding: 60px 20px;
          color: rgba(212,160,23,0.55); font-size: 14px;
          text-align: center;
        }
        .spinner {
          width: 32px; height: 32px; border-radius: 50%;
          border: 2.5px solid rgba(212,160,23,0.18);
          border-top-color: rgba(212,160,23,0.75);
          animation: spin 0.9s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pop {
          from { opacity: 0; transform: translateY(8px) scale(.97); }
          to   { opacity: 1; transform: none; }
        }

        /* ── surah list ── */
        .surah-list {
          background: rgba(6,10,24,0.80);
          border: 1px solid rgba(212,160,23,0.14);
          border-radius: 20px; overflow: hidden;
          backdrop-filter: blur(18px);
          animation: pop .35s ease both;
        }
        .surah-row {
          width: 100%; display: flex; align-items: center; gap: 12px;
          padding: 13px 16px;
          background: transparent; border: none;
          border-bottom: 1px solid rgba(212,160,23,0.07);
          cursor: pointer; text-align: right;
          transition: background .15s;
          font-family: 'Vazirmatn', sans-serif;
        }
        .surah-row:last-child { border-bottom: none; }
        .surah-row:hover { background: rgba(212,160,23,0.06); }
        .surah-row:active { background: rgba(212,160,23,0.10); }

        .surah-num-badge {
          width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
          background: rgba(212,160,23,0.10);
          border: 1px solid rgba(212,160,23,0.28);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 600; color: #d4a017;
          font-family: 'Scheherazade New', serif;
        }
        .surah-info {
          flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0;
        }
        .surah-name {
          font-size: 17px; font-weight: 600; color: #e8d5a0;
          font-family: 'Scheherazade New', serif; line-height: 1.3;
        }
        .surah-meta {
          font-size: 11px; font-weight: 300; color: rgba(212,160,23,0.45);
          direction: ltr; text-align: right;
        }
        .surah-tag {
          flex-shrink: 0;
          font-size: 10px; font-weight: 500;
          padding: 3px 9px; border-radius: 20px;
          letter-spacing: .03em;
        }
        .tag-mekki {
          background: rgba(212,160,23,0.12);
          border: 1px solid rgba(212,160,23,0.28);
          color: rgba(212,160,23,0.75);
        }
        .tag-madani {
          background: rgba(100,180,255,0.08);
          border: 1px solid rgba(100,180,255,0.22);
          color: rgba(140,200,255,0.65);
        }

        /* ── bismillah banner ── */
        .bismillah {
          text-align: center;
          font-family: 'Scheherazade New', serif;
          font-size: 24px; color: rgba(212,160,23,0.75);
          padding: 20px 16px 14px;
          text-shadow: 0 0 20px rgba(212,160,23,0.35);
          letter-spacing: .04em;
          animation: pop .3s ease both;
        }

        /* ── ayah list ── */
        .ayah-list {
          display: flex; flex-direction: column; gap: 12px;
          animation: pop .35s ease both;
        }
        .ayah-card {
          background: rgba(6,10,24,0.82);
          border: 1px solid rgba(212,160,23,0.13);
          border-radius: 18px; padding: 18px 18px 16px;
          backdrop-filter: blur(16px);
          display: flex; flex-direction: column; gap: 10px;
          transition: border-color .2s;
        }
        .ayah-card:hover { border-color: rgba(212,160,23,0.25); }

        .ayah-num-badge {
          align-self: flex-end;
          font-family: 'Scheherazade New', serif;
          font-size: 14px; color: rgba(212,160,23,0.55);
          line-height: 1;
        }
        .ayah-arabic {
          font-family: 'Scheherazade New', serif;
          font-size: 22px; line-height: 2;
          color: #f0e6c0;
          text-align: right; direction: rtl;
          letter-spacing: .03em;
          text-shadow: 0 0 12px rgba(212,160,23,0.10);
        }
        .ayah-persian {
          font-size: 13px; font-weight: 300; line-height: 1.9;
          color: rgba(212,160,23,0.52);
          text-align: right; direction: rtl;
          border-top: 1px solid rgba(212,160,23,0.08);
          padding-top: 10px;
        }
      `}</style>
    </>
  );
}
