"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { morningAdhkar, eveningAdhkar, afterPrayerAdhkar, beforeSleepAdhkar, uponWakingAdhkar } from '@/lib/adhkarData';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AdhkarItem {
  title:   string;
  arabic:  string;
  persian: string;
  count:   number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toAr(n: number): string {
  return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]);
}

function detectMode(): 'morning' | 'evening' {
  const h = new Date().getHours();
  return h >= 4 && h < 15 ? 'morning' : 'evening';
}

/** Exported helper — lets any parent check if it's time to suggest adhkar */
export function shouldSuggestAdhkar(): { suggest: boolean; mode: 'morning' | 'evening'; label: string } {
  const h = new Date().getHours();
  if (h >= 4  && h < 9)  return { suggest: true,  mode: 'morning', label: 'وقت اذکار صبح است 🌅' };
  if (h >= 16 && h < 20) return { suggest: true,  mode: 'evening', label: 'وقت اذکار شب است 🌙'  };
  return { suggest: false, mode: 'morning', label: '' };
}

// ─── Adhkar Data ──────────────────────────────────────────────────────────────
const MORNING: AdhkarItem[] = [
  {
    title:   'آية الكرسي',
    arabic:  'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ',
    persian: 'خداوند معبودی جز او نیست، زنده و پاینده است. نه خواب سبک او را فرا می‌گیرد و نه خواب سنگین. هرچه در آسمان‌ها و زمین است از آن اوست. بلند مرتبه و بزرگ است.',
    count:   1,
  },
  {
    title:   'سورة الإخلاص',
    arabic:  'قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ',
    persian: 'بگو: او خداوند یگانه است. خداوندِ بی‌نیاز. نه زاده و نه زاده شده. و هیچ‌کس همتای او نیست.',
    count:   3,
  },
  {
    title:   'سورة الفلق',
    arabic:  'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۝ مِن شَرِّ مَا خَلَقَ ۝ وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ ۝ وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ۝ وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ',
    persian: 'بگو: پناه می‌برم به پروردگار سپیده‌دم، از شر آنچه آفریده، از شر تاریکی شب، از شر افسونگران، از شر حسودی که حسد ورزد.',
    count:   3,
  },
  {
    title:   'سورة الناس',
    arabic:  'قُلْ أَعُوذُ بِرَبِّ النَّاسِ ۝ مَلِكِ النَّاسِ ۝ إِلَٰهِ النَّاسِ ۝ مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ۝ الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ۝ مِنَ الْجِنَّةِ وَالنَّاسِ',
    persian: 'بگو: پناه می‌برم به پروردگار مردمان، پادشاه مردمان، معبود مردمان. از شر وسوسه‌گر پنهان‌شونده که در سینه‌های مردمان وسوسه می‌کند، از جن و انس.',
    count:   3,
  },
  {
    title:   'دعاء الصباح',
    arabic:  'أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ وَالْحَمْدُ لِلَّهِ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ',
    persian: 'صبح کردیم و صبح کرد پادشاهی برای خدا، ستایش از آن خداست، معبودی جز الله نیست، یگانه است و شریک ندارد، پادشاهی از آن اوست. پروردگارا، خیر این روز و آنچه پس از آن است از تو می‌خواهم.',
    count:   1,
  },
  {
    title:   'اللهم بك أصبحنا',
    arabic:  'اللَّهُمَّ بِكَ أَصْبَحْنَا وَبِكَ أَمْسَيْنَا وَبِكَ نَحْيَا وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ',
    persian: 'بار خدایا، به لطف تو صبح کردیم، به لطف تو شب می‌کنیم، به لطف تو زندگی می‌کنیم، به لطف تو می‌میریم و رستاخیز به سوی توست.',
    count:   1,
  },
  {
    title:   'سيد الاستغفار',
    arabic:  'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ خَلَقْتَنِي وَأَنَا عَبْدُكَ وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ',
    persian: 'بار خدایا، تو پروردگار منی، معبودی جز تو نیست، مرا آفریدی و من بنده‌ی توام. بر پیمانت پایبندم. از شر آنچه کرده‌ام به تو پناه می‌برم. نعمتت و گناهم را اعتراف می‌کنم. پس مرا ببخش، که جز تو کسی نمی‌بخشد.',
    count:   1,
  },
  {
    title:   'أشهدك في الصباح',
    arabic:  'اللَّهُمَّ إِنِّي أَصْبَحْتُ أُشْهِدُكَ وَأُشْهِدُ حَمَلَةَ عَرْشِكَ وَمَلَائِكَتَكَ وَجَمِيعَ خَلْقِكَ أَنَّكَ أَنْتَ اللَّهُ لَا إِلَهَ إِلَّا أَنْتَ وَحْدَكَ لَا شَرِيكَ لَكَ وَأَنَّ مُحَمَّداً عَبْدُكَ وَرَسُولُكَ',
    persian: 'بار خدایا، در این صبح تو را گواه می‌گیرم، حاملان عرشت، فرشتگانت و همه آفریدگانت را که تو خدایی، یگانه‌ای، شریک نداری و محمد ﷺ بنده و رسول توست.',
    count:   4,
  },
  {
    title:   'دعاء العافية',
    arabic:  'اللَّهُمَّ عَافِنِي فِي بَدَنِي اللَّهُمَّ عَافِنِي فِي سَمْعِي وَبَصَرِي اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْكُفْرِ وَالْفَقْرِ وَأَعُوذُ بِكَ مِنْ عَذَابِ الْقَبْرِ لَا إِلَهَ إِلَّا أَنْتَ',
    persian: 'خدایا تنم را تندرستی بخش. خدایا شنواییم و بیناییم را تندرستی بخش. از کفر و فقر و عذاب قبر به تو پناه می‌برم. معبودی جز تو نیست.',
    count:   3,
  },
  {
    title:   'التسبيح',
    arabic:  'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
    persian: 'خداوند پاک است و ستایش از آن اوست.',
    count:   33,
  },
];

const EVENING: AdhkarItem[] = [
  {
    title:   'آية الكرسي',
    arabic:  MORNING[0].arabic,
    persian: MORNING[0].persian,
    count:   1,
  },
  {
    title:   'سورة الإخلاص',
    arabic:  MORNING[1].arabic,
    persian: MORNING[1].persian,
    count:   3,
  },
  {
    title:   'سورة الفلق',
    arabic:  MORNING[2].arabic,
    persian: MORNING[2].persian,
    count:   3,
  },
  {
    title:   'سورة الناس',
    arabic:  MORNING[3].arabic,
    persian: MORNING[3].persian,
    count:   3,
  },
  {
    title:   'دعاء المساء',
    arabic:  'أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ وَالْحَمْدُ لِلَّهِ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا',
    persian: 'شب کردیم و شب کرد پادشاهی برای خدا. پروردگارا، خیر این شب و آنچه پس از آن است از تو می‌خواهم.',
    count:   1,
  },
  {
    title:   'اللهم بك أمسينا',
    arabic:  'اللَّهُمَّ بِكَ أَمْسَيْنَا وَبِكَ أَصْبَحْنَا وَبِكَ نَحْيَا وَبِكَ نَمُوتُ وَإِلَيْكَ الْمَصِيرُ',
    persian: 'بار خدایا، به لطف تو شب کردیم، به لطف تو صبح می‌کنیم، به لطف تو زندگی می‌کنیم، به لطف تو می‌میریم و بازگشت به سوی توست.',
    count:   1,
  },
  {
    title:   'سيد الاستغفار',
    arabic:  MORNING[6].arabic,
    persian: MORNING[6].persian,
    count:   1,
  },
  {
    title:   'أشهدك في المساء',
    arabic:  'اللَّهُمَّ إِنِّي أَمْسَيْتُ أُشْهِدُكَ وَأُشْهِدُ حَمَلَةَ عَرْشِكَ وَمَلَائِكَتَكَ وَجَمِيعَ خَلْقِكَ أَنَّكَ أَنْتَ اللَّهُ لَا إِلَهَ إِلَّا أَنْتَ وَحْدَكَ لَا شَرِيكَ لَكَ وَأَنَّ مُحَمَّداً عَبْدُكَ وَرَسُولُكَ',
    persian: 'بار خدایا، در این شب تو را گواه می‌گیرم، حاملان عرشت، فرشتگانت و همه آفریدگانت را که تو خدایی، یگانه‌ای، شریک نداری و محمد ﷺ بنده و رسول توست.',
    count:   4,
  },
  {
    title:   'دعاء العافية',
    arabic:  MORNING[8].arabic,
    persian: MORNING[8].persian,
    count:   3,
  },
  {
    title:   'التسبيح',
    arabic:  'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
    persian: 'خداوند پاک است و ستایش از آن اوست.',
    count:   33,
  },
];

const AFTER_PRAYER: AdhkarItem[] = afterPrayerAdhkar.map(d => ({ ...d, title: d.note ?? '' }));
const BEFORE_SLEEP: AdhkarItem[] = beforeSleepAdhkar.map(d => ({ ...d, title: d.note ?? '' }));
const UPON_WAKING:  AdhkarItem[] = uponWakingAdhkar.map(d => ({ ...d, title: d.note ?? '' }));

// ─── Component ────────────────────────────────────────────────────────────────
export function AdhkarWidget({ onClose }: { onClose: () => void }) {
  const [mode,        setMode]        = useState<'morning' | 'evening' | 'afterPrayer' | 'beforeSleep' | 'uponWaking'>(detectMode);
  const [idx,         setIdx]         = useState(0);
  const [tapCount,    setTapCount]    = useState(0);
  const [sessionDone, setSessionDone] = useState(false);
  const [leaving,     setLeaving]     = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const adhkar      = mode === 'morning' ? MORNING : mode === 'evening' ? EVENING : mode === 'afterPrayer' ? AFTER_PRAYER : mode === 'beforeSleep' ? BEFORE_SLEEP : UPON_WAKING;
  const current     = adhkar[idx] ?? adhkar[0];
  const doneCurrent = tapCount >= current.count;

  // ── Suggestion banner ──────────────────────────────────────────────────────
  const { suggest, label: suggestLabel } = shouldSuggestAdhkar();

  // ── Sounds ────────────────────────────────────────────────────────────────
  const getCtx = useCallback(() => {
    const AC = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') audioCtxRef.current = new AC();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);

  const playTap = useCallback(() => {
    try {
      const ctx = getCtx(); if (!ctx) return;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.18);
    } catch { /* noop */ }
  }, [getCtx]);

  const playAdvance = useCallback(() => {
    try {
      const ctx = getCtx(); if (!ctx) return;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1100, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.25);
    } catch { /* noop */ }
  }, [getCtx]);

  // ── Auto-advance when dhikr complete ──────────────────────────────────────
  useEffect(() => {
    if (!doneCurrent || sessionDone) return;
    playAdvance();
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([20, 15, 40]);
    const t = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => {
        if (idx < adhkar.length - 1) {
          setIdx(i => i + 1);
          setTapCount(0);
        } else {
          setSessionDone(true);
        }
        setLeaving(false);
      }, 300);
    }, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneCurrent, sessionDone]);

  // ── Tap ────────────────────────────────────────────────────────────────────
  const tap = useCallback(() => {
    if (doneCurrent || sessionDone) return;
    playTap();
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(12);
    setTapCount(p => Math.min(p + 1, current.count));
  }, [doneCurrent, sessionDone, current.count, playTap]);

  const handleScreenTap = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, .ad-celebration')) return;
    tap();
  }, [tap]);

  // ── Mode switch resets session ─────────────────────────────────────────────
  const switchMode = useCallback(() => {
    setMode(m => m === 'morning' ? 'evening' : 'morning');
    setIdx(0); setTapCount(0); setSessionDone(false);
  }, []);

  const restart = useCallback(() => {
    setIdx(0); setTapCount(0); setSessionDone(false);
  }, []);

  // ── Ring geometry ──────────────────────────────────────────────────────────
  const R      = 52;
  const circ   = 2 * Math.PI * R;
  const filled = doneCurrent ? 0 : circ * (1 - tapCount / current.count);

  const modeLabel = mode === 'morning' ? 'أذكار الصباح' : mode === 'evening' ? 'أذكار المساء' : mode === 'afterPrayer' ? 'أذكار بعد از نماز' : mode === 'beforeSleep' ? 'أذكار قبل از خواب' : 'أذكار بیدار شدن';
  const modeFA    = mode === 'morning' ? 'اذکار صبح'    : mode === 'evening' ? 'اذکار شب'     : mode === 'afterPrayer' ? 'بعد از نماز'       : mode === 'beforeSleep' ? 'قبل از خواب'       : 'بیدار شدن';

  return (
    <div className="ad" onClick={handleScreenTap}>
      {/* ── Background ── */}
      <div className="ad-bg"/>
      <div className="ad-dim"/>

      {/* ── Header ── */}
      <header className="ad-hdr">
        <button className="ad-ibtn" onClick={onClose} aria-label="بستن">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <div className="ad-hdr-mid">
          <div className="ad-mode-icon">{mode === 'morning' ? '☀️' : '🌙'}</div>
          <div>
            <div className="ad-hdr-title">{modeLabel}</div>
            <div className="ad-hdr-sub">{modeFA} · {toAr(adhkar.length)} ذکر</div>
          </div>
        </div>
        <button className="ad-ibtn" onClick={switchMode} aria-label="تغییر وقت">
          {mode === 'morning'
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          }
        </button>
      </header>

      {/* ── Category selector ── */}
      <div className="ad-cats" onClick={e => e.stopPropagation()}>
        <button className={`ad-cat${mode === 'morning'     ? ' ad-cat-active' : ''}`} onClick={() => { setMode('morning');     setIdx(0); setTapCount(0); setSessionDone(false); }}>صبح</button>
        <button className={`ad-cat${mode === 'evening'     ? ' ad-cat-active' : ''}`} onClick={() => { setMode('evening');     setIdx(0); setTapCount(0); setSessionDone(false); }}>شب</button>
        <button className={`ad-cat${mode === 'afterPrayer' ? ' ad-cat-active' : ''}`} onClick={() => { setMode('afterPrayer'); setIdx(0); setTapCount(0); setSessionDone(false); }}>بعد از نماز</button>
        <button className={`ad-cat${mode === 'beforeSleep' ? ' ad-cat-active' : ''}`} onClick={() => { setMode('beforeSleep'); setIdx(0); setTapCount(0); setSessionDone(false); }}>قبل از خواب</button>
        <button className={`ad-cat${mode === 'uponWaking'  ? ' ad-cat-active' : ''}`} onClick={() => { setMode('uponWaking');  setIdx(0); setTapCount(0); setSessionDone(false); }}>بیدار شدن</button>
      </div>

      {/* ── Suggestion banner ── */}
      {suggest && !sessionDone && (
        <div className="ad-suggest">{suggestLabel}</div>
      )}

      {/* ── Session progress bar ── */}
      <div className="ad-prog-wrap">
        <div className="ad-prog-bar">
          <div className="ad-prog-fill" style={{ width: `${(idx / adhkar.length) * 100}%` }}/>
        </div>
        <span className="ad-prog-lbl">{toAr(idx)} از {toAr(adhkar.length)}</span>
      </div>

      {/* ── Dhikr card ── */}
      <div className={`ad-card${leaving ? ' ad-leaving' : ''}`}>
        <div className="ad-dhikr-num">
          <span className="ad-dhikr-badge">{toAr(idx + 1)}</span>
          <span className="ad-dhikr-title">{current.title}</span>
        </div>

        <div className="ad-arabic-wrap">
          <p className="ad-arabic">{current.arabic}</p>
        </div>

        <p className="ad-persian">{current.persian}</p>
      </div>

      {/* ── Circular counter ── */}
      <div className="ad-counter">
        <svg width="130" height="130" viewBox="0 0 130 130">
          {/* track */}
          <circle cx="65" cy="65" r={R} fill="none"
            stroke="rgba(212,160,23,0.12)" strokeWidth="5"/>
          {/* progress arc */}
          <circle cx="65" cy="65" r={R} fill="none"
            stroke={doneCurrent ? '#ffd700' : 'rgba(212,160,23,0.70)'}
            strokeWidth="5" strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={filled}
            transform="rotate(-90 65 65)"
            style={{ transition: 'stroke-dashoffset 0.22s ease, stroke 0.3s' }}
          />
          {/* bead center circle */}
          <circle cx="65" cy="65" r="42" fill="rgba(6,10,28,0.72)"/>
        </svg>
        <div className="ad-counter-inner">
          <span className="ad-count-num">{toAr(tapCount)}</span>
          <span className="ad-count-div">/</span>
          <span className="ad-count-tot">{toAr(current.count)}</span>
        </div>
        {!doneCurrent && (
          <p className="ad-tap-hint">لمس کنید</p>
        )}
        {doneCurrent && !sessionDone && (
          <p className="ad-tap-hint ad-tap-next">✓ در حال رفتن...</p>
        )}
      </div>

      {/* ── Session complete celebration ── */}
      {sessionDone && (
        <div className="ad-celebration">
          <div className="ad-celeb-glow"/>
          <div className="ad-celeb-content">
            <div className="ad-celeb-emoji">✨</div>
            <h2 className="ad-celeb-title">ماشاءالله</h2>
            <p className="ad-celeb-sub">{modeFA} با موفقیت کامل شد</p>
            <p className="ad-celeb-ar">تَقَبَّلَ اللَّهُ مِنَّا وَمِنكُم</p>
            <button className="ad-celeb-btn" onClick={restart}>دوباره</button>
          </div>
        </div>
      )}

      <style>{`
        .ad {
          position: fixed; inset: 0; z-index: 200;
          display: flex; flex-direction: column; align-items: center;
          font-family: 'Vazirmatn', sans-serif; direction: rtl; color: #e8dfc8;
          overflow: hidden; cursor: pointer;
          user-select: none; -webkit-user-select: none;
        }

        /* ── background ── */
        .ad-bg {
          position: absolute; inset: 0;
          background-image: url('https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1080&q=85');
          background-size: cover; background-position: center;
        }
        .ad-dim {
          position: absolute; inset: 0;
          background: linear-gradient(180deg,
            rgba(2,5,18,0.82) 0%,
            rgba(3,7,22,0.62) 35%,
            rgba(4,2,0,0.92) 100%);
        }

        /* ── header ── */
        .ad-hdr {
          position: relative; z-index: 2;
          width: 100%;
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 14px;
          background: rgba(2,6,20,0.78);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(212,160,23,0.12);
          flex-shrink: 0;
        }
        .ad-ibtn {
          width: 40px; height: 40px; border-radius: 50%; border: none;
          background: rgba(255,255,255,0.09); backdrop-filter: blur(14px);
          color: rgba(212,160,23,0.72);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background .2s; flex-shrink: 0;
        }
        .ad-ibtn:hover { background: rgba(255,255,255,0.15); }
        .ad-hdr-mid { display: flex; align-items: center; gap: 10px; }
        .ad-mode-icon { font-size: 22px; }
        .ad-hdr-title { font-size: 16px; font-weight: 600; color: #d4a017; }
        .ad-hdr-sub   { font-size: 11px; color: rgba(212,160,23,0.44); margin-top: 1px; }

        /* ── category selector ── */
        .ad-cats {
          position: relative; z-index: 2;
          width: 100%; display: flex; gap: 6px;
          padding: 8px 14px; overflow-x: auto; scrollbar-width: none;
          background: rgba(2,6,20,0.60); backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(212,160,23,0.10);
          flex-shrink: 0;
        }
        .ad-cats::-webkit-scrollbar { display: none; }
        .ad-cat {
          flex-shrink: 0; padding: 5px 14px; border-radius: 20px;
          border: 1px solid rgba(212,160,23,0.22);
          background: rgba(212,160,23,0.07);
          color: rgba(212,160,23,0.55);
          font-family: 'Vazirmatn', sans-serif; font-size: 12px;
          cursor: pointer; transition: all .18s;
          white-space: nowrap;
        }
        .ad-cat:hover { background: rgba(212,160,23,0.14); color: rgba(212,160,23,0.85); }
        .ad-cat-active {
          background: rgba(212,160,23,0.18) !important;
          border-color: rgba(212,160,23,0.55) !important;
          color: #d4a017 !important;
        }

        /* ── suggestion banner ── */
        .ad-suggest {
          position: relative; z-index: 2;
          width: 100%;
          padding: 8px 16px;
          background: rgba(212,160,23,0.10);
          border-bottom: 1px solid rgba(212,160,23,0.18);
          font-size: 12px; color: rgba(212,160,23,0.72);
          text-align: center; letter-spacing: .04em;
          animation: fadeIn .5s ease both;
          flex-shrink: 0;
        }

        /* ── progress bar ── */
        .ad-prog-wrap {
          position: relative; z-index: 2;
          width: 100%;
          display: flex; align-items: center; gap: 10px;
          padding: 10px 16px;
          flex-shrink: 0;
        }
        .ad-prog-bar {
          flex: 1; height: 4px; border-radius: 4px;
          background: rgba(212,160,23,0.12);
          overflow: hidden;
        }
        .ad-prog-fill {
          height: 100%; border-radius: 4px;
          background: linear-gradient(90deg, rgba(212,160,23,0.6), #d4a017);
          transition: width .5s cubic-bezier(.22,.68,0,1.2);
          box-shadow: 0 0 6px rgba(212,160,23,0.50);
        }
        .ad-prog-lbl {
          font-size: 11px; color: rgba(212,160,23,0.48);
          white-space: nowrap; flex-shrink: 0;
        }

        /* ── dhikr card ── */
        .ad-card {
          position: relative; z-index: 1;
          flex: 1; min-height: 0;
          width: 100%; max-width: 480px;
          display: flex; flex-direction: column;
          padding: 10px 20px 4px;
          transition: opacity .28s ease, transform .28s ease;
        }
        .ad-card.ad-leaving { opacity: 0; transform: translateX(-18px); }

        .ad-dhikr-num {
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 8px; flex-shrink: 0;
        }
        .ad-dhikr-badge {
          width: 26px; height: 26px; border-radius: 50%;
          background: rgba(212,160,23,0.14);
          border: 1px solid rgba(212,160,23,0.30);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; color: #d4a017;
          font-family: 'Scheherazade New', serif;
        }
        .ad-dhikr-title {
          font-size: 13px; font-weight: 500;
          color: rgba(212,160,23,0.68); letter-spacing: .04em;
        }

        .ad-arabic-wrap {
          flex: 1; min-height: 0; overflow-y: auto;
          scrollbar-width: none;
        }
        .ad-arabic-wrap::-webkit-scrollbar { display: none; }
        .ad-arabic {
          font-family: 'Scheherazade New', serif;
          font-size: 21px; line-height: 2.0;
          color: #f0e6c0; text-align: right; direction: rtl;
          text-shadow: 0 0 14px rgba(212,160,23,0.10);
        }

        .ad-persian {
          font-size: 12px; font-weight: 300; line-height: 1.85;
          color: rgba(212,160,23,0.44);
          text-align: right; direction: rtl;
          border-top: 1px solid rgba(212,160,23,0.08);
          padding-top: 8px; margin-top: 8px;
          flex-shrink: 0;
        }

        /* ── circular counter ── */
        .ad-counter {
          position: relative; z-index: 2;
          display: flex; flex-direction: column; align-items: center;
          margin-top: 6px; flex-shrink: 0;
          padding-bottom: 10px;
        }
        .ad-counter-inner {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -60%);
          display: flex; align-items: baseline; gap: 2px;
          pointer-events: none;
        }
        .ad-count-num {
          font-family: 'Scheherazade New', serif;
          font-size: 28px; font-weight: 700; color: #f0e6c0;
          line-height: 1;
        }
        .ad-count-div { font-size: 14px; color: rgba(212,160,23,0.35); }
        .ad-count-tot { font-size: 15px; color: rgba(212,160,23,0.55); }
        .ad-tap-hint {
          font-size: 11px; color: rgba(212,160,23,0.38);
          letter-spacing: .06em; margin-top: 4px;
        }
        .ad-tap-next { color: rgba(100,200,100,0.65); animation: fadeIn .3s ease both; }

        /* ── celebration overlay ── */
        .ad-celebration {
          position: absolute; inset: 0; z-index: 10;
          display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.65); backdrop-filter: blur(10px);
          animation: fadeIn .4s ease both;
        }
        .ad-celeb-glow {
          position: absolute; top: 50%; left: 50%;
          width: 280px; height: 280px; border-radius: 50%;
          background: radial-gradient(circle, rgba(212,160,23,0.22) 0%, transparent 70%);
          transform: translate(-50%, -50%);
          animation: glowPulse 2s ease-in-out infinite;
        }
        @keyframes glowPulse {
          0%,100% { transform: translate(-50%,-50%) scale(1);   opacity: .8; }
          50%      { transform: translate(-50%,-50%) scale(1.18); opacity: 1;  }
        }
        .ad-celeb-content {
          position: relative; z-index: 1;
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          background: rgba(4,8,24,0.94);
          border: 1px solid rgba(212,160,23,0.32);
          border-radius: 28px; padding: 36px 40px;
          box-shadow: 0 24px 72px rgba(0,0,0,0.75), 0 0 60px rgba(212,160,23,0.10);
          animation: popCeleb .55s cubic-bezier(.22,.68,0,1.2) both;
        }
        @keyframes popCeleb {
          from { opacity:0; transform: scale(.80) translateY(20px); }
          to   { opacity:1; transform: none; }
        }
        .ad-celeb-emoji { font-size: 42px; animation: spin 1.2s ease both; }
        @keyframes spin {
          from { transform: scale(0) rotate(-180deg); }
          to   { transform: scale(1) rotate(0deg); }
        }
        .ad-celeb-title {
          font-family: 'Scheherazade New', serif;
          font-size: 34px; font-weight: 700; color: #ffd700;
          text-shadow: 0 0 28px rgba(255,215,0,0.55);
        }
        .ad-celeb-sub {
          font-size: 14px; color: rgba(232,223,200,0.70); text-align: center;
        }
        .ad-celeb-ar {
          font-family: 'Scheherazade New', serif;
          font-size: 18px; color: rgba(212,160,23,0.65);
          letter-spacing: .03em; text-align: center;
        }
        .ad-celeb-btn {
          margin-top: 6px; padding: 11px 30px; border-radius: 16px;
          background: rgba(212,160,23,0.16);
          border: 1px solid rgba(212,160,23,0.42);
          color: #d4a017; font-family: 'Vazirmatn', sans-serif;
          font-size: 14px; cursor: pointer; transition: all .2s;
        }
        .ad-celeb-btn:hover { background: rgba(212,160,23,0.26); }

        /* ── shared animations ── */
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
