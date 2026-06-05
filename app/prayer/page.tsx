"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Timings { [k: string]: string }
interface HijriInfo { day: string; monthNum: number; monthFa: string; year: string }
interface UpEvent  { name: string; emoji: string; days: number }

// ─── Constants ────────────────────────────────────────────────────────────────
const PRAYER_KEYS    = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const PRAYER_ORDER   = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const PRAYER_FA: Record<string,string> = {
  Fajr: 'فجر', Sunrise: 'طلوع', Dhuhr: 'ظهر', Asr: 'عصر', Maghrib: 'مغرب', Isha: 'عشا',
};
const HIJRI_M_FA = [
  '','محرم','صفر','ربیع‌الاول','ربیع‌الثانی',
  'جمادی‌الاول','جمادی‌الثانی','رجب','شعبان',
  'رمضان','شوال','ذی‌القعده','ذی‌الحجه',
];
const EVENTS = [
  { m:1,  d:1,  name:'سال نو هجری',    emoji:'🌙' },
  { m:1,  d:10, name:'عاشورا',          emoji:'🕌' },
  { m:3,  d:12, name:'میلاد پیامبر ﷺ', emoji:'⭐' },
  { m:7,  d:27, name:'اسراء و معراج',   emoji:'✨' },
  { m:9,  d:1,  name:'آغاز رمضان',      emoji:'🌙' },
  { m:9,  d:27, name:'شب قدر',          emoji:'✨' },
  { m:10, d:1,  name:'عید فطر',         emoji:'🎊' },
  { m:12, d:9,  name:'روز عرفه',        emoji:'🕌' },
  { m:12, d:10, name:'عید قربان',       emoji:'🎊' },
];
const KAABA = { lat: 21.4225, lon: 39.8262 };
// Free adhan audio from Islamic Network CDN
const ADHAN_URL      = 'https://cdn.islamic.network/adhan/audio/adhan-jaber.mp3';
const ADHAN_FAJR_URL = 'https://cdn.islamic.network/adhan/audio/fajr-adhan-abu-mazen.mp3';

// ─── Pure helpers ─────────────────────────────────────────────────────────────
function calcQibla(lat: number, lon: number): number {
  const toR = (d: number) => d * Math.PI / 180;
  const φ1 = toR(lat),  λ1 = toR(lon);
  const φ2 = toR(KAABA.lat), λ2 = toR(KAABA.lon);
  const dλ = λ2 - λ1;
  const x  = Math.sin(dλ) * Math.cos(φ2);
  const y  = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  return ((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360;
}

function toMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function getNextPrayer(timings: Timings): { name: string; time: string } {
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  for (const p of PRAYER_ORDER) if (timings[p] && toMins(timings[p]) > now) return { name: p, time: timings[p] };
  return { name: 'Fajr', time: timings['Fajr'] };
}

function makeCountdown(targetTime: string): string {
  const [h, m] = targetTime.split(':').map(Number);
  const now  = new Date();
  const tgt  = new Date(now);
  tgt.setHours(h, m, 0, 0);
  if (tgt.getTime() <= now.getTime()) tgt.setDate(tgt.getDate() + 1);
  const diff = tgt.getTime() - now.getTime();
  const hh = String(Math.floor(diff / 3600000)).padStart(2, '0');
  const mm = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
  const ss = String(Math.floor((diff % 60000)   / 1000)).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function isNextDay(targetTime: string): boolean {
  const [h, m] = targetTime.split(':').map(Number);
  const tgt  = new Date(); tgt.setHours(h, m, 0, 0);
  return tgt.getTime() <= new Date().getTime();
}

function upcomingEvents(month: number, day: number): UpEvent[] {
  const A   = 29.530588;
  const cur = (month - 1) * A + day;
  return EVENTS
    .map(e => { let d = Math.round((e.m - 1) * A + e.d - cur); if (d <= 0) d += 354; return { name: e.name, emoji: e.emoji, days: d }; })
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PrayerPage() {
  const router = useRouter();

  // Location
  const [locStatus, setLocStatus]   = useState<'idle'|'requesting'|'granted'|'denied'>('idle');
  const [coords,    setCoords]      = useState<{lat:number;lon:number}|null>(null);

  // Prayer data
  const [timings,   setTimings]     = useState<Timings|null>(null);
  const [hijri,     setHijri]       = useState<HijriInfo|null>(null);
  const [events,    setEvents]      = useState<UpEvent[]>([]);
  const [next,      setNext]        = useState<{name:string;time:string}|null>(null);
  const [cd,        setCd]          = useState('');

  // Qibla
  const [qibla,         setQibla]         = useState<number|null>(null);
  const [compassHead,   setCompassHead]   = useState<number>(0);
  const [compassActive, setCompassActive] = useState(false);

  // Adhan
  const [playing,  setPlaying]  = useState<string|null>(null);
  const audioRef               = useRef<HTMLAudioElement|null>(null);

  // Auto-azan
  const [autoAzan,   setAutoAzan]   = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('monir_auto_azan') === '1';
  });
  const [azanToast,  setAzanToast]  = useState<string|null>(null);
  const autoAzanRef       = useRef(autoAzan);
  const timingsRef        = useRef<Timings|null>(null);
  const lastAutoPlayedRef = useRef('');

  // ── 1. Request GPS ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) { setLocStatus('denied'); return; }
    setLocStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = pos.coords.latitude, lon = pos.coords.longitude;
        setCoords({ lat, lon });
        setQibla(calcQibla(lat, lon));
        setLocStatus('granted');
      },
      () => setLocStatus('denied'),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300_000 },
    );
  }, []);

  // Keep auto-azan refs in sync with state
  useEffect(() => { autoAzanRef.current = autoAzan; }, [autoAzan]);
  useEffect(() => { timingsRef.current  = timings;  }, [timings]);

  // ── 2. Fetch prayer times ───────────────────────────────────────────────────
  useEffect(() => {
    if (!coords) return;
    const { lat, lon } = coords;
    // Method 3 = Muslim World League, appropriate for Europe
    fetch(`https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lon}&method=3`)
      .then(r => r.json())
      .then(d => {
        const t = d?.data?.timings  as Timings;
        const h = d?.data?.date?.hijri;
        if (t) {
          setTimings(t);
          setNext(getNextPrayer(t));
        }
        if (h) {
          const mNum = parseInt(h.month.number);
          setHijri({ day: h.day, monthNum: mNum, monthFa: HIJRI_M_FA[mNum] ?? h.month.en, year: h.year });
          setEvents(upcomingEvents(mNum, parseInt(h.day)));
        }
      })
      .catch(() => {});
  }, [coords]);

  // ── 3. Live countdown + auto-azan trigger ──────────────────────────────────
  useEffect(() => {
    if (!next) return;
    const tick = () => {
      setCd(makeCountdown(next.time));
      if (!autoAzanRef.current || !timingsRef.current) return;
      const now    = new Date();
      const nowStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      for (const p of PRAYER_ORDER) {
        const pTime = (timingsRef.current[p] ?? '').slice(0, 5);
        if (pTime !== nowStr) continue;
        const key = `${p}-${nowStr}`;
        if (lastAutoPlayedRef.current === key) break;
        lastAutoPlayedRef.current = key;
        // Stop any currently playing audio and start the azan
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        const src = p === 'Fajr' ? ADHAN_FAJR_URL : ADHAN_URL;
        const a   = new Audio(src);
        audioRef.current = a;
        a.play().catch(() => {});
        a.onended = () => { setPlaying(null); audioRef.current = null; };
        setPlaying(p);
        setAzanToast(PRAYER_FA[p] ?? p);
        setTimeout(() => setAzanToast(null), 7000);
        setNext(getNextPrayer(timingsRef.current));
        break;
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [next]);

  // ── 4. Update daily streak ──────────────────────────────────────────────────
  useEffect(() => {
    getSupabaseBrowser().auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id) return;
      fetch('/api/streak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id }),
      }).catch(() => {});
    });
  }, []);

  // ── 5. Device compass ───────────────────────────────────────────────────────
  const enableCompass = useCallback(async () => {
    const DOE = DeviceOrientationEvent as any;
    if (typeof DOE.requestPermission === 'function') {
      try { if ((await DOE.requestPermission()) !== 'granted') return; }
      catch { return; }
    }
    const handler = (e: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
      const h = e.webkitCompassHeading ?? (e.alpha !== null ? (360 - (e.alpha ?? 0)) % 360 : null);
      if (h !== null) setCompassHead(h);
    };
    window.addEventListener('deviceorientationabsolute', handler as any, true);
    window.addEventListener('deviceorientation',         handler as any, true);
    setCompassActive(true);
  }, []);

  // ── 6. Adhan playback ───────────────────────────────────────────────────────
  const playAdhan = useCallback((prayerKey: string) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (playing === prayerKey) { setPlaying(null); return; }
    const src = prayerKey === 'Fajr' ? ADHAN_FAJR_URL : ADHAN_URL;
    const a   = new Audio(src);
    audioRef.current = a;
    a.play().catch(() => { setPlaying(null); audioRef.current = null; });
    a.onended = () => { setPlaying(null); audioRef.current = null; };
    setPlaying(prayerKey);
  }, [playing]);

  // ── 7. Auto-azan toggle ─────────────────────────────────────────────────────
  const toggleAutoAzan = useCallback(() => {
    setAutoAzan(v => {
      const next = !v;
      localStorage.setItem('monir_auto_azan', next ? '1' : '0');
      autoAzanRef.current = next;
      return next;
    });
  }, []);

  // Needle angle in screen-space = absolute Qibla bearing minus device heading
  const needleAngle = qibla !== null ? (qibla - (compassActive ? compassHead : 0) + 360) % 360 : 0;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700&display=swap" rel="stylesheet"/>
      <div className="bg"/>

      <div className="app">

        {/* ── Header ── */}
        <header className="hdr">
          <button className="ibtn" onClick={() => router.push("/")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15,18 9,12 15,6"/>
            </svg>
          </button>
          <div className="hdr-mid">
            <div className="logo">☽</div>
            <div>
              <div className="hdr-title">اوقات شرعی</div>
              <div className="hdr-sub">Prayer Times &amp; Qibla</div>
            </div>
          </div>
          <div style={{width:40}}/>
        </header>

        <div className="scroll">

          {/* ── Auto-azan toast ── */}
        {azanToast && (
          <div className="azan-toast">
            <span className="azan-toast-icon">🕌</span>
            <div className="azan-toast-text">
              <span className="azan-toast-title">وقت نماز {azanToast}</span>
              <span className="azan-toast-sub">اذان در حال پخش است</span>
            </div>
          </div>
        )}

        {/* ── Location status ── */}
          {locStatus === 'requesting' && (
            <div className="loc-card">
              <span className="spinner-sm"/>
              <span>در حال دریافت موقعیت...</span>
            </div>
          )}
          {locStatus === 'denied' && (
            <div className="loc-card loc-denied">
              <span className="loc-icon">📍</span>
              <span>برای اوقات شرعی دقیق، دسترسی به موقعیت را از تنظیمات مرورگر فعال کنید</span>
            </div>
          )}

          {/* ── Islamic date card ── */}
          {hijri && (
            <div className="date-card">
              <div className="date-main">
                <span className="date-day">{hijri.day}</span>
                <div className="date-text">
                  <span className="date-month">{hijri.monthFa}</span>
                  <span className="date-year">{hijri.year} ه‍.ق</span>
                </div>
              </div>
              <div className="date-greg">
                {new Date().toLocaleDateString('fa-IR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
              </div>
            </div>
          )}

          {/* ── Upcoming Islamic events ── */}
          {events.length > 0 && (
            <div className="ev-section">
              <h3 className="sec-title"><span>📅</span> رویدادهای اسلامی</h3>
              <div className="ev-scroll">
                {events.map(ev => (
                  <div key={ev.name} className="ev-chip">
                    <span className="ev-emoji">{ev.emoji}</span>
                    <span className="ev-name">{ev.name}</span>
                    <span className="ev-days">~{ev.days} روز</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Next prayer countdown ── */}
          {next && (
            <div className="cd-card">
              <div className="cd-label">نماز بعدی</div>
              <div className="cd-prayer">{PRAYER_FA[next.name]}</div>
              <div className="cd-clock">{cd}</div>
              <div className="cd-time">{next.time} — {isNextDay(next.time) ? 'فردا' : 'امروز'}</div>
              <div className="cd-hijri">
                {new Intl.DateTimeFormat('fa-u-ca-islamic', { day:'numeric', month:'long', year:'numeric' }).format(new Date())}
              </div>
            </div>
          )}

          {/* ── Prayer times list ── */}
          {timings && (
            <section className="section">
              <div className="sec-title-row">
                <h3 className="sec-title"><span>🕐</span> اوقات نماز</h3>
                <button
                  className={`auto-azan-btn${autoAzan ? ' auto-azan-on' : ''}`}
                  onClick={toggleAutoAzan}
                  aria-label={autoAzan ? 'غیرفعال کردن اذان خودکار' : 'فعال کردن اذان خودکار'}
                  title={autoAzan ? 'اذان خودکار فعال است' : 'اذان خودکار غیرفعال است'}
                >
                  {autoAzan ? '🔔' : '🔕'}
                  <span>{autoAzan ? 'اذان خودکار' : 'اذان خودکار'}</span>
                </button>
              </div>
              <div className="prayer-list">
                {PRAYER_KEYS.map(key => {
                  const time  = timings[key];
                  if (!time) return null;
                  const isNext    = next?.name === key;
                  const hasAdhan  = key !== 'Sunrise';
                  const isPlaying = playing === key;
                  return (
                    <div key={key} className={`p-row${isNext ? ' p-next' : ''}`}>
                      <div className="p-left">
                        {isNext && <span className="p-dot"/>}
                        <span className="p-name">{PRAYER_FA[key]}</span>
                      </div>
                      <div className="p-right">
                        <span className="p-time">{time}</span>
                        {hasAdhan && (
                          <button
                            className={`adhan-btn${isPlaying ? ' adhan-on' : ''}`}
                            onClick={() => playAdhan(key)}
                            aria-label={isPlaying ? 'توقف اذان' : 'پخش اذان'}
                          >
                            {isPlaying ? (
                              /* pause icon */
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="4" width="4" height="16" rx="1"/>
                                <rect x="14" y="4" width="4" height="16" rx="1"/>
                              </svg>
                            ) : (
                              /* speaker + waves icon */
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Qibla compass ── */}
          {qibla !== null && (
            <section className="section">
              <h3 className="sec-title"><span>🧭</span> جهت قبله</h3>
              <div className="compass-card">

                {/* Ring */}
                <div className="compass-wrap">
                  <div
                    className="compass-ring"
                    style={{ transform: compassActive ? `rotate(${-compassHead}deg)` : 'none' }}
                  >
                    {/* Cardinal labels */}
                    <span className="cn" style={{top:'8px',left:'50%',transform:'translateX(-50%)'}}>N</span>
                    <span className="cn" style={{bottom:'8px',left:'50%',transform:'translateX(-50%)'}}>S</span>
                    <span className="cn" style={{right:'8px',top:'50%',transform:'translateY(-50%)'}}>E</span>
                    <span className="cn" style={{left:'8px',top:'50%',transform:'translateY(-50%)'}}>W</span>
                    {/* Degree tick marks */}
                    {Array.from({length:12}).map((_,i) => (
                      <span key={i} className="tick" style={{ transform:`rotate(${i*30}deg) translateX(-50%)`, position:'absolute', left:'50%', top:'4px', height:'8px' }}/>
                    ))}
                  </div>

                  {/* Needle — rotated to point at Qibla */}
                  <div className="needle-wrap" style={{ transform:`rotate(${needleAngle}deg)` }}>
                    <div className="needle-top"/>
                    <div className="needle-kaaba">🕋</div>
                    <div className="needle-bot"/>
                  </div>

                  {/* Center dot */}
                  <div className="compass-center"/>
                </div>

                <div className="qibla-info">
                  <span className="qibla-deg">{Math.round(qibla)}°</span>
                  <span className="qibla-lbl">از شمال</span>
                </div>

                {!compassActive && (
                  <button className="compass-btn" onClick={enableCompass}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginLeft:6}}>
                      <circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
                    </svg>
                    فعال کردن قطب‌نما
                  </button>
                )}
                {compassActive && (
                  <div className="compass-active-note">قطب‌نما فعال است — گوشی را بچرخانید</div>
                )}
              </div>
            </section>
          )}

          <div style={{height:32}}/>
        </div>
      </div>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #020d1f; overflow: hidden; }

        .bg {
          position: fixed; inset: 0; z-index: 0;
          background-image: url('https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1080&q=85');
          background-size: cover; background-position: center;
        }
        .bg::after {
          content:''; position:absolute; inset:0;
          background: linear-gradient(180deg,
            rgba(2,8,22,0.32) 0%, rgba(4,10,24,0.18) 25%,
            rgba(10,6,2,0.30) 60%, rgba(6,3,0,0.92) 100%);
        }
        .app {
          position:relative; z-index:1; height:100dvh;
          font-family:'Vazirmatn',sans-serif; direction:rtl; color:#e8dfc8;
          display:flex; flex-direction:column; overflow:hidden;
        }

        /* ── header ── */
        .hdr {
          display:flex; align-items:center; justify-content:space-between;
          padding:12px 16px; flex-shrink:0;
          background:rgba(2,8,26,0.82);
          backdrop-filter:blur(22px) saturate(170%);
          border-bottom:1px solid rgba(212,160,23,0.14);
          box-shadow:0 8px 40px rgba(0,0,0,0.45);
        }
        .hdr-mid { display:flex; align-items:center; gap:11px; }
        .logo {
          width:42px; height:42px; border-radius:50%; flex-shrink:0;
          background:radial-gradient(circle at 36% 36%, #fff5d0, #d4a017 42%, #7a5200 88%);
          display:flex; align-items:center; justify-content:center; font-size:20px;
          animation:lp 3.2s ease-in-out infinite;
        }
        @keyframes lp {
          0%,100% { box-shadow:0 0 14px rgba(212,160,23,.55),0 0 28px rgba(212,160,23,.28); }
          50%      { box-shadow:0 0 26px rgba(212,160,23,.85),0 0 52px rgba(212,160,23,.45); }
        }
        .hdr-title { color:#d4a017; font-weight:700; font-size:17px; }
        .hdr-sub   { color:rgba(212,160,23,0.46); font-size:11px; font-weight:300; margin-top:1px; }
        .ibtn {
          width:40px; height:40px; border-radius:50%; border:none;
          background:rgba(255,255,255,0.09); backdrop-filter:blur(14px);
          color:rgba(212,160,23,0.80);
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; transition:background .2s;
        }
        .ibtn:hover { background:rgba(255,255,255,0.14); }

        /* ── scroll ── */
        .scroll {
          flex:1; overflow-y:auto; min-height:0;
          padding:16px 14px;
          display:flex; flex-direction:column; gap:16px;
        }
        .scroll::-webkit-scrollbar { width:3px; }
        .scroll::-webkit-scrollbar-thumb { background:rgba(212,160,23,0.20); border-radius:2px; }

        /* ── location status ── */
        .loc-card {
          display:flex; align-items:center; gap:10px;
          padding:14px 16px;
          background:rgba(8,12,28,0.80);
          border:1px solid rgba(212,160,23,0.18);
          border-radius:14px;
          font-size:13px; color:rgba(212,160,23,0.60);
          animation:pop .3s ease both;
        }
        .loc-denied { border-color:rgba(212,160,23,0.28); color:rgba(232,223,200,0.70); }
        .loc-icon   { font-size:18px; flex-shrink:0; }
        .spinner-sm {
          width:18px; height:18px; border-radius:50%; flex-shrink:0;
          border:2px solid rgba(212,160,23,0.20);
          border-top-color:rgba(212,160,23,0.70);
          animation:spin 0.9s linear infinite;
        }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes pop {
          from { opacity:0; transform:translateY(8px) scale(.97); }
          to   { opacity:1; transform:none; }
        }

        /* ── Islamic date card ── */
        .date-card {
          background:rgba(8,12,28,0.85);
          border:1px solid rgba(212,160,23,0.28);
          border-radius:20px; padding:20px 22px;
          display:flex; flex-direction:column; gap:10px;
          backdrop-filter:blur(20px);
          box-shadow:0 4px 32px rgba(0,0,0,0.50),inset 0 1px 0 rgba(212,160,23,0.07);
          animation:pop .35s ease both;
        }
        .date-main {
          display:flex; align-items:center; gap:16px; direction:rtl;
        }
        .date-day {
          font-size:54px; font-weight:700; color:#d4a017; line-height:1;
          text-shadow:0 0 28px rgba(212,160,23,0.55);
        }
        .date-text  { display:flex; flex-direction:column; gap:3px; }
        .date-month { font-size:22px; font-weight:600; color:#e8d5a0; }
        .date-year  { font-size:13px; font-weight:300; color:rgba(212,160,23,0.55); }
        .date-greg  {
          font-size:12.5px; color:rgba(212,160,23,0.42);
          border-top:1px solid rgba(212,160,23,0.10); padding-top:10px;
        }

        /* ── upcoming events ── */
        .ev-section { display:flex; flex-direction:column; gap:10px; }
        .ev-scroll  {
          display:flex; gap:10px; overflow-x:auto; padding-bottom:4px;
          scrollbar-width:none;
        }
        .ev-scroll::-webkit-scrollbar { display:none; }
        .ev-chip {
          flex-shrink:0;
          display:flex; flex-direction:column; align-items:center; gap:5px;
          background:rgba(8,12,28,0.82);
          border:1px solid rgba(212,160,23,0.18);
          border-radius:16px; padding:12px 14px; min-width:90px;
          backdrop-filter:blur(16px);
          animation:pop .3s ease both;
        }
        .ev-emoji { font-size:22px; }
        .ev-name  { font-size:11.5px; font-weight:500; color:#e0cfa0; text-align:center; }
        .ev-days  { font-size:11px; color:rgba(212,160,23,0.50); }

        /* ── countdown card ── */
        .cd-card {
          background:rgba(8,12,28,0.88);
          border:1px solid rgba(212,160,23,0.35);
          border-radius:22px; padding:24px 20px;
          display:flex; flex-direction:column; align-items:center; gap:6px;
          backdrop-filter:blur(24px);
          box-shadow:0 6px 40px rgba(0,0,0,0.55),0 0 60px rgba(212,160,23,0.06);
          animation:pop .4s ease both;
        }
        .cd-label  { font-size:12px; color:rgba(212,160,23,0.50); letter-spacing:.08em; }
        .cd-prayer { font-size:28px; font-weight:700; color:#d4a017; text-shadow:0 0 24px rgba(212,160,23,0.55); }
        .cd-clock  {
          font-size:46px; font-weight:700; color:#e8d5a0;
          font-variant-numeric:tabular-nums; letter-spacing:.06em;
          text-shadow:0 0 20px rgba(212,160,23,0.30);
          font-family:ui-monospace,monospace;
        }
        .cd-time  { font-size:13px; color:rgba(212,160,23,0.45); margin-top:2px; }
        .cd-hijri { font-size:11px; color:rgba(212,160,23,0.38); margin-top:1px; }

        /* ── section titles ── */
        .section { display:flex; flex-direction:column; gap:10px; }
        .sec-title {
          font-size:12.5px; font-weight:500; color:rgba(212,160,23,0.52);
          display:flex; align-items:center; gap:7px; padding-right:4px;
        }

        /* ── prayer list ── */
        .prayer-list {
          background:rgba(8,12,28,0.82);
          border:1px solid rgba(212,160,23,0.16);
          border-radius:18px; overflow:hidden;
          backdrop-filter:blur(18px);
        }
        .p-row {
          display:flex; align-items:center; justify-content:space-between;
          padding:14px 18px;
          border-bottom:1px solid rgba(212,160,23,0.07);
          transition:background .15s;
        }
        .p-row:last-child { border-bottom:none; }
        .p-row.p-next {
          background:rgba(212,160,23,0.06);
          border-bottom-color:rgba(212,160,23,0.12);
        }
        .p-left  { display:flex; align-items:center; gap:10px; }
        .p-right { display:flex; align-items:center; gap:10px; }
        .p-dot {
          width:7px; height:7px; border-radius:50%;
          background:#d4a017;
          box-shadow:0 0 6px rgba(212,160,23,0.80);
          animation:pulse 1.8s ease-in-out infinite;
        }
        @keyframes pulse {
          0%,100% { box-shadow:0 0 6px rgba(212,160,23,0.80); }
          50%      { box-shadow:0 0 14px rgba(212,160,23,1); }
        }
        .p-name { font-size:15px; font-weight:500; color:#e8d5a0; }
        .p-time { font-size:15px; font-weight:400; color:rgba(212,160,23,0.75); font-variant-numeric:tabular-nums; }
        .adhan-btn {
          width:30px; height:30px; border-radius:50%; border:none; flex-shrink:0;
          background:rgba(212,160,23,0.10);
          color:rgba(212,160,23,0.60);
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; transition:all .2s;
        }
        .adhan-btn:hover { background:rgba(212,160,23,0.20); color:#d4a017; }
        .adhan-btn.adhan-on {
          background:rgba(212,160,23,0.22);
          color:#d4a017;
          box-shadow:0 0 10px rgba(212,160,23,0.35);
          animation:pulse 1.4s ease-in-out infinite;
        }

        /* ── Qibla compass ── */
        .compass-card {
          display:flex; flex-direction:column; align-items:center; gap:16px;
          background:rgba(8,12,28,0.82);
          border:1px solid rgba(212,160,23,0.20);
          border-radius:20px; padding:24px 20px;
          backdrop-filter:blur(20px);
          animation:pop .4s ease both;
        }
        .compass-wrap {
          position:relative; width:200px; height:200px;
        }
        .compass-ring {
          position:absolute; inset:0; border-radius:50%;
          border:2px solid rgba(212,160,23,0.28);
          background:radial-gradient(circle, rgba(4,10,28,0.90) 60%, rgba(8,18,42,0.70) 100%);
          transition:transform .12s linear;
        }
        .cn {
          position:absolute;
          font-size:11px; font-weight:700;
          color:rgba(212,160,23,0.75);
          font-family:ui-monospace,monospace;
        }
        .tick {
          width:1px; background:rgba(212,160,23,0.22);
          transform-origin:top center;
          display:block;
        }
        /* needle */
        .needle-wrap {
          position:absolute; inset:0;
          display:flex; flex-direction:column; align-items:center;
          transform-origin:center center;
          transition:transform .25s cubic-bezier(.22,.68,0,1.2);
        }
        .needle-top {
          width:4px; height:68px; margin-top:12px;
          background:linear-gradient(to bottom, #fff5cc, #d4a017 60%, rgba(212,160,23,0.4));
          border-radius:2px 2px 0 0;
          clip-path:polygon(50% 0%, 0% 100%, 100% 100%);
        }
        .needle-kaaba {
          font-size:18px; margin-top:-4px; line-height:1;
          filter:drop-shadow(0 0 6px rgba(212,160,23,0.80));
        }
        .needle-bot {
          width:4px; height:40px;
          background:rgba(212,160,23,0.18);
          border-radius:0 0 2px 2px;
          clip-path:polygon(0% 0%, 100% 0%, 50% 100%);
        }
        .compass-center {
          position:absolute; top:50%; left:50%;
          width:12px; height:12px; border-radius:50%;
          background:#d4a017;
          transform:translate(-50%,-50%);
          box-shadow:0 0 10px rgba(212,160,23,0.70);
          z-index:2;
        }
        .qibla-info {
          display:flex; align-items:baseline; gap:6px;
        }
        .qibla-deg { font-size:24px; font-weight:700; color:#d4a017; }
        .qibla-lbl { font-size:13px; color:rgba(212,160,23,0.50); }
        .compass-btn {
          display:flex; align-items:center;
          padding:10px 18px;
          background:rgba(212,160,23,0.10);
          border:1px solid rgba(212,160,23,0.28);
          border-radius:12px; color:rgba(212,160,23,0.75);
          font-size:13px; font-family:'Vazirmatn',sans-serif;
          cursor:pointer; transition:all .2s;
        }
        .compass-btn:hover { background:rgba(212,160,23,0.18); color:#d4a017; }
        .compass-active-note {
          font-size:12px; color:rgba(212,160,23,0.45);
          text-align:center;
        }

        /* ── auto-azan ── */
        .sec-title-row {
          display:flex; align-items:center; justify-content:space-between;
        }
        .auto-azan-btn {
          display:flex; align-items:center; gap:5px;
          padding:6px 12px;
          background:rgba(212,160,23,0.08);
          border:1px solid rgba(212,160,23,0.22);
          border-radius:20px;
          color:rgba(212,160,23,0.55);
          font-size:11.5px; font-family:'Vazirmatn',sans-serif;
          cursor:pointer; transition:all .2s; white-space:nowrap;
        }
        .auto-azan-btn:hover { background:rgba(212,160,23,0.15); color:rgba(212,160,23,0.80); }
        .auto-azan-btn.auto-azan-on {
          background:rgba(212,160,23,0.16);
          border-color:rgba(212,160,23,0.50);
          color:#d4a017;
          box-shadow:0 0 8px rgba(212,160,23,0.25);
        }

        /* ── azan toast ── */
        .azan-toast {
          position:fixed; top:80px; left:50%; transform:translateX(-50%);
          z-index:100;
          display:flex; align-items:center; gap:12px;
          padding:14px 20px;
          background:rgba(8,14,32,0.96);
          border:1px solid rgba(212,160,23,0.55);
          border-radius:18px;
          backdrop-filter:blur(24px);
          box-shadow:0 8px 40px rgba(0,0,0,0.70),0 0 40px rgba(212,160,23,0.12);
          animation:toastIn .4s cubic-bezier(.22,.68,0,1.2) both;
          min-width:220px; max-width:calc(100vw - 32px);
        }
        @keyframes toastIn {
          from { opacity:0; transform:translateX(-50%) translateY(-14px) scale(.94); }
          to   { opacity:1; transform:translateX(-50%) translateY(0) scale(1); }
        }
        .azan-toast-icon { font-size:26px; flex-shrink:0; }
        .azan-toast-text { display:flex; flex-direction:column; gap:2px; }
        .azan-toast-title { font-size:15px; font-weight:600; color:#e8d5a0; }
        .azan-toast-sub   { font-size:12px; color:rgba(212,160,23,0.55); }
      `}</style>
    </>
  );
}
