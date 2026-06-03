"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface Props {
  onClose: () => void;
}

function toArabic(n: number): string {
  return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]);
}

const TARGETS = [
  { val: 33,  lbl: '۳۳'  },
  { val: 99,  lbl: '۹۹'  },
  { val: 100, lbl: '۱۰۰' },
  { val: 0,   lbl: 'آزاد' },
];

const DHIKR_PRESETS = [
  { ar: 'سُبْحَانَ ٱللَّٰه',    fa: 'تسبیح',     target: 33  },
  { ar: 'ٱلْحَمْدُ لِلَّٰه',    fa: 'تحمید',     target: 33  },
  { ar: 'ٱللَّٰهُ أَكْبَرُ',    fa: 'تکبیر',     target: 33  },
  { ar: 'أَسْتَغْفِرُ ٱللَّٰه', fa: 'استغفار',    target: 100 },
];

function autoDhikr(count: number, target: number): { ar: string; fa: string } {
  if (target === 99 || target === 100) {
    if (count === 0) return { ar: 'سُبْحَانَ ٱللَّٰه', fa: 'تسبیح' };
    const c = ((count - 1) % 99) + 1;
    if (c <= 33) return { ar: 'سُبْحَانَ ٱللَّٰه', fa: 'تسبیح' };
    if (c <= 66) return { ar: 'ٱلْحَمْدُ لِلَّٰه',  fa: 'تحمید' };
    return           { ar: 'ٱللَّٰهُ أَكْبَرُ',    fa: 'تکبیر'  };
  }
  return { ar: 'سُبْحَانَ ٱللَّٰه', fa: 'تسبیح' };
}

function ls(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return localStorage.getItem(key) ?? fallback;
}

export function TasbihWidget({ onClose }: Props) {
  const [count,       setCount]       = useState(() => parseInt(ls('tb_count',  '0'))  || 0);
  const [target,      setTarget]      = useState(() => parseInt(ls('tb_target', '33')) || 33);
  const [completed,   setCompleted]   = useState(false);
  const [cycles,      setCycles]      = useState(() => parseInt(ls('tb_cycles', '0'))  || 0);
  const [activeDhikr, setActiveDhikr] = useState<number | null>(() => {
    const v = ls('tb_dhikr', '');
    return v !== '' ? parseInt(v) : null;
  });
  const [nightMode,    setNightMode]   = useState(() => ls('tb_night', '0') === '1');
  const [showConfirm,  setShowConfirm] = useState(false);

  const beadRef     = useRef<HTMLButtonElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // ── Persist to localStorage ──────────────────────────────────────────────
  useEffect(() => { localStorage.setItem('tb_count',  String(count));  }, [count]);
  useEffect(() => { localStorage.setItem('tb_cycles', String(cycles)); }, [cycles]);
  useEffect(() => { localStorage.setItem('tb_target', String(target)); }, [target]);

  // ── Soft bead click sound ────────────────────────────────────────────────
  const playBead = useCallback(() => {
    try {
      const AC = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AC();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      // Short filtered noise burst → wooden bead click
      const len = Math.floor(ctx.sampleRate * 0.055);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d   = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.007));
      }
      const src  = ctx.createBufferSource();
      src.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type            = 'bandpass';
      filt.frequency.value = 1600;
      filt.Q.value         = 0.7;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.45, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.055);
      src.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
      src.start();
    } catch { /* AudioContext may be unavailable in some environments */ }
  }, []);

  // ── Core tap ─────────────────────────────────────────────────────────────
  const tap = useCallback(() => {
    playBead();
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(14);

    if (beadRef.current) {
      beadRef.current.classList.remove('tb-tap');
      void beadRef.current.offsetWidth;
      beadRef.current.classList.add('tb-tap');
    }

    if (completed) {
      setCount(1);
      setCompleted(false);
      return;
    }

    setCount(prev => {
      const next = prev + 1;
      if (target > 0 && next >= target) {
        setCycles(c => c + 1);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([35, 20, 35, 20, 70]);
        }
        setCompleted(true);
      }
      return next;
    });
  }, [completed, target, playBead]);

  // ── Full-screen tap handler (skips buttons & dialogs) ───────────────────
  const handleScreenTap = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    if (el.closest('button') || el.closest('.tb-confirm-box')) return;
    tap();
  }, [tap]);

  // ── Reset (with confirmation) ────────────────────────────────────────────
  const confirmReset = useCallback(() => setShowConfirm(true), []);
  const cancelReset  = useCallback(() => setShowConfirm(false), []);
  const doReset      = useCallback(() => {
    setCount(0); setCompleted(false); setCycles(0); setShowConfirm(false);
  }, []);

  // ── Target selector ──────────────────────────────────────────────────────
  const selectTarget = useCallback((t: number) => {
    setTarget(t); setCount(0); setCompleted(false); setCycles(0); setActiveDhikr(null);
    localStorage.removeItem('tb_dhikr');
  }, []);

  // ── Dhikr preset selector ────────────────────────────────────────────────
  const selectDhikr = useCallback((idx: number) => {
    const p = DHIKR_PRESETS[idx];
    setActiveDhikr(idx);
    setTarget(p.target);
    setCount(0); setCompleted(false); setCycles(0);
    localStorage.setItem('tb_dhikr', String(idx));
  }, []);

  // ── Night mode toggle ────────────────────────────────────────────────────
  const toggleNight = useCallback(() => {
    setNightMode(v => {
      const next = !v;
      localStorage.setItem('tb_night', next ? '1' : '0');
      return next;
    });
  }, []);

  const dhikr   = activeDhikr !== null
    ? { ar: DHIKR_PRESETS[activeDhikr].ar, fa: DHIKR_PRESETS[activeDhikr].fa }
    : autoDhikr(count, target);
  const progress = target > 0 ? Math.min(count / target, 1) : 0;
  const R        = 108;
  const circ     = 2 * Math.PI * R;
  const offset   = circ * (1 - progress);

  return (
    <div className={`tb${nightMode ? ' tb-night' : ''}`} onClick={handleScreenTap}>
      {/* ── Background ── */}
      <div className="tb-bg"/>
      <div className="tb-dim"/>

      {/* ── Close ── */}
      <button className="tb-x" onClick={onClose} aria-label="بستن">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6"  y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      {/* ── Night mode toggle ── */}
      <button className="tb-night-btn" onClick={toggleNight} aria-label="تغییر حالت شب">
        {nightMode
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" fill="none"/></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        }
      </button>

      {/* ── Heading ── */}
      <h1 className="tb-heading">تسبیح دیجیتال</h1>

      {/* ── Dhikr preset buttons ── */}
      <div className="tb-presets">
        {DHIKR_PRESETS.map((p, i) => (
          <button
            key={i}
            className={`tb-preset${activeDhikr === i ? ' on' : ''}`}
            onClick={() => selectDhikr(i)}
          >
            <span className="tb-preset-ar">{p.ar}</span>
            <span className="tb-preset-fa">{p.fa}</span>
          </button>
        ))}
      </div>

      {/* ── Dhikr label ── */}
      <div className={`tb-dhikr${completed ? ' done' : ''}`}>
        {completed ? '✨ ماشاءالله' : dhikr.ar}
      </div>
      <div className="tb-dhikr-sub">{completed ? '' : dhikr.fa}</div>

      {/* ── Bead + ring ── */}
      <div className="tb-stage">
        <svg className="tb-ring-svg" viewBox="0 0 260 260" width="260" height="260">
          <circle cx="130" cy="130" r={R} fill="none"
            stroke="rgba(212,160,23,0.11)" strokeWidth="5"/>
          {target > 0 && (
            <circle cx="130" cy="130" r={R} fill="none"
              stroke={completed ? '#ffd700' : 'rgba(212,160,23,0.72)'}
              strokeWidth="5" strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              transform="rotate(-90 130 130)"
              style={{ transition: 'stroke-dashoffset 0.28s ease, stroke 0.4s' }}
            />
          )}
        </svg>

        <button
          ref={beadRef}
          className={`tb-bead${completed ? ' tb-bead-done' : ''}`}
          onClick={(e) => { e.stopPropagation(); tap(); }}
          aria-label="شمارش تسبیح"
        >
          <span className="tb-n">{toArabic(count)}</span>
          {count === 0 && <span className="tb-hint">لمس کنید</span>}
        </button>
      </div>

      {/* ── Cycle counter ── */}
      <div className="tb-cycles" style={{ opacity: cycles > 0 ? 1 : 0 }}>
        {toArabic(cycles)} دور کامل
      </div>

      {/* ── Target selector ── */}
      <div className="tb-targets">
        {TARGETS.map(t => (
          <button
            key={t.val}
            className={`tb-t${target === t.val && activeDhikr === null ? ' on' : ''}`}
            onClick={() => selectTarget(t.val)}
          >
            {t.lbl}
          </button>
        ))}
      </div>

      {/* ── Reset ── */}
      <button className="tb-reset" onClick={confirmReset}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
        ریست
      </button>

      {/* ── Reset confirmation dialog ── */}
      {showConfirm && (
        <div className="tb-confirm-box">
          <div className="tb-confirm-card">
            <p className="tb-confirm-q">شمارش ریست بشه؟</p>
            <div className="tb-confirm-btns">
              <button className="tb-confirm-yes" onClick={doReset}>آره، ریست کن</button>
              <button className="tb-confirm-no"  onClick={cancelReset}>نه</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .tb {
          position: fixed; inset: 0; z-index: 200;
          display: flex; flex-direction: column; align-items: center;
          font-family: 'Vazirmatn', sans-serif; direction: rtl; color: #e8dfc8;
          overflow: hidden; user-select: none; -webkit-user-select: none;
          cursor: pointer;
        }
        .tb-bg {
          position: absolute; inset: 0;
          background-image: url('https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1080&q=85');
          background-size: cover; background-position: center;
        }
        .tb-dim {
          position: absolute; inset: 0;
          background: linear-gradient(180deg,
            rgba(2,5,16,0.75) 0%,
            rgba(4,8,20,0.55) 38%,
            rgba(5,3,0,0.90) 100%);
          transition: background .5s;
        }
        .tb.tb-night .tb-dim {
          background: linear-gradient(180deg,
            rgba(0,2,12,0.92) 0%,
            rgba(0,4,18,0.82) 38%,
            rgba(0,2,10,0.97) 100%);
        }

        /* ── close ── */
        .tb-x {
          position: absolute; top: 16px; left: 16px; z-index: 2;
          width: 40px; height: 40px; border-radius: 50%; border: none;
          background: rgba(255,255,255,0.09); backdrop-filter: blur(14px);
          color: rgba(212,160,23,0.72);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background .2s;
        }
        .tb-x:hover { background: rgba(255,255,255,0.15); }

        /* ── night mode toggle ── */
        .tb-night-btn {
          position: absolute; top: 16px; right: 16px; z-index: 2;
          width: 40px; height: 40px; border-radius: 50%; border: none;
          background: rgba(255,255,255,0.09); backdrop-filter: blur(14px);
          color: rgba(212,160,23,0.72);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background .2s, color .3s;
        }
        .tb-night-btn:hover { background: rgba(255,255,255,0.15); }
        .tb.tb-night .tb-night-btn { color: rgba(180,210,255,0.80); }

        /* ── heading ── */
        .tb-heading {
          position: relative; z-index: 1;
          margin-top: 62px;
          font-size: 13px; font-weight: 400; letter-spacing: .12em;
          color: rgba(212,160,23,0.42);
        }

        /* ── dhikr presets ── */
        .tb-presets {
          position: relative; z-index: 1;
          display: flex; gap: 8px;
          margin-top: 12px;
          overflow-x: auto; max-width: 100%; padding: 2px 16px 4px;
          scrollbar-width: none;
        }
        .tb-presets::-webkit-scrollbar { display: none; }
        .tb-preset {
          flex-shrink: 0;
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          padding: 7px 14px; border-radius: 14px;
          background: rgba(212,160,23,0.07);
          border: 1px solid rgba(212,160,23,0.18);
          color: rgba(212,160,23,0.55);
          cursor: pointer; transition: all .18s;
        }
        .tb-preset:hover { background: rgba(212,160,23,0.13); color: rgba(212,160,23,0.80); }
        .tb-preset.on {
          background: rgba(212,160,23,0.18);
          border-color: rgba(212,160,23,0.55);
          box-shadow: 0 0 12px rgba(212,160,23,0.22);
        }
        .tb-preset-ar {
          font-family: 'Scheherazade New', serif;
          font-size: 14px; color: inherit;
        }
        .tb-preset.on .tb-preset-ar { color: #e8d5a0; }
        .tb-preset-fa { font-size: 9px; color: rgba(212,160,23,0.38); letter-spacing: .04em; }
        .tb-preset.on .tb-preset-fa { color: rgba(212,160,23,0.55); }

        /* ── dhikr label ── */
        .tb-dhikr {
          position: relative; z-index: 1;
          margin-top: 10px;
          font-family: 'Scheherazade New', serif;
          font-size: 27px; line-height: 1.3;
          color: #e8d5a0; text-align: center;
          text-shadow: 0 0 22px rgba(212,160,23,0.22);
          min-height: 42px; display: flex; align-items: center;
          transition: color .4s, text-shadow .4s;
        }
        .tb-dhikr.done {
          color: #ffd700;
          text-shadow: 0 0 32px rgba(255,215,0,0.55);
          animation: dhPop .45s cubic-bezier(.22,.68,0,1.4) both;
        }
        @keyframes dhPop {
          0%   { transform: scale(1);    }
          55%  { transform: scale(1.11); }
          100% { transform: scale(1);    }
        }
        .tb-dhikr-sub {
          position: relative; z-index: 1;
          font-size: 11px; color: rgba(212,160,23,0.34);
          min-height: 16px; margin-top: 2px;
          letter-spacing: .06em;
        }

        /* ── stage (ring + bead) ── */
        .tb-stage {
          position: relative; z-index: 1;
          margin-top: 10px;
          width: 260px; height: 260px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .tb-ring-svg {
          position: absolute; inset: 0; pointer-events: none;
        }

        /* ── bead ── */
        .tb-bead {
          position: relative;
          width: 168px; height: 168px; border-radius: 50%; border: none;
          cursor: pointer;
          background: radial-gradient(circle at 32% 28%,
            #fffadc 0%, #f5ca3c 16%, #d4a017 42%, #9a7010 66%, #3e2200 100%);
          box-shadow:
            0 0 0 3px  rgba(212,160,23,0.22),
            0 0 28px   rgba(212,160,23,0.30),
            0 14px 44px rgba(0,0,0,0.62),
            inset 0 3px 10px  rgba(255,255,255,0.40),
            inset 0 -4px 12px rgba(0,0,0,0.26);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 4px;
          -webkit-tap-highlight-color: transparent;
          transition: box-shadow .15s;
        }
        .tb-bead:active {
          box-shadow:
            0 0 0 7px  rgba(212,160,23,0.48),
            0 0 55px   rgba(212,160,23,0.68),
            0 6px 22px rgba(0,0,0,0.44),
            inset 0 3px 10px  rgba(255,255,255,0.40),
            inset 0 -4px 12px rgba(0,0,0,0.26);
        }
        .tb.tb-night .tb-bead {
          background: radial-gradient(circle at 32% 28%,
            #e8f4ff 0%, #90bce0 18%, #5a8db8 44%, #2a5070 68%, #0a1e30 100%);
          box-shadow:
            0 0 0 3px  rgba(100,180,255,0.22),
            0 0 28px   rgba(100,180,255,0.22),
            0 14px 44px rgba(0,0,0,0.70),
            inset 0 3px 10px  rgba(255,255,255,0.35),
            inset 0 -4px 12px rgba(0,0,0,0.30);
        }

        /* tap animation */
        .tb-bead.tb-tap {
          animation: beadTap .42s cubic-bezier(.22,.68,0,1.5) both;
        }
        @keyframes beadTap {
          0%  { transform: scale(1);    box-shadow: 0 0 0 3px rgba(212,160,23,0.22), 0 0 28px rgba(212,160,23,0.30), 0 14px 44px rgba(0,0,0,0.62), inset 0 3px 10px rgba(255,255,255,0.40), inset 0 -4px 12px rgba(0,0,0,0.26); }
          34% { transform: scale(0.86); box-shadow: 0 0 0 9px rgba(212,160,23,0.52), 0 0 62px rgba(212,160,23,0.72), 0 6px 20px rgba(0,0,0,0.40), inset 0 3px 10px rgba(255,255,255,0.40), inset 0 -4px 12px rgba(0,0,0,0.26); }
          68% { transform: scale(1.06); }
          100%{ transform: scale(1);    }
        }

        /* completion state */
        .tb-bead.tb-bead-done {
          background: radial-gradient(circle at 32% 28%,
            #fffce0 0%, #ffe566 16%, #ffd700 42%, #c09010 66%, #4a2e00 100%);
          box-shadow:
            0 0 0 9px  rgba(255,215,0,0.38),
            0 0 65px   rgba(255,215,0,0.58),
            0 14px 44px rgba(0,0,0,0.55),
            inset 0 3px 10px  rgba(255,255,255,0.46),
            inset 0 -4px 12px rgba(0,0,0,0.22);
          animation: beadDone .52s cubic-bezier(.22,.68,0,1.3) both;
        }
        @keyframes beadDone {
          0%  { transform: scale(1);    }
          44% { transform: scale(1.14); }
          74% { transform: scale(0.97); }
          100%{ transform: scale(1);    }
        }

        /* number */
        .tb-n {
          font-family: 'Scheherazade New', serif;
          font-size: 60px; font-weight: 700; line-height: 1;
          color: rgba(255,255,255,0.96);
          text-shadow: 0 2px 8px rgba(0,0,0,0.32), 0 0 16px rgba(255,255,255,0.14);
          letter-spacing: -.02em;
        }
        .tb-hint {
          font-size: 10px; font-weight: 300; letter-spacing: .05em;
          color: rgba(255,255,255,0.36);
        }

        /* ── cycles ── */
        .tb-cycles {
          position: relative; z-index: 1;
          height: 22px; margin-top: 6px;
          font-size: 12px; color: rgba(212,160,23,0.44);
          transition: opacity .3s;
        }

        /* ── target pills ── */
        .tb-targets {
          position: relative; z-index: 1;
          display: flex; gap: 9px;
          margin-top: 14px;
        }
        .tb-t {
          padding: 8px 17px; border-radius: 22px;
          background: rgba(212,160,23,0.08);
          border: 1px solid rgba(212,160,23,0.20);
          color: rgba(212,160,23,0.52);
          font-family: 'Vazirmatn', sans-serif; font-size: 13px;
          cursor: pointer; transition: all .18s;
        }
        .tb-t:hover { background: rgba(212,160,23,0.14); color: rgba(212,160,23,0.80); }
        .tb-t.on {
          background: rgba(212,160,23,0.18);
          border-color: rgba(212,160,23,0.52);
          color: #d4a017;
          box-shadow: 0 0 10px rgba(212,160,23,0.20);
        }

        /* ── reset ── */
        .tb-reset {
          position: relative; z-index: 1;
          margin-top: 12px;
          display: flex; align-items: center; gap: 7px;
          padding: 9px 20px; border-radius: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(212,160,23,0.12);
          color: rgba(212,160,23,0.38);
          font-family: 'Vazirmatn', sans-serif; font-size: 13px;
          cursor: pointer; transition: all .2s;
        }
        .tb-reset:hover { background: rgba(255,255,255,0.08); color: rgba(212,160,23,0.65); }

        /* ── confirm dialog ── */
        .tb-confirm-box {
          position: absolute; inset: 0; z-index: 10;
          display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.60); backdrop-filter: blur(8px);
        }
        .tb-confirm-card {
          background: rgba(5,10,28,0.97);
          border: 1px solid rgba(212,160,23,0.30);
          border-radius: 22px; padding: 28px 32px;
          display: flex; flex-direction: column; align-items: center; gap: 20px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.75);
          animation: popUp .3s cubic-bezier(.22,.68,0,1.2) both;
        }
        @keyframes popUp {
          from { opacity:0; transform: scale(.88) translateY(14px); }
          to   { opacity:1; transform: none; }
        }
        .tb-confirm-q {
          font-size: 16px; font-weight: 500; color: #e8d5a0;
          text-align: center;
        }
        .tb-confirm-btns {
          display: flex; gap: 12px;
        }
        .tb-confirm-yes {
          padding: 10px 22px; border-radius: 14px;
          background: rgba(212,160,23,0.18);
          border: 1px solid rgba(212,160,23,0.45);
          color: #d4a017; font-family: 'Vazirmatn', sans-serif; font-size: 14px;
          cursor: pointer; transition: all .18s;
        }
        .tb-confirm-yes:hover { background: rgba(212,160,23,0.28); }
        .tb-confirm-no {
          padding: 10px 22px; border-radius: 14px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: rgba(232,223,200,0.55); font-family: 'Vazirmatn', sans-serif; font-size: 14px;
          cursor: pointer; transition: all .18s;
        }
        .tb-confirm-no:hover { background: rgba(255,255,255,0.10); color: rgba(232,223,200,0.80); }
      `}</style>
    </div>
  );
}
