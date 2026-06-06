"use client";

import { useState, useCallback, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Hadith {
  arabic: string;
  fa:     string;
  source: string;
  grade?: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const HADITHS: Hadith[] = [
  {
    arabic: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى',
    fa:     'همانا اعمال به نیت‌هاست و برای هر کسی همان است که نیت کرده.',
    source: 'صحیح البخاری، حدیث ۱',
    grade:  'صحیح',
  },
  {
    arabic: 'الدِّينُ النَّصِيحَةُ',
    fa:     'دین، خیرخواهی است.',
    source: 'صحیح مسلم، حدیث ۵۵',
    grade:  'صحیح',
  },
  {
    arabic: 'لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ',
    fa:     'هیچ‌کدام از شما ایمان ندارد تا اینکه برای برادرش آنچه را که برای خود دوست می‌دارد، دوست بدارد.',
    source: 'صحیح البخاری، حدیث ۱۳',
    grade:  'صحیح',
  },
  {
    arabic: 'أَحَبُّ الْأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ',
    fa:     'محبوب‌ترین اعمال نزد خداوند، پیوسته‌ترین آن‌هاست، هرچند کم باشد.',
    source: 'صحیح البخاری، حدیث ۶۴۶۴',
    grade:  'صحیح',
  },
  {
    arabic: 'الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ',
    fa:     'مسلمان کسی است که مسلمانان از دست و زبان او در امان باشند.',
    source: 'صحیح البخاری، حدیث ۱۰',
    grade:  'صحیح',
  },
  {
    arabic: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ',
    fa:     'هر که به خدا و روز آخرت ایمان دارد، باید سخن خیر بگوید یا خاموش بماند.',
    source: 'صحیح البخاری، حدیث ۶۰۱۸',
    grade:  'صحیح',
  },
  {
    arabic: 'اتَّقِ اللَّهَ حَيْثُمَا كُنْتَ وَأَتْبِعِ السَّيِّئَةَ الْحَسَنَةَ تَمْحُهَا وَخَالِقِ النَّاسَ بِخُلُقٍ حَسَنٍ',
    fa:     'در هر جا که هستی از خدا بترس، و بدی را با نیکی پاک کن، و با مردم با اخلاق نیکو رفتار کن.',
    source: 'سنن الترمذی، حدیث ۱۹۸۷',
    grade:  'حسن',
  },
  {
    arabic: 'إِنَّ مِنْ أَكْمَلِ الْمُؤْمِنِينَ إِيمَانًا أَحْسَنُهُمْ خُلُقًا',
    fa:     'کامل‌ترین مؤمنان از نظر ایمان، خوش‌اخلاق‌ترین آن‌هاست.',
    source: 'سنن أبی داود، حدیث ۴۶۸۲',
    grade:  'صحیح',
  },
  {
    arabic: 'الطَّهُورُ شَطْرُ الْإِيمَانِ',
    fa:     'پاکیزگی نیمی از ایمان است.',
    source: 'صحیح مسلم، حدیث ۲۲۳',
    grade:  'صحیح',
  },
  {
    arabic: 'خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ',
    fa:     'بهترین شما کسی است که قرآن بیاموزد و بیاموزاند.',
    source: 'صحیح البخاری، حدیث ۵۰۲۷',
    grade:  'صحیح',
  },
  {
    arabic: 'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ طَرِيقًا إِلَى الْجَنَّةِ',
    fa:     'هر کس در راهی گام بردارد که در آن دانش می‌جوید، خداوند راهی به بهشت برایش آسان می‌کند.',
    source: 'صحیح مسلم، حدیث ۲۶۹۹',
    grade:  'صحیح',
  },
  {
    arabic: 'الْكَلِمَةُ الطَّيِّبَةُ صَدَقَةٌ',
    fa:     'سخن نیکو صدقه است.',
    source: 'صحیح البخاری، حدیث ۲۹۸۹',
    grade:  'صحیح',
  },
  {
    arabic: 'إِنَّ اللَّهَ رَفِيقٌ يُحِبُّ الرِّفْقَ فِي الْأَمْرِ كُلِّهِ',
    fa:     'خداوند مهربان است و مهربانی در همه کارها را دوست دارد.',
    source: 'صحیح البخاری، حدیث ۶۹۲۷',
    grade:  'صحیح',
  },
  {
    arabic: 'ابْتَغُوا الرِّفْعَةَ عِنْدَ اللَّهِ',
    fa:     'بزرگی را نزد خدا بجویید.',
    source: 'المعجم الکبیر، طبرانی',
    grade:  'حسن',
  },
  {
    arabic: 'أَفْضَلُ الصَّدَقَةِ أَنْ تَتَصَدَّقَ وَأَنْتَ صَحِيحٌ شَحِيحٌ',
    fa:     'بهترین صدقه آن است که هنگام سلامت و تنگدستی انجام دهی.',
    source: 'صحیح البخاری، حدیث ۱۴۱۹',
    grade:  'صحیح',
  },
  {
    arabic: 'لَيْسَ الْغِنَى عَنْ كَثْرَةِ الْعَرَضِ وَلَكِنَّ الْغِنَى غِنَى النَّفْسِ',
    fa:     'ثروتمندی با زیادی مال نیست، بلکه ثروت واقعی، بی‌نیازی نفس است.',
    source: 'صحیح البخاری، حدیث ۶۴۴۶',
    grade:  'صحیح',
  },
  {
    arabic: 'إِنَّ اللَّهَ لَا يَنْظُرُ إِلَى صُوَرِكُمْ وَأَمْوَالِكُمْ وَلَكِنْ يَنْظُرُ إِلَى قُلُوبِكُمْ وَأَعْمَالِكُمْ',
    fa:     'خداوند به چهره‌ها و اموالتان نمی‌نگرد، بلکه به دل‌ها و اعمالتان می‌نگرد.',
    source: 'صحیح مسلم، حدیث ۲۵۶۴',
    grade:  'صحیح',
  },
  {
    arabic: 'تَبَسُّمُكَ فِي وَجْهِ أَخِيكَ صَدَقَةٌ',
    fa:     'لبخند زدن به روی برادرت صدقه است.',
    source: 'سنن الترمذی، حدیث ۱۹۵۶',
    grade:  'حسن',
  },
  {
    arabic: 'مَنْ لَمْ يَشْكُرِ النَّاسَ لَمْ يَشْكُرِ اللَّهَ',
    fa:     'هر که از مردم سپاسگزاری نکند، از خدا سپاسگزاری نکرده است.',
    source: 'سنن أبی داود، حدیث ۴۸۱۱',
    grade:  'صحیح',
  },
  {
    arabic: 'إِنَّ مِنَ الْبَيَانِ لَسِحْرًا',
    fa:     'برخی از بیان‌ها جادو است.',
    source: 'صحیح البخاری، حدیث ۵۱۴۶',
    grade:  'صحیح',
  },
  {
    arabic: 'الْمُؤْمِنُ لِلْمُؤْمِنِ كَالْبُنْيَانِ يَشُدُّ بَعْضُهُ بَعْضًا',
    fa:     'مؤمن برای مؤمن مانند بنایی است که بخشی از آن بخش دیگر را محکم می‌کند.',
    source: 'صحیح البخاری، حدیث ۴۸۱',
    grade:  'صحیح',
  },
  {
    arabic: 'خَيْرُ الصَّدَقَةِ مَا كَانَ عَنْ ظَهْرِ غِنًى وَابْدَأْ بِمَنْ تَعُولُ',
    fa:     'بهترین صدقه آن است که از فراوانی باشد، و از نان‌خورانت آغاز کن.',
    source: 'صحیح البخاری، حدیث ۱۴۲۶',
    grade:  'صحیح',
  },
  {
    arabic: 'أَحَبُّ الْبِلَادِ إِلَى اللَّهِ مَسَاجِدُهَا',
    fa:     'محبوب‌ترین جاها نزد خداوند مساجد است.',
    source: 'صحیح مسلم، حدیث ۶۷۱',
    grade:  'صحیح',
  },
  {
    arabic: 'بَشِّرُوا وَلَا تُنَفِّرُوا وَيَسِّرُوا وَلَا تُعَسِّرُوا',
    fa:     'بشارت دهید و نترسانید، آسان بگیرید و سخت‌گیری نکنید.',
    source: 'صحیح البخاری، حدیث ۶۹',
    grade:  'صحیح',
  },
  {
    arabic: 'لَا تَحْقِرَنَّ مِنَ الْمَعْرُوفِ شَيْئًا وَلَوْ أَنْ تَلْقَى أَخَاكَ بِوَجْهٍ طَلْقٍ',
    fa:     'هیچ کار نیکویی را کوچک مشمار، حتی اگر با چهره‌ای گشاده با برادرت روبرو شوی.',
    source: 'صحیح مسلم، حدیث ۲۶۲۶',
    grade:  'صحیح',
  },
  {
    arabic: 'إِنَّ اللَّهَ يُحِبُّ إِذَا عَمِلَ أَحَدُكُمْ عَمَلًا أَنْ يُتْقِنَهُ',
    fa:     'خداوند دوست دارد که هرگاه یکی از شما کاری انجام می‌دهد، آن را با اتقان و دقت انجام دهد.',
    source: 'المعجم الأوسط، طبرانی',
    grade:  'صحیح',
  },
  {
    arabic: 'مَنْ أَرَادَ الدُّنْيَا فَعَلَيْهِ بِالْعِلْمِ وَمَنْ أَرَادَ الْآخِرَةَ فَعَلَيْهِ بِالْعِلْمِ',
    fa:     'هر که دنیا را بخواهد باید علم بیاموزد، و هر که آخرت را بخواهد نیز باید علم بیاموزد.',
    source: 'المستدرک، حاکم',
    grade:  'حسن',
  },
  {
    arabic: 'الصَّبْرُ ضِيَاءٌ',
    fa:     'صبر روشنایی است.',
    source: 'صحیح مسلم، حدیث ۲۲۳',
    grade:  'صحیح',
  },
  {
    arabic: 'مَا يُصِيبُ الْمُسْلِمَ مِنْ نَصَبٍ وَلَا وَصَبٍ وَلَا هَمٍّ وَلَا حُزْنٍ وَلَا أَذًى وَلَا غَمٍّ حَتَّى الشَّوْكَةِ يُشَاكُهَا إِلَّا كَفَّرَ اللَّهُ بِهَا مِنْ خَطَايَاهُ',
    fa:     'هیچ رنج، بیماری، غم، اندوه، آزار و اندوهی به مسلمان نمی‌رسد — حتی خاری که به او می‌خلد — مگر اینکه خداوند به وسیله آن گناهانش را می‌بخشاید.',
    source: 'صحیح البخاری، حدیث ۵۶۴۲',
    grade:  'صحیح',
  },
  {
    arabic: 'رَأْسُ الْعَقْلِ بَعْدَ الإِيمَانِ بِاللَّهِ مُدَارَاةُ النَّاسِ',
    fa:     'سر عقل پس از ایمان به خدا، مدارا با مردم است.',
    source: 'المعجم الکبیر، طبرانی',
    grade:  'حسن',
  },
  {
    arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ',
    fa:     'بار خدایا، از تو عفو و عافیت در دنیا و آخرت می‌خواهم.',
    source: 'سنن ابن ماجه، حدیث ۳۸۵۱',
    grade:  'صحیح',
  },
  {
    arabic: 'حُبُّ الدُّنْيَا رَأْسُ كُلِّ خَطِيئَةٍ',
    fa:     'دوستی دنیا ریشه هر گناهی است.',
    source: 'مشکاة المصابیح',
    grade:  'ضعیف — مشهور',
  },
  {
    arabic: 'لَا ضَرَرَ وَلَا ضِرَارَ',
    fa:     'نه ضرر زدن روا است و نه ضرر رساندن.',
    source: 'سنن ابن ماجه، حدیث ۲۳۴۰',
    grade:  'صحیح',
  },
  {
    arabic: 'مَنْ صَمَتَ نَجَا',
    fa:     'هر که خاموش ماند، نجات یافت.',
    source: 'سنن الترمذی، حدیث ۲۵۰۱',
    grade:  'حسن',
  },
  {
    arabic: 'أَكْثِرُوا ذِكْرَ اللَّهِ حَتَّى يَقُولُوا مَجْنُونٌ',
    fa:     'آنقدر ذکر خدا بگویید که بگویند دیوانه شده‌اید.',
    source: 'مسند أحمد، حدیث ۲۳۳۸۶',
    grade:  'حسن',
  },
  {
    arabic: 'كُلُّ مَعْرُوفٍ صَدَقَةٌ',
    fa:     'هر کار نیکویی صدقه است.',
    source: 'صحیح البخاری، حدیث ۶۰۲۱',
    grade:  'صحیح',
  },
  {
    arabic: 'إِنَّ اللَّهَ جَمِيلٌ يُحِبُّ الْجَمَالَ',
    fa:     'خداوند زیباست و زیبایی را دوست دارد.',
    source: 'صحیح مسلم، حدیث ۹۱',
    grade:  'صحیح',
  },
  {
    arabic: 'مَنْ حَسُنَ إِسْلَامُهُ تَرَكَ مَا لَا يَعْنِيهِ',
    fa:     'هر که اسلامش نیکو باشد، آنچه را که به او مربوط نیست رها می‌کند.',
    source: 'سنن الترمذی، حدیث ۲۳۱۸',
    grade:  'حسن',
  },
  {
    arabic: 'الدُّنْيَا سِجْنُ الْمُؤْمِنِ وَجَنَّةُ الْكَافِرِ',
    fa:     'دنیا زندان مؤمن و بهشت کافر است.',
    source: 'صحیح مسلم، حدیث ۲۹۵۶',
    grade:  'صحیح',
  },
  {
    arabic: 'إِنَّ أَثْقَلَ شَيْءٍ يُوضَعُ فِي الْمِيزَانِ يَوْمَ الْقِيَامَةِ الْخُلُقُ الْحَسَنُ',
    fa:     'سنگین‌ترین چیزی که روز قیامت در ترازوی اعمال گذاشته می‌شود، اخلاق نیکو است.',
    source: 'سنن أبی داود، حدیث ۴۷۹۹',
    grade:  'صحیح',
  },
  {
    arabic: 'اتَّقُوا النَّارَ وَلَوْ بِشِقِّ تَمْرَةٍ',
    fa:     'خود را از آتش دوزخ نگاه دارید، هرچند با نیمه‌ای از خرما.',
    source: 'صحیح البخاری، حدیث ۱۴۱۷',
    grade:  'صحیح',
  },
  {
    arabic: 'الْقَنَاعَةُ كَنْزٌ لَا يَنْفَدُ',
    fa:     'قناعت گنجی است که تمام نمی‌شود.',
    source: 'المستدرک، حاکم',
    grade:  'حسن',
  },
  {
    arabic: 'لَا يَدْخُلُ الْجَنَّةَ قَاطِعُ رَحِمٍ',
    fa:     'کسی که پیوند خویشاوندی را قطع کند وارد بهشت نمی‌شود.',
    source: 'صحیح البخاری، حدیث ۵۹۸۴',
    grade:  'صحیح',
  },
  {
    arabic: 'الْبِرُّ حُسْنُ الْخُلُقِ',
    fa:     'نیکوکاری همان اخلاق نیکوست.',
    source: 'صحیح مسلم، حدیث ۲۵۵۳',
    grade:  'صحیح',
  },
  {
    arabic: 'مَنْ تَوَاضَعَ لِلَّهِ رَفَعَهُ اللَّهُ',
    fa:     'هر که برای خدا تواضع کند، خداوند او را رفعت می‌بخشد.',
    source: 'صحیح مسلم، حدیث ۲۵۸۸',
    grade:  'صحیح',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toAr(n: number): string {
  return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]);
}

function dailyIndex(): number {
  const now   = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const day   = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return day % HADITHS.length;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function DailyHadithWidget({ onClose }: { onClose: () => void }) {
  const [idx,     setIdx]     = useState<number>(dailyIndex);
  const [leaving, setLeaving] = useState(false);
  const [copied,  setCopied]  = useState(false);
  const [query,   setQuery]   = useState('');

  const filtered = query.trim()
    ? HADITHS.map((h, i) => ({ ...h, i })).filter(h =>
        h.arabic.includes(query) ||
        h.fa.includes(query)     ||
        h.source.includes(query)
      )
    : null;

  const current = HADITHS[idx];

  const navigate = useCallback((dir: 1 | -1) => {
    setLeaving(true);
    setCopied(false);
    setTimeout(() => {
      setIdx(i => (i + dir + HADITHS.length) % HADITHS.length);
      setLeaving(false);
    }, 220);
  }, []);

  const jumpTo = useCallback((i: number) => {
    setCopied(false);
    setLeaving(true);
    setTimeout(() => { setIdx(i); setLeaving(false); setQuery(''); }, 220);
  }, []);

  const goToDaily = useCallback(() => {
    setLeaving(true);
    setCopied(false);
    setTimeout(() => { setIdx(dailyIndex()); setLeaving(false); }, 220);
  }, []);

  const copyText = useCallback(() => {
    const text = `${current.arabic}\n\n${current.fa}\n\n— ${current.source}`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }).catch(() => {});
  }, [current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  navigate(1);
      if (e.key === 'ArrowRight') navigate(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <div className="dh">
      {/* Background */}
      <div className="dh-bg"/>
      <div className="dh-dim"/>

      {/* Header */}
      <header className="dh-hdr">
        <button className="dh-ibtn" onClick={onClose} aria-label="بستن">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6"  x2="6"  y2="18"/>
            <line x1="6"  y1="6"  x2="18" y2="18"/>
          </svg>
        </button>

        <div className="dh-hdr-mid">
          <span className="dh-hdr-icon">☽</span>
          <div>
            <div className="dh-hdr-title">حدیث روز</div>
            <div className="dh-hdr-sub">{toAr(HADITHS.length)} حدیث · سخنان پیامبر ﷺ</div>
          </div>
        </div>

        <button className="dh-ibtn" onClick={copyText} aria-label="کپی">
          {copied
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4caf70" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          }
        </button>
      </header>

      {/* Search */}
      <div className="dh-search-row">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="dh-search-ico">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="dh-search"
          placeholder="جستجو در احادیث..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          dir="rtl"
        />
        {query && (
          <button className="dh-search-x" onClick={() => setQuery('')}>×</button>
        )}
      </div>

      {/* Search results */}
      {filtered && (
        <div className="dh-results">
          {filtered.length === 0 && (
            <p className="dh-empty">حدیثی یافت نشد</p>
          )}
          {filtered.map(h => (
            <button key={h.i} className={`dh-result-row${h.i === idx ? ' dh-result-on' : ''}`} onClick={() => jumpTo(h.i)}>
              <span className="dh-result-ar">{h.arabic.length > 60 ? h.arabic.slice(0, 60) + '…' : h.arabic}</span>
              <span className="dh-result-src">{h.source}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main card */}
      {!filtered && (
        <>
          {/* Progress */}
          <div className="dh-prog-row">
            <div className="dh-prog-track">
              <div className="dh-prog-fill" style={{ width: `${((idx + 1) / HADITHS.length) * 100}%` }}/>
            </div>
            <span className="dh-prog-lbl">{toAr(idx + 1)} / {toAr(HADITHS.length)}</span>
          </div>

          {/* Card */}
          <div className={`dh-card${leaving ? ' dh-leaving' : ''}`}>
            {/* Ornament */}
            <div className="dh-ornament">✦ ✦ ✦</div>

            {/* Arabic text */}
            <div className="dh-arabic-wrap">
              <p className="dh-arabic">{current.arabic}</p>
            </div>

            {/* Divider */}
            <div className="dh-divider"/>

            {/* Persian translation */}
            <p className="dh-fa">{current.fa}</p>

            {/* Source + grade */}
            <div className="dh-meta">
              <span className="dh-source">{current.source}</span>
              {current.grade && (
                <span className={`dh-grade${current.grade === 'صحیح' ? ' dh-grade-sahih' : current.grade === 'حسن' ? ' dh-grade-hasan' : ' dh-grade-other'}`}>
                  {current.grade}
                </span>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="dh-nav">
            <button className="dh-nav-btn" onClick={() => navigate(-1)} aria-label="قبلی">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>

            <button className="dh-daily-btn" onClick={goToDaily}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              حدیث امروز
            </button>

            <button className="dh-nav-btn" onClick={() => navigate(1)} aria-label="بعدی">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>

          {/* Dot strip */}
          <div className="dh-dots">
            {HADITHS.map((_, i) => (
              <button
                key={i}
                className={`dh-dot${i === idx ? ' dh-dot-on' : ''}`}
                onClick={() => jumpTo(i)}
                aria-label={`حدیث ${toAr(i + 1)}`}
              />
            ))}
          </div>
        </>
      )}

      {/* Styles */}
      <style>{`
        .dh {
          position: fixed; inset: 0; z-index: 200;
          display: flex; flex-direction: column; align-items: center;
          font-family: 'Vazirmatn', sans-serif; direction: rtl; color: #e8dfc8;
          overflow: hidden; user-select: none; -webkit-user-select: none;
        }

        /* background */
        .dh-bg {
          position: absolute; inset: 0;
          background-image: url('https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1080&q=85');
          background-size: cover; background-position: center;
        }
        .dh-dim {
          position: absolute; inset: 0;
          background: linear-gradient(180deg,
            rgba(2,5,18,0.90) 0%,
            rgba(3,7,22,0.68) 35%,
            rgba(4,2,0,0.95) 100%);
        }

        /* header */
        .dh-hdr {
          position: relative; z-index: 2; flex-shrink: 0;
          width: 100%; display: flex; align-items: center; justify-content: space-between;
          padding: 12px 14px;
          background: rgba(2,6,20,0.82); backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(212,160,23,0.15);
        }
        .dh-ibtn {
          width: 40px; height: 40px; border-radius: 50%; border: none;
          background: rgba(255,255,255,0.08); backdrop-filter: blur(14px);
          color: rgba(212,160,23,0.70); flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background .2s, color .2s;
        }
        .dh-ibtn:hover { background: rgba(255,255,255,0.14); color: #d4a017; }
        .dh-hdr-mid { display: flex; align-items: center; gap: 10px; }
        .dh-hdr-icon { font-size: 20px; color: #d4a017; }
        .dh-hdr-title { font-size: 15px; font-weight: 600; color: #d4a017; }
        .dh-hdr-sub   { font-size: 11px; color: rgba(212,160,23,0.44); margin-top: 2px; }

        /* search */
        .dh-search-row {
          position: relative; z-index: 2; flex-shrink: 0;
          width: 100%; display: flex; align-items: center; gap: 8px;
          padding: 8px 14px;
          background: rgba(2,6,20,0.62); backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(212,160,23,0.10);
        }
        .dh-search-ico { color: rgba(212,160,23,0.38); flex-shrink: 0; }
        .dh-search {
          flex: 1; background: transparent; border: none; outline: none;
          color: #e8dfc8; font-family: 'Vazirmatn', sans-serif; font-size: 14px;
          direction: rtl;
        }
        .dh-search::placeholder { color: rgba(212,160,23,0.28); }
        .dh-search-x {
          border: none; background: transparent;
          color: rgba(212,160,23,0.42); font-size: 20px; line-height: 1;
          cursor: pointer; padding: 0 4px; flex-shrink: 0;
        }
        .dh-search-x:hover { color: rgba(212,160,23,0.80); }

        /* search results */
        .dh-results {
          position: relative; z-index: 1; flex: 1; min-height: 0;
          width: 100%; overflow-y: auto;
          display: flex; flex-direction: column; gap: 4px;
          padding: 10px 12px 20px;
          scrollbar-width: thin; scrollbar-color: rgba(212,160,23,0.20) transparent;
        }
        .dh-results::-webkit-scrollbar { width: 4px; }
        .dh-results::-webkit-scrollbar-thumb { background: rgba(212,160,23,0.22); border-radius: 4px; }
        .dh-result-row {
          display: flex; flex-direction: column; gap: 4px; text-align: right;
          padding: 10px 14px; border-radius: 14px;
          background: rgba(212,160,23,0.05); border: 1px solid rgba(212,160,23,0.12);
          cursor: pointer; transition: all .18s;
        }
        .dh-result-row:hover { background: rgba(212,160,23,0.12); border-color: rgba(212,160,23,0.30); }
        .dh-result-row.dh-result-on {
          background: rgba(212,160,23,0.18); border-color: rgba(212,160,23,0.50);
        }
        .dh-result-ar  { font-family: 'Scheherazade New', serif; font-size: 14px; color: #f0e6c0; }
        .dh-result-src { font-size: 10px; color: rgba(212,160,23,0.48); }
        .dh-empty { text-align: center; color: rgba(212,160,23,0.38); font-size: 14px; padding: 48px 0; }

        /* progress */
        .dh-prog-row {
          position: relative; z-index: 2; flex-shrink: 0;
          width: 100%; display: flex; align-items: center; gap: 10px;
          padding: 8px 16px;
        }
        .dh-prog-track {
          flex: 1; height: 3px; border-radius: 3px;
          background: rgba(212,160,23,0.12); overflow: hidden;
        }
        .dh-prog-fill {
          height: 100%; border-radius: 3px;
          background: linear-gradient(90deg, rgba(212,160,23,0.50), #d4a017);
          transition: width .5s cubic-bezier(.22,.68,0,1.2);
          box-shadow: 0 0 6px rgba(212,160,23,0.40);
        }
        .dh-prog-lbl {
          font-size: 11px; color: rgba(212,160,23,0.44); white-space: nowrap;
          flex-shrink: 0; font-family: 'Scheherazade New', serif;
        }

        /* card */
        .dh-card {
          position: relative; z-index: 1;
          flex: 1; min-height: 0; overflow-y: auto;
          width: 100%; max-width: 520px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 8px 28px 6px;
          transition: opacity .22s ease, transform .22s ease;
          scrollbar-width: none;
        }
        .dh-card::-webkit-scrollbar { display: none; }
        .dh-card.dh-leaving { opacity: 0; transform: translateX(-22px); }

        .dh-ornament {
          font-size: 10px; letter-spacing: .35em;
          color: rgba(212,160,23,0.30); margin-bottom: 14px; flex-shrink: 0;
        }

        .dh-arabic-wrap { width: 100%; flex-shrink: 0; }
        .dh-arabic {
          font-family: 'Scheherazade New', serif;
          font-size: clamp(20px, 5vw, 28px); font-weight: 600; line-height: 2.0;
          color: #f5ecd0; text-align: center; direction: rtl;
          text-shadow: 0 0 40px rgba(212,160,23,0.22), 0 2px 8px rgba(0,0,0,0.55);
        }

        .dh-divider {
          width: 60px; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(212,160,23,0.32), transparent);
          margin: 16px auto; flex-shrink: 0;
        }

        .dh-fa {
          font-size: 15px; font-weight: 400; line-height: 1.85;
          color: rgba(240,230,192,0.78); text-align: center; direction: rtl;
          flex-shrink: 0;
        }

        .dh-meta {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
          justify-content: center; margin-top: 16px; flex-shrink: 0;
        }
        .dh-source {
          font-size: 11px; color: rgba(212,160,23,0.50); letter-spacing: .04em;
        }
        .dh-grade {
          font-size: 10px; padding: 2px 9px; border-radius: 10px;
          border: 1px solid; letter-spacing: .04em;
        }
        .dh-grade-sahih { color: rgba(80,200,120,0.80); border-color: rgba(80,200,120,0.30); background: rgba(80,200,120,0.08); }
        .dh-grade-hasan { color: rgba(100,180,255,0.75); border-color: rgba(100,180,255,0.28); background: rgba(100,180,255,0.07); }
        .dh-grade-other { color: rgba(212,160,23,0.52); border-color: rgba(212,160,23,0.22); background: rgba(212,160,23,0.06); }

        /* navigation */
        .dh-nav {
          position: relative; z-index: 2; flex-shrink: 0;
          display: flex; align-items: center; gap: 16px;
          padding: 6px 0 4px;
        }
        .dh-nav-btn {
          width: 46px; height: 46px; border-radius: 50%; border: none;
          background: rgba(212,160,23,0.09); border: 1px solid rgba(212,160,23,0.20);
          color: rgba(212,160,23,0.68);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all .18s;
        }
        .dh-nav-btn:hover {
          background: rgba(212,160,23,0.18); border-color: rgba(212,160,23,0.50); color: #d4a017;
        }
        .dh-daily-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 10px 18px; border-radius: 22px;
          background: rgba(212,160,23,0.09); border: 1px solid rgba(212,160,23,0.24);
          color: rgba(212,160,23,0.62);
          font-family: 'Vazirmatn', sans-serif; font-size: 12px;
          cursor: pointer; transition: all .18s;
        }
        .dh-daily-btn:hover {
          background: rgba(212,160,23,0.18); border-color: rgba(212,160,23,0.52); color: #d4a017;
        }

        /* dots */
        .dh-dots {
          position: relative; z-index: 2; flex-shrink: 0;
          display: flex; flex-wrap: wrap; justify-content: center;
          gap: 5px; padding: 4px 20px 14px; max-width: 360px;
        }
        .dh-dot {
          width: 6px; height: 6px; border-radius: 50%; border: none; padding: 0;
          background: rgba(212,160,23,0.18); cursor: pointer; transition: all .18s;
        }
        .dh-dot:hover   { background: rgba(212,160,23,0.52); transform: scale(1.45); }
        .dh-dot.dh-dot-on {
          background: #d4a017;
          box-shadow: 0 0 7px rgba(212,160,23,0.65);
          transform: scale(1.55);
        }
      `}</style>
    </div>
  );
}
