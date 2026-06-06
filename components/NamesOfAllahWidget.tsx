"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface Name {
  num:    number;
  arabic: string;
  trans:  string;
  fa:     string;
}

const NAMES: Name[] = [
  { num:  1, arabic: 'الرَّحْمَٰن',         trans: 'Ar-Raḥmān',           fa: 'بخشنده‌ی فراگیر' },
  { num:  2, arabic: 'الرَّحِيم',            trans: 'Ar-Raḥīm',            fa: 'مهربان بی‌پایان' },
  { num:  3, arabic: 'الْمَلِك',             trans: 'Al-Malik',             fa: 'پادشاه' },
  { num:  4, arabic: 'الْقُدُّوس',           trans: 'Al-Quddūs',            fa: 'پاک و مقدس' },
  { num:  5, arabic: 'السَّلَام',            trans: 'As-Salām',             fa: 'صلح‌دهنده' },
  { num:  6, arabic: 'الْمُؤْمِن',           trans: "Al-Mu'min",            fa: 'امان‌بخش' },
  { num:  7, arabic: 'الْمُهَيْمِن',         trans: 'Al-Muhaymin',          fa: 'نگهبان' },
  { num:  8, arabic: 'الْعَزِيز',            trans: "Al-'Azīz",             fa: 'شکست‌ناپذیر' },
  { num:  9, arabic: 'الْجَبَّار',           trans: 'Al-Jabbār',            fa: 'جبران‌کننده‌ی هر شکستگی' },
  { num: 10, arabic: 'الْمُتَكَبِّر',        trans: 'Al-Mutakabbir',        fa: 'شایسته‌ی بزرگی' },
  { num: 11, arabic: 'الْخَالِق',            trans: 'Al-Khāliq',            fa: 'آفریننده' },
  { num: 12, arabic: 'الْبَارِئ',            trans: "Al-Bāri'",             fa: 'سازنده‌ی هستی' },
  { num: 13, arabic: 'الْمُصَوِّر',          trans: 'Al-Muṣawwir',          fa: 'شکل‌دهنده' },
  { num: 14, arabic: 'الْغَفَّار',           trans: 'Al-Ghaffār',           fa: 'بسیار آمرزنده' },
  { num: 15, arabic: 'الْقَهَّار',           trans: 'Al-Qahhār',            fa: 'چیره بر همه چیز' },
  { num: 16, arabic: 'الْوَهَّاب',           trans: 'Al-Wahhāb',            fa: 'بسیار بخشنده' },
  { num: 17, arabic: 'الرَّزَّاق',           trans: 'Ar-Razzāq',            fa: 'روزی‌دهنده' },
  { num: 18, arabic: 'الْفَتَّاح',           trans: 'Al-Fattāḥ',            fa: 'گشاینده' },
  { num: 19, arabic: 'الْعَلِيم',            trans: "Al-'Alīm",             fa: 'دانای مطلق' },
  { num: 20, arabic: 'الْقَابِض',            trans: 'Al-Qābiḍ',             fa: 'گیرنده' },
  { num: 21, arabic: 'الْبَاسِط',            trans: 'Al-Bāsiṭ',             fa: 'گسترنده' },
  { num: 22, arabic: 'الْخَافِض',            trans: 'Al-Khāfiḍ',            fa: 'پایین‌آورنده' },
  { num: 23, arabic: 'الرَّافِع',            trans: "Ar-Rāfi'",             fa: 'بالابرنده' },
  { num: 24, arabic: 'الْمُعِز',             trans: "Al-Mu'izz",            fa: 'عزت‌دهنده' },
  { num: 25, arabic: 'الْمُذِل',             trans: 'Al-Mudhill',           fa: 'خوارکننده‌ی ستمگر' },
  { num: 26, arabic: 'السَّمِيع',            trans: "As-Samī'",             fa: 'شنوا' },
  { num: 27, arabic: 'الْبَصِير',            trans: 'Al-Baṣīr',             fa: 'بینا' },
  { num: 28, arabic: 'الْحَكَم',             trans: 'Al-Ḥakam',             fa: 'داور' },
  { num: 29, arabic: 'الْعَدْل',             trans: "Al-'Adl",              fa: 'عدالت مطلق' },
  { num: 30, arabic: 'اللَّطِيف',            trans: 'Al-Laṭīf',             fa: 'مهربان و ظریف‌بین' },
  { num: 31, arabic: 'الْخَبِير',            trans: 'Al-Khabīr',            fa: 'آگاه از همه چیز' },
  { num: 32, arabic: 'الْحَلِيم',            trans: 'Al-Ḥalīm',             fa: 'بردبار' },
  { num: 33, arabic: 'الْعَظِيم',            trans: "Al-'Aẓīm",             fa: 'بزرگ' },
  { num: 34, arabic: 'الْغَفُور',            trans: 'Al-Ghafūr',            fa: 'بسیار آمرزنده' },
  { num: 35, arabic: 'الشَّكُور',            trans: 'Ash-Shakūr',           fa: 'قدردان' },
  { num: 36, arabic: 'الْعَلِيّ',            trans: "Al-'Alī",              fa: 'برتر از همه' },
  { num: 37, arabic: 'الْكَبِير',            trans: 'Al-Kabīr',             fa: 'بزرگ‌منش' },
  { num: 38, arabic: 'الْحَفِيظ',            trans: 'Al-Ḥafīẓ',             fa: 'نگهدارنده' },
  { num: 39, arabic: 'الْمُقِيت',            trans: 'Al-Muqīt',             fa: 'حفظ‌کننده و نگهدارنده' },
  { num: 40, arabic: 'الْحَسِيب',            trans: 'Al-Ḥasīb',             fa: 'محاسب اعمال' },
  { num: 41, arabic: 'الْجَلِيل',            trans: 'Al-Jalīl',             fa: 'جلیل‌القدر' },
  { num: 42, arabic: 'الْكَرِيم',            trans: 'Al-Karīm',             fa: 'کریم و بخشنده' },
  { num: 43, arabic: 'الرَّقِيب',            trans: 'Ar-Raqīb',             fa: 'مراقب همیشگی' },
  { num: 44, arabic: 'الْمُجِيب',            trans: 'Al-Mujīb',             fa: 'پاسخ‌دهنده به دعا' },
  { num: 45, arabic: 'الْوَاسِع',            trans: "Al-Wāsi'",             fa: 'گسترده رحمت' },
  { num: 46, arabic: 'الْحَكِيم',            trans: 'Al-Ḥakīm',             fa: 'فرزانه' },
  { num: 47, arabic: 'الْوَدُود',            trans: 'Al-Wadūd',             fa: 'دوستدار بندگان' },
  { num: 48, arabic: 'الْمَجِيد',            trans: 'Al-Majīd',             fa: 'باشکوه' },
  { num: 49, arabic: 'الْبَاعِث',            trans: "Al-Bā'ith",            fa: 'برانگیزنده' },
  { num: 50, arabic: 'الشَّهِيد',            trans: 'Ash-Shahīd',           fa: 'گواه بر همه چیز' },
  { num: 51, arabic: 'الْحَق',              trans: 'Al-Ḥaqq',              fa: 'حقیقت مطلق' },
  { num: 52, arabic: 'الْوَكِيل',            trans: 'Al-Wakīl',             fa: 'وکیل و نگهبان' },
  { num: 53, arabic: 'الْقَوِيّ',            trans: 'Al-Qawī',              fa: 'نیرومند' },
  { num: 54, arabic: 'الْمَتِين',            trans: 'Al-Matīn',             fa: 'استوار و محکم' },
  { num: 55, arabic: 'الْوَلِيّ',            trans: 'Al-Walī',              fa: 'سرپرست و یاور' },
  { num: 56, arabic: 'الْحَمِيد',            trans: 'Al-Ḥamīd',             fa: 'ستوده' },
  { num: 57, arabic: 'الْمُحْصِي',           trans: 'Al-Muḥṣī',             fa: 'شمارنده‌ی همه چیز' },
  { num: 58, arabic: 'الْمُبْدِئ',           trans: "Al-Mubdi'",            fa: 'آغازکننده' },
  { num: 59, arabic: 'الْمُعِيد',            trans: "Al-Mu'īd",             fa: 'بازگرداننده' },
  { num: 60, arabic: 'الْمُحْيِي',           trans: 'Al-Muḥyī',             fa: 'زنده‌کننده' },
  { num: 61, arabic: 'الْمُمِيت',            trans: 'Al-Mumīt',             fa: 'میراننده' },
  { num: 62, arabic: 'الْحَيّ',              trans: 'Al-Ḥayy',              fa: 'زنده‌ی جاودان' },
  { num: 63, arabic: 'الْقَيُّوم',           trans: 'Al-Qayyūm',            fa: 'پاینده و قائم بالذات' },
  { num: 64, arabic: 'الْوَاجِد',            trans: 'Al-Wājid',             fa: 'یابنده‌ی همه چیز' },
  { num: 65, arabic: 'الْمَاجِد',            trans: 'Al-Mājid',             fa: 'شریف و بزرگوار' },
  { num: 66, arabic: 'الْوَاحِد',            trans: 'Al-Wāḥid',             fa: 'یگانه' },
  { num: 67, arabic: 'الْأَحَد',             trans: 'Al-Aḥad',              fa: 'یکتا' },
  { num: 68, arabic: 'الصَّمَد',             trans: 'Aṣ-Ṣamad',             fa: 'بی‌نیاز مطلق' },
  { num: 69, arabic: 'الْقَادِر',            trans: 'Al-Qādir',             fa: 'توانا' },
  { num: 70, arabic: 'الْمُقْتَدِر',         trans: 'Al-Muqtadir',          fa: 'قدرتمند مطلق' },
  { num: 71, arabic: 'الْمُقَدِّم',          trans: 'Al-Muqaddim',          fa: 'پیش‌برنده' },
  { num: 72, arabic: 'الْمُؤَخِّر',          trans: "Al-Mu'akhkhir",        fa: 'به تأخیر اندازنده' },
  { num: 73, arabic: 'الْأَوَّل',            trans: 'Al-Awwal',             fa: 'نخستین' },
  { num: 74, arabic: 'الْآخِر',             trans: 'Al-Ākhir',             fa: 'پسین' },
  { num: 75, arabic: 'الظَّاهِر',            trans: 'Aẓ-Ẓāhir',            fa: 'آشکار' },
  { num: 76, arabic: 'الْبَاطِن',            trans: 'Al-Bāṭin',             fa: 'پنهان' },
  { num: 77, arabic: 'الْوَالِي',            trans: 'Al-Wālī',              fa: 'حاکم و والی' },
  { num: 78, arabic: 'الْمُتَعَالِي',        trans: "Al-Muta'ālī",          fa: 'برتر از همه وصف‌ها' },
  { num: 79, arabic: 'الْبَرّ',              trans: 'Al-Barr',              fa: 'نیکوکار' },
  { num: 80, arabic: 'التَّوَّاب',           trans: 'At-Tawwāb',            fa: 'توبه‌پذیر' },
  { num: 81, arabic: 'الْمُنْتَقِم',         trans: 'Al-Muntaqim',          fa: 'انتقام‌گیرنده از ستمگران' },
  { num: 82, arabic: 'الْعَفُوّ',            trans: "Al-'Afuww",            fa: 'عفوکننده' },
  { num: 83, arabic: 'الرَّؤُوف',            trans: "Ar-Ra'ūf",             fa: 'مهربان‌ترین' },
  { num: 84, arabic: 'مَالِكُ الْمُلْك',     trans: 'Mālik Al-Mulk',        fa: 'صاحب پادشاهی' },
  { num: 85, arabic: 'ذُو الْجَلَالِ وَالْإِكْرَام', trans: 'Dhul-Jalāl Wal-Ikrām', fa: 'صاحب جلال و بزرگواری' },
  { num: 86, arabic: 'الْمُقْسِط',           trans: 'Al-Muqsiṭ',            fa: 'دادگر' },
  { num: 87, arabic: 'الْجَامِع',            trans: "Al-Jāmi'",             fa: 'گردآورنده' },
  { num: 88, arabic: 'الْغَنِيّ',            trans: 'Al-Ghanī',             fa: 'بی‌نیاز' },
  { num: 89, arabic: 'الْمُغْنِي',           trans: 'Al-Mughnī',            fa: 'بی‌نیاز‌کننده' },
  { num: 90, arabic: 'الْمَانِع',            trans: "Al-Māni'",             fa: 'بازدارنده از شر' },
  { num: 91, arabic: 'الضَّارّ',             trans: 'Aḍ-Ḍārr',             fa: 'زیان‌رساننده به فرمان الهی' },
  { num: 92, arabic: 'النَّافِع',            trans: "An-Nāfi'",             fa: 'سودرساننده' },
  { num: 93, arabic: 'النُّور',              trans: 'An-Nūr',              fa: 'نور' },
  { num: 94, arabic: 'الْهَادِي',            trans: 'Al-Hādī',              fa: 'راهنما' },
  { num: 95, arabic: 'الْبَدِيع',            trans: "Al-Badī'",             fa: 'بی‌نظیر در آفرینش' },
  { num: 96, arabic: 'الْبَاقِي',            trans: 'Al-Bāqī',              fa: 'ماندگار' },
  { num: 97, arabic: 'الْوَارِث',            trans: 'Al-Wārith',            fa: 'وارث همه چیز' },
  { num: 98, arabic: 'الرَّشِيد',            trans: 'Ar-Rashīd',            fa: 'هدایتگر به راه راست' },
  { num: 99, arabic: 'الصَّبُور',            trans: 'Aṣ-Ṣabūr',            fa: 'شکیبا' },
];

function toAr(n: number): string {
  return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]);
}

function dailyIndex(): number {
  const now   = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff  = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86_400_000);
  return dayOfYear % 99;
}

type View = 'card' | 'grid';

export function NamesOfAllahWidget({ onClose }: { onClose: () => void }) {
  const [idx,     setIdx]     = useState<number>(dailyIndex);
  const [view,    setView]    = useState<View>('card');
  const [query,   setQuery]   = useState('');
  const [leaving, setLeaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? NAMES.filter(n =>
        n.arabic.includes(query) ||
        n.trans.toLowerCase().includes(query.toLowerCase()) ||
        n.fa.includes(query)
      )
    : NAMES;

  const navigate = useCallback((dir: 1 | -1) => {
    setLeaving(true);
    setTimeout(() => {
      setIdx(i => (i + dir + NAMES.length) % NAMES.length);
      setLeaving(false);
    }, 220);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (view !== 'card' || document.activeElement === searchRef.current) return;
      if (e.key === 'ArrowRight') navigate(-1);
      if (e.key === 'ArrowLeft')  navigate(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, navigate]);

  const current = NAMES[idx];

  return (
    <div className="na">
      {/* ── Background ── */}
      <div className="na-bg"/>
      <div className="na-dim"/>

      {/* ── Header ── */}
      <header className="na-hdr">
        <button className="na-ibtn" onClick={onClose} aria-label="بستن">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6"  x2="6"  y2="18"/>
            <line x1="6"  y1="6"  x2="18" y2="18"/>
          </svg>
        </button>

        <div className="na-hdr-mid">
          <span className="na-hdr-icon">✦</span>
          <div>
            <div className="na-hdr-title">أسماء الله الحسنى</div>
            <div className="na-hdr-sub">نام‌های نیکوی الهی · ۹۹ نام</div>
          </div>
        </div>

        <button
          className={`na-ibtn na-view-btn${view === 'grid' ? ' na-active' : ''}`}
          onClick={() => setView(v => v === 'card' ? 'grid' : 'card')}
          aria-label="تغییر نما"
        >
          {view === 'card'
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          }
        </button>
      </header>

      {/* ── Search ── */}
      <div className="na-search-wrap">
        <svg className="na-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          ref={searchRef}
          className="na-search"
          placeholder="جستجو..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          dir="rtl"
        />
        {query && (
          <button className="na-search-clear" onClick={() => setQuery('')}>×</button>
        )}
      </div>

      {/* ── Grid view ── */}
      {view === 'grid' && (
        <div className="na-grid">
          {filtered.map(n => (
            <button
              key={n.num}
              className={`na-grid-cell${n.num === current.num ? ' na-grid-active' : ''}`}
              onClick={() => { setIdx(n.num - 1); setView('card'); setQuery(''); }}
            >
              <span className="na-grid-num">{toAr(n.num)}</span>
              <span className="na-grid-ar">{n.arabic}</span>
              <span className="na-grid-fa">{n.fa}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="na-empty">نامی یافت نشد</p>
          )}
        </div>
      )}

      {/* ── Card view ── */}
      {view === 'card' && (
        <>
          {/* Progress dots (compressed) */}
          <div className="na-prog-wrap">
            <div className="na-prog-bar">
              <div className="na-prog-fill" style={{ width: `${((idx + 1) / 99) * 100}%` }}/>
            </div>
            <span className="na-prog-lbl">{toAr(idx + 1)} / ٩٩</span>
          </div>

          {/* Card */}
          <div className={`na-card${leaving ? ' na-leaving' : ''}`}>
            <div className="na-badge">{toAr(current.num)}</div>

            <div className="na-arabic-wrap">
              <p className="na-arabic">{current.arabic}</p>
            </div>

            <p className="na-trans">{current.trans}</p>

            <div className="na-divider"/>

            <p className="na-meaning">{current.fa}</p>
          </div>

          {/* Navigation */}
          <div className="na-nav">
            <button className="na-nav-btn" onClick={() => navigate(-1)} aria-label="قبلی">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>

            <button
              className="na-daily-btn"
              onClick={() => { setIdx(dailyIndex()); setLeaving(false); }}
              title="نام روز"
            >
              نام روز
            </button>

            <button className="na-nav-btn" onClick={() => navigate(1)} aria-label="بعدی">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>

          {/* Quick jump grid (mini) */}
          {!query && (
            <div className="na-quick">
              {NAMES.map(n => (
                <button
                  key={n.num}
                  className={`na-dot${n.num === current.num ? ' na-dot-active' : ''}`}
                  onClick={() => setIdx(n.num - 1)}
                  aria-label={n.arabic}
                />
              ))}
            </div>
          )}
        </>
      )}

      <style>{`
        .na {
          position: fixed; inset: 0; z-index: 200;
          display: flex; flex-direction: column; align-items: center;
          font-family: 'Vazirmatn', sans-serif; direction: rtl; color: #e8dfc8;
          overflow: hidden; user-select: none; -webkit-user-select: none;
        }

        /* ── background ── */
        .na-bg {
          position: absolute; inset: 0;
          background-image: url('https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1080&q=85');
          background-size: cover; background-position: center;
        }
        .na-dim {
          position: absolute; inset: 0;
          background: linear-gradient(180deg,
            rgba(2,5,18,0.88) 0%,
            rgba(3,7,22,0.65) 35%,
            rgba(4,2,0,0.94) 100%);
        }

        /* ── header ── */
        .na-hdr {
          position: relative; z-index: 2;
          width: 100%;
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 14px;
          background: rgba(2,6,20,0.80);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(212,160,23,0.14);
          flex-shrink: 0;
        }
        .na-ibtn {
          width: 40px; height: 40px; border-radius: 50%; border: none;
          background: rgba(255,255,255,0.09); backdrop-filter: blur(14px);
          color: rgba(212,160,23,0.72);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background .2s; flex-shrink: 0;
        }
        .na-ibtn:hover { background: rgba(255,255,255,0.15); }
        .na-ibtn.na-active { background: rgba(212,160,23,0.18); color: #d4a017; }
        .na-hdr-mid { display: flex; align-items: center; gap: 10px; }
        .na-hdr-icon { font-size: 20px; color: #d4a017; }
        .na-hdr-title { font-size: 15px; font-weight: 600; color: #d4a017; }
        .na-hdr-sub   { font-size: 11px; color: rgba(212,160,23,0.44); margin-top: 1px; }

        /* ── search ── */
        .na-search-wrap {
          position: relative; z-index: 2;
          width: 100%; display: flex; align-items: center;
          padding: 8px 14px;
          background: rgba(2,6,20,0.60); backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(212,160,23,0.10);
          flex-shrink: 0; gap: 8px;
        }
        .na-search-icon { color: rgba(212,160,23,0.40); flex-shrink: 0; }
        .na-search {
          flex: 1; background: transparent; border: none; outline: none;
          color: #e8dfc8; font-family: 'Vazirmatn', sans-serif; font-size: 14px;
          direction: rtl;
        }
        .na-search::placeholder { color: rgba(212,160,23,0.30); }
        .na-search-clear {
          border: none; background: transparent;
          color: rgba(212,160,23,0.45); font-size: 18px; line-height: 1;
          cursor: pointer; padding: 0 4px; flex-shrink: 0;
        }
        .na-search-clear:hover { color: rgba(212,160,23,0.80); }

        /* ── grid view ── */
        .na-grid {
          position: relative; z-index: 1;
          flex: 1; width: 100%; overflow-y: auto;
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 6px; padding: 10px 10px 20px;
          scrollbar-width: thin; scrollbar-color: rgba(212,160,23,0.20) transparent;
        }
        .na-grid::-webkit-scrollbar { width: 4px; }
        .na-grid::-webkit-scrollbar-thumb { background: rgba(212,160,23,0.20); border-radius: 4px; }
        .na-grid-cell {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          padding: 10px 6px; border-radius: 14px;
          background: rgba(212,160,23,0.05);
          border: 1px solid rgba(212,160,23,0.14);
          cursor: pointer; transition: all .18s;
        }
        .na-grid-cell:hover { background: rgba(212,160,23,0.12); border-color: rgba(212,160,23,0.32); }
        .na-grid-cell.na-grid-active {
          background: rgba(212,160,23,0.18);
          border-color: rgba(212,160,23,0.55);
          box-shadow: 0 0 14px rgba(212,160,23,0.20);
        }
        .na-grid-num { font-size: 9px; color: rgba(212,160,23,0.40); }
        .na-grid-ar  { font-family: 'Scheherazade New', serif; font-size: 15px; color: #f0e6c0; text-align: center; }
        .na-grid-fa  { font-size: 9px; color: rgba(212,160,23,0.48); text-align: center; }
        .na-empty {
          grid-column: 1/-1; text-align: center;
          color: rgba(212,160,23,0.38); font-size: 14px;
          padding: 40px 0;
        }

        /* ── card view: progress bar ── */
        .na-prog-wrap {
          position: relative; z-index: 2;
          width: 100%; display: flex; align-items: center; gap: 10px;
          padding: 8px 16px; flex-shrink: 0;
        }
        .na-prog-bar {
          flex: 1; height: 3px; border-radius: 3px;
          background: rgba(212,160,23,0.12); overflow: hidden;
        }
        .na-prog-fill {
          height: 100%; border-radius: 3px;
          background: linear-gradient(90deg, rgba(212,160,23,0.5), #d4a017);
          transition: width .5s cubic-bezier(.22,.68,0,1.2);
          box-shadow: 0 0 6px rgba(212,160,23,0.40);
        }
        .na-prog-lbl {
          font-size: 11px; color: rgba(212,160,23,0.44);
          white-space: nowrap; flex-shrink: 0;
          font-family: 'Scheherazade New', serif;
        }

        /* ── card ── */
        .na-card {
          position: relative; z-index: 1;
          flex: 1; min-height: 0;
          width: 100%; max-width: 480px;
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 0;
          padding: 16px 24px 8px;
          transition: opacity .22s ease, transform .22s ease;
        }
        .na-card.na-leaving { opacity: 0; transform: translateX(-20px); }

        .na-badge {
          font-family: 'Scheherazade New', serif;
          font-size: 13px; color: rgba(212,160,23,0.55);
          background: rgba(212,160,23,0.10);
          border: 1px solid rgba(212,160,23,0.22);
          border-radius: 50%; width: 34px; height: 34px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 18px; flex-shrink: 0;
        }

        .na-arabic-wrap {
          width: 100%; display: flex; justify-content: center;
          flex-shrink: 0;
        }
        .na-arabic {
          font-family: 'Scheherazade New', serif;
          font-size: 46px; font-weight: 700; line-height: 1.3;
          color: #f5ecd0; text-align: center; direction: rtl;
          text-shadow: 0 0 40px rgba(212,160,23,0.28), 0 2px 8px rgba(0,0,0,0.50);
          letter-spacing: .01em;
        }

        .na-trans {
          font-size: 13px; letter-spacing: .08em;
          color: rgba(212,160,23,0.48);
          margin-top: 10px; text-align: center; direction: ltr;
          flex-shrink: 0;
        }

        .na-divider {
          width: 48px; height: 1px;
          background: rgba(212,160,23,0.18);
          margin: 18px auto;
          flex-shrink: 0;
        }

        .na-meaning {
          font-size: 18px; font-weight: 500; line-height: 1.6;
          color: rgba(240,230,192,0.82);
          text-align: center; direction: rtl;
          flex-shrink: 0;
        }

        /* ── navigation ── */
        .na-nav {
          position: relative; z-index: 2;
          display: flex; align-items: center; gap: 18px;
          margin-bottom: 8px; flex-shrink: 0;
        }
        .na-nav-btn {
          width: 48px; height: 48px; border-radius: 50%; border: none;
          background: rgba(212,160,23,0.10);
          border: 1px solid rgba(212,160,23,0.22);
          color: rgba(212,160,23,0.72);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all .18s;
        }
        .na-nav-btn:hover {
          background: rgba(212,160,23,0.20);
          border-color: rgba(212,160,23,0.50);
          color: #d4a017;
        }
        .na-daily-btn {
          padding: 10px 22px; border-radius: 22px;
          background: rgba(212,160,23,0.10);
          border: 1px solid rgba(212,160,23,0.28);
          color: rgba(212,160,23,0.65);
          font-family: 'Vazirmatn', sans-serif; font-size: 13px;
          cursor: pointer; transition: all .18s;
        }
        .na-daily-btn:hover {
          background: rgba(212,160,23,0.20);
          border-color: rgba(212,160,23,0.55);
          color: #d4a017;
        }

        /* ── quick-jump dots ── */
        .na-quick {
          position: relative; z-index: 2;
          display: flex; flex-wrap: wrap; justify-content: center;
          gap: 4px; padding: 6px 16px 14px;
          max-width: 340px;
          flex-shrink: 0;
        }
        .na-dot {
          width: 6px; height: 6px; border-radius: 50%; border: none;
          background: rgba(212,160,23,0.18);
          cursor: pointer; transition: all .18s; padding: 0;
        }
        .na-dot:hover    { background: rgba(212,160,23,0.50); transform: scale(1.4); }
        .na-dot.na-dot-active {
          background: #d4a017;
          box-shadow: 0 0 6px rgba(212,160,23,0.60);
          transform: scale(1.5);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
