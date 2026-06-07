"use client";

import { useState, useCallback, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Name {
  num:    number;
  arabic: string;
  trans:  string;
  fa:     string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const NAMES: Name[] = [
  { num:  1, arabic: 'ٱللَّه',                            trans: 'Allah',                  fa: 'خداوند — ذات یگانه‌ی الهی' },
  { num:  2, arabic: 'ٱلرَّحْمَٰن',                       trans: 'Ar-Raḥmān',              fa: 'بخشنده‌ی فراگیر در دنیا و آخرت' },
  { num:  3, arabic: 'ٱلرَّحِيم',                         trans: 'Ar-Raḥīm',               fa: 'مهربان بی‌پایان ویژه مؤمنان' },
  { num:  4, arabic: 'ٱلْمَلِك',                          trans: 'Al-Malik',               fa: 'پادشاه مطلق' },
  { num:  5, arabic: 'ٱلْقُدُّوس',                        trans: 'Al-Quddūs',              fa: 'پاک و منزه از هر عیب' },
  { num:  6, arabic: 'ٱلسَّلَام',                         trans: 'As-Salām',               fa: 'سلامت‌بخش و صلح‌دهنده' },
  { num:  7, arabic: 'ٱلْمُؤْمِن',                        trans: "Al-Mu'min",              fa: 'امان‌دهنده و اطمینان‌بخش' },
  { num:  8, arabic: 'ٱلْمُهَيْمِن',                      trans: 'Al-Muhaymin',            fa: 'نگهبان و مراقب همه چیز' },
  { num:  9, arabic: 'ٱلْعَزِيز',                         trans: "Al-'Azīz",               fa: 'شکست‌ناپذیر و عزیز' },
  { num: 10, arabic: 'ٱلْجَبَّار',                        trans: 'Al-Jabbār',              fa: 'جبران‌کننده‌ی هر شکستگی، قادر مطلق' },
  { num: 11, arabic: 'ٱلْمُتَكَبِّر',                     trans: 'Al-Mutakabbir',          fa: 'شایسته‌ی کبریا و بزرگی' },
  { num: 12, arabic: 'ٱلْخَالِق',                         trans: 'Al-Khāliq',              fa: 'آفریننده از عدم' },
  { num: 13, arabic: 'ٱلْبَارِئ',                         trans: "Al-Bāri'",               fa: 'سازنده‌ی آفریدگان بدون نمونه' },
  { num: 14, arabic: 'ٱلْمُصَوِّر',                       trans: 'Al-Muṣawwir',            fa: 'شکل‌دهنده و نقاش هستی' },
  { num: 15, arabic: 'ٱلْغَفَّار',                        trans: 'Al-Ghaffār',             fa: 'بسیار آمرزنده‌ی گناهان' },
  { num: 16, arabic: 'ٱلْقَهَّار',                        trans: 'Al-Qahhār',              fa: 'چیره بر همه چیز و همه کس' },
  { num: 17, arabic: 'ٱلْوَهَّاب',                        trans: 'Al-Wahhāb',              fa: 'بخشنده‌ی بسیار بدون چشمداشت' },
  { num: 18, arabic: 'ٱلرَّزَّاق',                        trans: 'Ar-Razzāq',              fa: 'روزی‌دهنده‌ی همه موجودات' },
  { num: 19, arabic: 'ٱلْفَتَّاح',                        trans: 'Al-Fattāḥ',              fa: 'گشاینده‌ی درهای رحمت و خیر' },
  { num: 20, arabic: 'ٱلْعَلِيم',                         trans: "Al-'Alīm",               fa: 'دانای مطلق به پنهان و آشکار' },
  { num: 21, arabic: 'ٱلْقَابِض',                         trans: 'Al-Qābiḍ',               fa: 'گیرنده و محدودکننده به حکمت' },
  { num: 22, arabic: 'ٱلْبَاسِط',                         trans: 'Al-Bāsiṭ',               fa: 'گسترنده‌ی روزی و رحمت' },
  { num: 23, arabic: 'ٱلْخَافِض',                         trans: 'Al-Khāfiḍ',              fa: 'فروکشنده‌ی متکبران' },
  { num: 24, arabic: 'ٱلرَّافِع',                         trans: "Ar-Rāfi'",               fa: 'بالابرنده‌ی مؤمنان' },
  { num: 25, arabic: 'ٱلْمُعِزّ',                         trans: "Al-Mu'izz",              fa: 'عزت‌دهنده به هر که بخواهد' },
  { num: 26, arabic: 'ٱلْمُذِلّ',                         trans: 'Al-Mudhill',             fa: 'خوارکننده‌ی ستمگران' },
  { num: 27, arabic: 'ٱلسَّمِيع',                         trans: "As-Samī'",               fa: 'شنوا — می‌شنود هر صدایی را' },
  { num: 28, arabic: 'ٱلْبَصِير',                         trans: 'Al-Baṣīr',               fa: 'بینا — می‌بیند هر چیزی را' },
  { num: 29, arabic: 'ٱلْحَكَم',                          trans: 'Al-Ḥakam',               fa: 'داور نهایی میان خلق' },
  { num: 30, arabic: 'ٱلْعَدْل',                          trans: "Al-'Adl",                fa: 'عدالت مطلق' },
  { num: 31, arabic: 'ٱللَّطِيف',                         trans: 'Al-Laṭīf',               fa: 'مهربان و ظریف‌بین به جزئیات' },
  { num: 32, arabic: 'ٱلْخَبِير',                         trans: 'Al-Khabīr',              fa: 'آگاه از باطن همه چیز' },
  { num: 33, arabic: 'ٱلْحَلِيم',                         trans: 'Al-Ḥalīm',               fa: 'بردبار و شکیبا در برابر خطا' },
  { num: 34, arabic: 'ٱلْعَظِيم',                         trans: "Al-'Aẓīm",               fa: 'عظیم — دارای بزرگی بی‌حد' },
  { num: 35, arabic: 'ٱلْغَفُور',                         trans: 'Al-Ghafūr',              fa: 'بسیار آمرزنده و پوشاننده‌ی عیب' },
  { num: 36, arabic: 'ٱلشَّكُور',                         trans: 'Ash-Shakūr',             fa: 'قدردان عمل کوچک بنده' },
  { num: 37, arabic: 'ٱلْعَلِيّ',                         trans: "Al-'Alī",                fa: 'برتر از همه — بلندمقام' },
  { num: 38, arabic: 'ٱلْكَبِير',                         trans: 'Al-Kabīr',               fa: 'بزرگ‌منش و عظیم‌الشأن' },
  { num: 39, arabic: 'ٱلْحَفِيظ',                         trans: 'Al-Ḥafīẓ',               fa: 'نگهدارنده‌ی همه چیز' },
  { num: 40, arabic: 'ٱلْمُقِيت',                         trans: 'Al-Muqīt',               fa: 'روزی‌رسان و حفظ‌کننده' },
  { num: 41, arabic: 'ٱلْحَسِيب',                         trans: 'Al-Ḥasīb',               fa: 'حسابرس اعمال بندگان' },
  { num: 42, arabic: 'ٱلْجَلِيل',                         trans: 'Al-Jalīl',               fa: 'جلیل‌القدر و باعظمت' },
  { num: 43, arabic: 'ٱلْكَرِيم',                         trans: 'Al-Karīm',               fa: 'کریم و سخاوتمند مطلق' },
  { num: 44, arabic: 'ٱلرَّقِيب',                         trans: 'Ar-Raqīb',               fa: 'مراقب همیشگی بر همه چیز' },
  { num: 45, arabic: 'ٱلْمُجِيب',                         trans: 'Al-Mujīb',               fa: 'پاسخ‌دهنده به دعای بندگان' },
  { num: 46, arabic: 'ٱلْوَاسِع',                         trans: "Al-Wāsi'",               fa: 'دارای رحمت و علم بی‌کران' },
  { num: 47, arabic: 'ٱلْحَكِيم',                         trans: 'Al-Ḥakīm',               fa: 'فرزانه و حکیم در همه کارها' },
  { num: 48, arabic: 'ٱلْوَدُود',                         trans: 'Al-Wadūd',               fa: 'دوستدار بندگان مؤمن' },
  { num: 49, arabic: 'ٱلْمَجِيد',                         trans: 'Al-Majīd',               fa: 'باشکوه و مجید' },
  { num: 50, arabic: 'ٱلْبَاعِث',                         trans: "Al-Bā'ith",              fa: 'برانگیزنده‌ی مردگان در قیامت' },
  { num: 51, arabic: 'ٱلشَّهِيد',                         trans: 'Ash-Shahīd',             fa: 'گواه بر همه چیز در همه زمان' },
  { num: 52, arabic: 'ٱلْحَقّ',                           trans: 'Al-Ḥaqq',                fa: 'حقیقت مطلق و ثابت' },
  { num: 53, arabic: 'ٱلْوَكِيل',                         trans: 'Al-Wakīl',               fa: 'وکیل و تکیه‌گاه مطمئن' },
  { num: 54, arabic: 'ٱلْقَوِيّ',                         trans: 'Al-Qawī',                fa: 'نیرومند — قدرت کامل' },
  { num: 55, arabic: 'ٱلْمَتِين',                         trans: 'Al-Matīn',               fa: 'استوار و محکم در قدرت' },
  { num: 56, arabic: 'ٱلْوَلِيّ',                         trans: 'Al-Walī',                fa: 'سرپرست و یاور مؤمنان' },
  { num: 57, arabic: 'ٱلْحَمِيد',                         trans: 'Al-Ḥamīd',               fa: 'ستوده در همه حال' },
  { num: 58, arabic: 'ٱلْمُحْصِي',                        trans: 'Al-Muḥṣī',               fa: 'شمارنده و احصاکننده همه چیز' },
  { num: 59, arabic: 'ٱلْمُبْدِئ',                        trans: "Al-Mubdi'",              fa: 'آغازکننده‌ی آفرینش بدون نمونه' },
  { num: 60, arabic: 'ٱلْمُعِيد',                         trans: "Al-Mu'īd",               fa: 'بازگرداننده‌ی آفریدگان پس از فنا' },
  { num: 61, arabic: 'ٱلْمُحْيِي',                        trans: 'Al-Muḥyī',               fa: 'زنده‌کننده‌ی همه موجودات' },
  { num: 62, arabic: 'ٱلْمُمِيت',                         trans: 'Al-Mumīt',               fa: 'میراننده به فرمان خود' },
  { num: 63, arabic: 'ٱلْحَيّ',                           trans: 'Al-Ḥayy',                fa: 'زنده‌ی جاودان که مرگ ندارد' },
  { num: 64, arabic: 'ٱلْقَيُّوم',                        trans: 'Al-Qayyūm',              fa: 'پاینده‌ی قائم بالذات — نگهدار هستی' },
  { num: 65, arabic: 'ٱلْوَاجِد',                         trans: 'Al-Wājid',               fa: 'یابنده‌ی همه چیز — هیچ چیز از او پنهان نیست' },
  { num: 66, arabic: 'ٱلْمَاجِد',                         trans: 'Al-Mājid',               fa: 'بزرگوار و شریف' },
  { num: 67, arabic: 'ٱلْوَاحِد',                         trans: 'Al-Wāḥid',               fa: 'یگانه — بی‌شریک' },
  { num: 68, arabic: 'ٱلْأَحَد',                          trans: 'Al-Aḥad',                fa: 'یکتا — در ذات و صفات بی‌همتا' },
  { num: 69, arabic: 'ٱلصَّمَد',                          trans: 'Aṣ-Ṣamad',               fa: 'بی‌نیاز مطلق — همه به او نیازمندند' },
  { num: 70, arabic: 'ٱلْقَادِر',                         trans: 'Al-Qādir',               fa: 'توانا — قدرت بر هر چیز' },
  { num: 71, arabic: 'ٱلْمُقْتَدِر',                      trans: 'Al-Muqtadir',            fa: 'قادر مطلق و توانای کامل' },
  { num: 72, arabic: 'ٱلْمُقَدِّم',                       trans: 'Al-Muqaddim',            fa: 'پیش‌برنده — جلو می‌اندازد هر که را بخواهد' },
  { num: 73, arabic: 'ٱلْمُؤَخِّر',                       trans: "Al-Mu'akhkhir",          fa: 'به تأخیراندازنده — عقب می‌اندازد هر که را بخواهد' },
  { num: 74, arabic: 'ٱلْأَوَّل',                         trans: 'Al-Awwal',               fa: 'اول — پیش از همه چیز بوده است' },
  { num: 75, arabic: 'ٱلْآخِر',                           trans: 'Al-Ākhir',               fa: 'آخر — پس از همه چیز خواهد بود' },
  { num: 76, arabic: 'ٱلظَّاهِر',                         trans: 'Aẓ-Ẓāhir',              fa: 'آشکار — نشانه‌هایش همه جاست' },
  { num: 77, arabic: 'ٱلْبَاطِن',                         trans: 'Al-Bāṭin',               fa: 'پنهان — ذاتش از دیده‌ها پوشیده است' },
  { num: 78, arabic: 'ٱلْوَالِي',                         trans: 'Al-Wālī',                fa: 'حاکم و سرپرست همه هستی' },
  { num: 79, arabic: 'ٱلْمُتَعَالِي',                     trans: "Al-Muta'ālī",            fa: 'برتر از همه وصف‌ها و توصیف‌ها' },
  { num: 80, arabic: 'ٱلْبَرّ',                           trans: 'Al-Barr',                fa: 'نیکوکار — سرشار از احسان' },
  { num: 81, arabic: 'ٱلتَّوَّاب',                        trans: 'At-Tawwāb',              fa: 'توبه‌پذیر — بارها توبه را می‌پذیرد' },
  { num: 82, arabic: 'ٱلْمُنْتَقِم',                      trans: 'Al-Muntaqim',            fa: 'انتقام‌گیرنده از ستمگران' },
  { num: 83, arabic: 'ٱلْعَفُوّ',                         trans: "Al-'Afuww",              fa: 'عفوکننده — محو می‌کند گناه را' },
  { num: 84, arabic: 'ٱلرَّءُوف',                         trans: "Ar-Ra'ūf",               fa: 'رأفت‌کننده — مهربانی فراتر از رحمت' },
  { num: 85, arabic: 'مَالِكُ ٱلْمُلْك',                  trans: 'Mālik Al-Mulk',          fa: 'مالک پادشاهی — هر ملکی از اوست' },
  { num: 86, arabic: 'ذُو ٱلْجَلَٰلِ وَٱلْإِكْرَام',      trans: 'Dhul-Jalāl Wal-Ikrām',  fa: 'صاحب جلال و بزرگواری' },
  { num: 87, arabic: 'ٱلْمُقْسِط',                        trans: 'Al-Muqsiṭ',              fa: 'دادگر — عدالت را اجرا می‌کند' },
  { num: 88, arabic: 'ٱلْجَامِع',                         trans: "Al-Jāmi'",               fa: 'گردآورنده‌ی خلق در روز قیامت' },
  { num: 89, arabic: 'ٱلْغَنِيّ',                         trans: 'Al-Ghanī',               fa: 'بی‌نیاز مطلق از همه چیز' },
  { num: 90, arabic: 'ٱلْمُغْنِي',                        trans: 'Al-Mughnī',              fa: 'بی‌نیازکننده‌ی بندگان' },
  { num: 91, arabic: 'ٱلْمَانِع',                         trans: "Al-Māni'",               fa: 'بازدارنده — جلوگیر از هر شر' },
  { num: 92, arabic: 'ٱلضَّارّ',                          trans: 'Aḍ-Ḍārr',               fa: 'زیان‌رساننده به فرمان حکمتش' },
  { num: 93, arabic: 'ٱلنَّافِع',                         trans: "An-Nāfi'",               fa: 'سودرساننده به هر که بخواهد' },
  { num: 94, arabic: 'ٱلنُّور',                           trans: 'An-Nūr',                 fa: 'نور — روشنایی آسمان‌ها و زمین' },
  { num: 95, arabic: 'ٱلْهَادِي',                         trans: 'Al-Hādī',                fa: 'راهنما — به راه راست هدایت می‌کند' },
  { num: 96, arabic: 'ٱلْبَدِيع',                         trans: "Al-Badī'",               fa: 'بی‌نظیر در آفرینش — ابداع‌کننده' },
  { num: 97, arabic: 'ٱلْبَاقِي',                         trans: 'Al-Bāqī',                fa: 'ماندگار — هیچ‌گاه فنا نمی‌شود' },
  { num: 98, arabic: 'ٱلْوَارِث',                         trans: 'Al-Wārith',              fa: 'وارث همه چیز پس از فنای مخلوقات' },
  { num: 99, arabic: 'ٱلرَّشِيد',                         trans: 'Ar-Rashīd',              fa: 'هدایتگر به راه راست — حکیم در تدبیر' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toAr(n: number): string {
  return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]);
}

function dailyIndex(): number {
  const now      = new Date();
  const start    = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return dayOfYear % 99;
}

function audioUrl(num: number): string {
  const audioNames: Record<number, string> = {1:'rahman',2:'rahim',3:'malik',4:'quddus',5:'salam',6:'mumin',7:'muhaymin',8:'aziz',9:'jabbar',10:'mutakabbir',11:'khaliq',12:'bari',13:'musawwir',14:'ghaffar',15:'qahhar',16:'wahhab',17:'razzaq',18:'fattah',19:'alim',20:'qabid',21:'basit',22:'khafid',23:'rafi',24:'muizz',25:'mudhill',26:'sami',27:'basir',28:'hakam',29:'adl',30:'latif',31:'khabir',32:'halim',33:'azim',34:'ghafur',35:'shakur',36:'aliyy',37:'kabir',38:'hafiz',39:'muqit',40:'hasib',41:'jalil',42:'karim',43:'raqib',44:'mujib',45:'wasi',46:'hakim',47:'wadud',48:'majid',49:'baith',50:'shahid',51:'haqq',52:'wakil',53:'qawiyy',54:'matin',55:'waliyy',56:'hamid',57:'muhsi',58:'mubdi',59:'muid',60:'muhyi',61:'mumit',62:'hayy',63:'qayyum',64:'wajid',65:'majid',66:'wahid',67:'ahad',68:'samad',69:'qadir',70:'muqtadir',71:'muqaddim',72:'muakhkhir',73:'awwal',74:'akhir',75:'zahir',76:'batin',77:'wali',78:'mutaali',79:'barr',80:'tawwab',81:'muntaqim',82:'afuww',83:'rauf',84:'malikulmulk',85:'dhuljalal',86:'muqsit',87:'jami',88:'ghani',89:'mughni',90:'mani',91:'darr',92:'nafi',93:'nur',94:'hadi',95:'badi',96:'baqi',97:'warith',98:'rashid',99:'sabur'};
  const name = audioNames[num] || 'rahman';
  return `https://islamicapi.com/audio/asma-ul-husna/${name}.mp3?v=${num}`;
}

// ─── Audio state type ─────────────────────────────────────────────────────────
type AudioState = 'idle' | 'loading' | 'playing' | 'error';

// ─── Component ────────────────────────────────────────────────────────────────
type View = 'card' | 'grid';

export default function NamesOfAllahWidget({ onClose }: { onClose: () => void }) {
  const [idx,        setIdx]        = useState<number>(dailyIndex);
  const [view,       setView]       = useState<View>('card');
  const [query,      setQuery]      = useState('');
  const [leaving,    setLeaving]    = useState(false);
  const [audioState, setAudioState] = useState<AudioState>('idle');
  const [playingNum, setPlayingNum] = useState<number | null>(null);

  const audioRef  = useRef<HTMLAudioElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? NAMES.filter(n =>
        n.arabic.includes(query)                         ||
        n.trans.toLowerCase().includes(query.toLowerCase()) ||
        n.fa.includes(query)
      )
    : NAMES;

  // ── Audio ─────────────────────────────────────────────────────────────────
  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setAudioState('idle');
    setPlayingNum(null);
  }, []);

  const playName = useCallback((num: number) => {
    if (playingNum === num && audioState === 'playing') {
      stopAudio();
      return;
    }
    stopAudio();

    const audio = new Audio();
    audioRef.current = audio;
    setPlayingNum(num);
    setAudioState('loading');

    audio.oncanplaythrough = () => {
      audio.load();
      audio.play().then(() => setAudioState('playing')).catch(() => setAudioState('error'));
    };
    audio.onended  = () => { setAudioState('idle'); setPlayingNum(null); };
    audio.onerror  = () => { setAudioState('error'); setPlayingNum(null); };
    audio.src = audioUrl(num);
    audio.load();
  }, [playingNum, audioState, stopAudio]);

  useEffect(() => () => stopAudio(), [stopAudio]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (view !== 'card' || document.activeElement === searchRef.current) return;
      if (e.key === 'ArrowLeft')  navigate(1);
      if (e.key === 'ArrowRight') navigate(-1);
      if (e.key === ' ')          { e.preventDefault(); playName(NAMES[idx].num); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, idx, playingNum, audioState]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const navigate = useCallback((dir: 1 | -1) => {
    stopAudio();
    setLeaving(true);
    setTimeout(() => {
      setIdx(i => (i + dir + NAMES.length) % NAMES.length);
      setLeaving(false);
    }, 220);
  }, [stopAudio]);

  const jumpTo = useCallback((num: number) => {
    stopAudio();
    setIdx(num - 1);
    setView('card');
    setQuery('');
  }, [stopAudio]);

  const goToDaily = useCallback(() => {
    stopAudio();
    setLeaving(true);
    setTimeout(() => { setIdx(dailyIndex()); setLeaving(false); }, 220);
  }, [stopAudio]);

  const current = NAMES[idx];

  // ── Audio button label ────────────────────────────────────────────────────
  const isCurrentPlaying = playingNum === current.num;
  const audioIcon = () => {
    if (isCurrentPlaying && audioState === 'loading') {
      return (
        <svg className="na-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 2a10 10 0 0 1 10 10"/>
        </svg>
      );
    }
    if (isCurrentPlaying && audioState === 'playing') {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" rx="1"/>
          <rect x="14" y="4" width="4" height="16" rx="1"/>
        </svg>
      );
    }
    if (isCurrentPlaying && audioState === 'error') {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      );
    }
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5,3 19,12 5,21"/>
      </svg>
    );
  };

  return (
    <div className="na">
      {/* Background */}
      <div className="na-bg"/>
      <div className="na-dim"/>

      {/* Header */}
      <header className="na-hdr">
        <button className="na-ibtn" onClick={onClose} aria-label="بستن">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6"  x2="6"  y2="18"/>
            <line x1="6"  y1="6"  x2="18" y2="18"/>
          </svg>
        </button>

        <div className="na-hdr-mid">
          <span className="na-hdr-star">✦</span>
          <div>
            <div className="na-hdr-title">أسماء الله الحسنى</div>
            <div className="na-hdr-sub">نام‌های نیکوی الهی · ۹۹ نام</div>
          </div>
        </div>

        <button
          className={`na-ibtn${view === 'grid' ? ' na-ibtn-on' : ''}`}
          onClick={() => { stopAudio(); setView(v => v === 'card' ? 'grid' : 'card'); }}
          aria-label="تغییر نما"
        >
          {view === 'card'
            ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="2" y="5" width="20" height="14" rx="2"/>
                <line x1="2" y1="10" x2="22" y2="10"/>
              </svg>
          }
        </button>
      </header>

      {/* Search */}
      <div className="na-search-row">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="na-search-ico">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          ref={searchRef}
          className="na-search"
          placeholder="جستجو در نام‌ها..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          dir="rtl"
        />
        {query && (
          <button className="na-search-x" onClick={() => setQuery('')}>×</button>
        )}
      </div>

      {/* ── Grid view ── */}
      {view === 'grid' && (
        <div className="na-grid">
          {filtered.map(n => (
            <button
              key={n.num}
              className={`na-gcell${n.num === current.num ? ' na-gcell-on' : ''}`}
              onClick={() => jumpTo(n.num)}
            >
              <span className="na-gnum">{toAr(n.num)}</span>
              <span className="na-gar">{n.arabic}</span>
              <span className="na-gfa">{n.fa.split(' — ')[0]}</span>
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
          {/* Progress bar */}
          <div className="na-prog-row">
            <div className="na-prog-track">
              <div className="na-prog-fill" style={{ width: `${((idx + 1) / 99) * 100}%` }}/>
            </div>
            <span className="na-prog-lbl">{toAr(idx + 1)} / ٩٩</span>
          </div>

          {/* Card */}
          <div className={`na-card${leaving ? ' na-leaving' : ''}`}>
            {/* Number badge */}
            <div className="na-num-badge">{toAr(current.num)}</div>

            {/* Arabic name */}
            <div className="na-arabic-wrap">
              <p className="na-arabic">{current.arabic}</p>
            </div>

            {/* Transliteration */}
            <p className="na-trans">{current.trans}</p>

            {/* Divider */}
            <div className="na-divider"/>

            {/* Persian meaning */}
            <p className="na-meaning">{current.fa}</p>

            {/* Audio button */}
            <button
              className={`na-audio-btn${isCurrentPlaying && audioState === 'playing' ? ' na-audio-playing' : ''}${isCurrentPlaying && audioState === 'error' ? ' na-audio-error' : ''}`}
              onClick={() => playName(current.num)}
              aria-label="پخش تلاوت"
              title={isCurrentPlaying && audioState === 'error' ? 'خطا در بارگذاری صدا' : 'پخش تلفظ'}
            >
              {audioIcon()}
              <span>
                {isCurrentPlaying && audioState === 'loading'  ? 'در حال بارگذاری...' :
                 isCurrentPlaying && audioState === 'playing'  ? 'توقف' :
                 isCurrentPlaying && audioState === 'error'    ? 'خطا' :
                 'پخش تلفظ'}
              </span>
            </button>
          </div>

          {/* Navigation controls */}
          <div className="na-nav">
            <button className="na-nav-btn" onClick={() => navigate(-1)} aria-label="قبلی">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>

            <button className="na-daily-btn" onClick={goToDaily}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
              نام امروز
            </button>

            <button className="na-nav-btn" onClick={() => navigate(1)} aria-label="بعدی">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>

          {/* Quick-jump dots */}
          {!query && (
            <div className="na-dots">
              {NAMES.map(n => (
                <button
                  key={n.num}
                  className={`na-dot${n.num === current.num ? ' na-dot-on' : ''}`}
                  onClick={() => jumpTo(n.num)}
                  aria-label={n.arabic}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Styles ── */}
      <style>{`
        /* ── root ── */
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
            rgba(2,5,18,0.90) 0%,
            rgba(3,7,22,0.68) 35%,
            rgba(4,2,0,0.95) 100%);
        }

        /* ── header ── */
        .na-hdr {
          position: relative; z-index: 2; flex-shrink: 0;
          width: 100%; display: flex; align-items: center; justify-content: space-between;
          padding: 12px 14px;
          background: rgba(2,6,20,0.82); backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(212,160,23,0.15);
        }
        .na-ibtn {
          width: 40px; height: 40px; border-radius: 50%; border: none;
          background: rgba(255,255,255,0.08); backdrop-filter: blur(14px);
          color: rgba(212,160,23,0.70); flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background .2s, color .2s;
        }
        .na-ibtn:hover  { background: rgba(255,255,255,0.14); color: #d4a017; }
        .na-ibtn.na-ibtn-on { background: rgba(212,160,23,0.18); color: #d4a017; }
        .na-hdr-mid { display: flex; align-items: center; gap: 10px; }
        .na-hdr-star { font-size: 18px; color: #d4a017; }
        .na-hdr-title { font-size: 15px; font-weight: 600; color: #d4a017; }
        .na-hdr-sub   { font-size: 11px; color: rgba(212,160,23,0.44); margin-top: 2px; }

        /* ── search ── */
        .na-search-row {
          position: relative; z-index: 2; flex-shrink: 0;
          width: 100%; display: flex; align-items: center; gap: 8px;
          padding: 8px 14px;
          background: rgba(2,6,20,0.62); backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(212,160,23,0.10);
        }
        .na-search-ico { color: rgba(212,160,23,0.38); flex-shrink: 0; }
        .na-search {
          flex: 1; background: transparent; border: none; outline: none;
          color: #e8dfc8; font-family: 'Vazirmatn', sans-serif; font-size: 14px;
          direction: rtl;
        }
        .na-search::placeholder { color: rgba(212,160,23,0.28); }
        .na-search-x {
          border: none; background: transparent;
          color: rgba(212,160,23,0.42); font-size: 20px; line-height: 1;
          cursor: pointer; padding: 0 4px; flex-shrink: 0;
        }
        .na-search-x:hover { color: rgba(212,160,23,0.80); }

        /* ── grid view ── */
        .na-grid {
          position: relative; z-index: 1; flex: 1; min-height: 0;
          width: 100%; overflow-y: auto;
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 6px; padding: 10px 10px 24px;
          scrollbar-width: thin; scrollbar-color: rgba(212,160,23,0.20) transparent;
        }
        .na-grid::-webkit-scrollbar { width: 4px; }
        .na-grid::-webkit-scrollbar-thumb { background: rgba(212,160,23,0.22); border-radius: 4px; }

        .na-gcell {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          padding: 10px 6px 8px; border-radius: 14px;
          background: rgba(212,160,23,0.05);
          border: 1px solid rgba(212,160,23,0.13);
          cursor: pointer; transition: all .18s;
        }
        .na-gcell:hover {
          background: rgba(212,160,23,0.12);
          border-color: rgba(212,160,23,0.34);
          transform: translateY(-1px);
        }
        .na-gcell.na-gcell-on {
          background: rgba(212,160,23,0.18);
          border-color: rgba(212,160,23,0.55);
          box-shadow: 0 0 16px rgba(212,160,23,0.18);
        }
        .na-gnum { font-size: 9px; color: rgba(212,160,23,0.38); letter-spacing: .03em; }
        .na-gar  {
          font-family: 'Scheherazade New', serif;
          font-size: 16px; color: #f0e6c0; text-align: center; line-height: 1.4;
        }
        .na-gfa  { font-size: 9px; color: rgba(212,160,23,0.50); text-align: center; }
        .na-empty {
          grid-column: 1/-1; text-align: center;
          color: rgba(212,160,23,0.38); font-size: 14px; padding: 48px 0;
        }

        /* ── progress bar ── */
        .na-prog-row {
          position: relative; z-index: 2; flex-shrink: 0;
          width: 100%; display: flex; align-items: center; gap: 10px;
          padding: 8px 16px;
        }
        .na-prog-track {
          flex: 1; height: 3px; border-radius: 3px;
          background: rgba(212,160,23,0.12); overflow: hidden;
        }
        .na-prog-fill {
          height: 100%; border-radius: 3px;
          background: linear-gradient(90deg, rgba(212,160,23,0.50), #d4a017);
          transition: width .5s cubic-bezier(.22,.68,0,1.2);
          box-shadow: 0 0 6px rgba(212,160,23,0.40);
        }
        .na-prog-lbl {
          font-size: 11px; color: rgba(212,160,23,0.44); white-space: nowrap; flex-shrink: 0;
          font-family: 'Scheherazade New', serif;
        }

        /* ── card ── */
        .na-card {
          position: relative; z-index: 1;
          flex: 1; min-height: 0; overflow-y: auto;
          width: 100%; max-width: 480px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 10px 24px 6px;
          transition: opacity .22s ease, transform .22s ease;
          scrollbar-width: none;
        }
        .na-card::-webkit-scrollbar { display: none; }
        .na-card.na-leaving { opacity: 0; transform: translateX(-22px); }

        .na-num-badge {
          font-family: 'Scheherazade New', serif;
          font-size: 13px; color: rgba(212,160,23,0.55);
          background: rgba(212,160,23,0.10); border: 1px solid rgba(212,160,23,0.22);
          border-radius: 50%; width: 34px; height: 34px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 16px;
        }

        .na-arabic-wrap { width: 100%; display: flex; justify-content: center; flex-shrink: 0; }
        .na-arabic {
          font-family: 'Scheherazade New', serif;
          font-size: clamp(36px, 9vw, 56px); font-weight: 700; line-height: 1.3;
          color: #f5ecd0; text-align: center; direction: rtl;
          text-shadow: 0 0 48px rgba(212,160,23,0.30), 0 2px 10px rgba(0,0,0,0.55);
        }

        .na-trans {
          font-size: 12px; letter-spacing: .09em; color: rgba(212,160,23,0.46);
          margin-top: 10px; text-align: center; direction: ltr; flex-shrink: 0;
        }

        .na-divider {
          width: 44px; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(212,160,23,0.30), transparent);
          margin: 16px auto; flex-shrink: 0;
        }

        .na-meaning {
          font-size: 16px; font-weight: 400; line-height: 1.7;
          color: rgba(240,230,192,0.80); text-align: center; direction: rtl;
          flex-shrink: 0;
        }

        /* ── audio button ── */
        .na-audio-btn {
          margin-top: 18px; flex-shrink: 0;
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 22px; border-radius: 24px;
          background: rgba(212,160,23,0.10); border: 1px solid rgba(212,160,23,0.26);
          color: rgba(212,160,23,0.68);
          font-family: 'Vazirmatn', sans-serif; font-size: 13px;
          cursor: pointer; transition: all .2s;
          -webkit-tap-highlight-color: transparent;
        }
        .na-audio-btn:hover {
          background: rgba(212,160,23,0.18); border-color: rgba(212,160,23,0.50); color: #d4a017;
        }
        .na-audio-btn.na-audio-playing {
          background: rgba(212,160,23,0.20); border-color: rgba(212,160,23,0.60); color: #d4a017;
          box-shadow: 0 0 18px rgba(212,160,23,0.22);
          animation: audioPulse 1.8s ease-in-out infinite;
        }
        .na-audio-btn.na-audio-error {
          border-color: rgba(220,80,80,0.45); color: rgba(220,80,80,0.70);
          background: rgba(220,80,80,0.08);
        }
        @keyframes audioPulse {
          0%,100% { box-shadow: 0 0 10px rgba(212,160,23,0.18); }
          50%      { box-shadow: 0 0 26px rgba(212,160,23,0.42); }
        }
        .na-spin {
          animation: spin360 .9s linear infinite;
        }
        @keyframes spin360 {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        /* ── navigation ── */
        .na-nav {
          position: relative; z-index: 2; flex-shrink: 0;
          display: flex; align-items: center; gap: 16px;
          padding: 6px 0 4px;
        }
        .na-nav-btn {
          width: 46px; height: 46px; border-radius: 50%; border: none;
          background: rgba(212,160,23,0.09); border: 1px solid rgba(212,160,23,0.20);
          color: rgba(212,160,23,0.68);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all .18s;
        }
        .na-nav-btn:hover {
          background: rgba(212,160,23,0.18); border-color: rgba(212,160,23,0.50); color: #d4a017;
        }
        .na-daily-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 10px 18px; border-radius: 22px;
          background: rgba(212,160,23,0.09); border: 1px solid rgba(212,160,23,0.24);
          color: rgba(212,160,23,0.62);
          font-family: 'Vazirmatn', sans-serif; font-size: 12px;
          cursor: pointer; transition: all .18s;
        }
        .na-daily-btn:hover {
          background: rgba(212,160,23,0.18); border-color: rgba(212,160,23,0.52); color: #d4a017;
        }

        /* ── quick-jump dots ── */
        .na-dots {
          position: relative; z-index: 2; flex-shrink: 0;
          display: flex; flex-wrap: wrap; justify-content: center;
          gap: 4px; padding: 4px 20px 14px; max-width: 340px;
        }
        .na-dot {
          width: 6px; height: 6px; border-radius: 50%; border: none; padding: 0;
          background: rgba(212,160,23,0.18); cursor: pointer; transition: all .18s;
        }
        .na-dot:hover   { background: rgba(212,160,23,0.52); transform: scale(1.45); }
        .na-dot.na-dot-on {
          background: #d4a017;
          box-shadow: 0 0 7px rgba(212,160,23,0.65);
          transform: scale(1.55);
        }
      `}</style>
    </div>
  );
}
