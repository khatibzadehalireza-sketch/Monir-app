"use client";

import { useState, useEffect } from "react";

interface Props {
  onClose: () => void;
}

const PRAYERS = [
  { key: 'fajr',    fa: 'فجر'  },
  { key: 'dhuhr',   fa: 'ظهر'  },
  { key: 'asr',     fa: 'عصر'  },
  { key: 'maghrib', fa: 'مغرب' },
  { key: 'isha',    fa: 'عشاء' },
];

function toFa(n: number): string {
  return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
}

function todayKey(): string {
  const d   = new Date();
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `monir-prayer-${y}-${m}-${day}`;
}

export default function PrayerTrackerWidget({ onClose }: Props) {
  const [checked, setChecked] = useState<boolean[]>(() => {
    if (typeof window === 'undefined') return Array(5).fill(false);
    try {
      const saved = localStorage.getItem(todayKey());
      if (saved) return JSON.parse(saved) as boolean[];
    } catch {}
    return Array(5).fill(false);
  });

  useEffect(() => {
    localStorage.setItem(todayKey(), JSON.stringify(checked));
  }, [checked]);

  const toggle = (i: number) => {
    setChecked(prev => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  };

  const doneCount = checked.filter(Boolean).length;
  const allDone   = doneCount === 5;

  return (
    <div className="pt-wrap">
      <div className="pt-bg"/>
      <div className="pt-dim"/>

      <button className="pt-x" onClick={onClose} aria-label="بستن">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6"  y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      <div className="pt-inner">
        <h1 className="pt-title">نماز امروز</h1>

        <div className={`pt-progress${allDone ? ' pt-done' : ''}`}>
          {allDone ? '✨ ماشاءالله، همه نمازها خوندی!' : `${toFa(doneCount)} از ۵ نماز`}
        </div>

        <div className="pt-bar-wrap">
          <div className="pt-bar-fill" style={{ width: `${(doneCount / 5) * 100}%` }}/>
        </div>

        <div className="pt-list">
          {PRAYERS.map((p, i) => (
            <button
              key={p.key}
              className={`pt-row${checked[i] ? ' pt-checked' : ''}`}
              onClick={() => toggle(i)}
              aria-label={`${p.fa} — ${checked[i] ? 'خوانده شد' : 'نخوانده'}`}
            >
              <span className="pt-name">{p.fa}</span>
              <span className="pt-check">
                {checked[i] ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" fill="rgba(212,160,23,0.18)" stroke="rgba(212,160,23,0.70)"/>
                    <polyline points="7 12 10.5 15.5 17 9"/>
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" stroke="rgba(212,160,23,0.25)" strokeWidth="2"/>
                  </svg>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      <style>{`
        .pt-wrap {
          position: fixed; inset: 0; z-index: 200;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          font-family: 'Vazirmatn', sans-serif; direction: rtl; color: #e8dfc8;
          overflow: hidden; user-select: none; -webkit-user-select: none;
        }
        .pt-bg {
          position: absolute; inset: 0;
          background-image: url('https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1080&q=85');
          background-size: cover; background-position: center;
        }
        .pt-dim {
          position: absolute; inset: 0;
          background: linear-gradient(180deg,
            rgba(2,5,16,0.75) 0%,
            rgba(4,8,20,0.60) 40%,
            rgba(5,3,0,0.92) 100%);
        }

        .pt-x {
          position: absolute; top: 16px; left: 16px; z-index: 2;
          width: 40px; height: 40px; border-radius: 50%; border: none;
          background: rgba(255,255,255,0.09); backdrop-filter: blur(14px);
          color: rgba(212,160,23,0.72);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background .2s;
        }
        .pt-x:hover { background: rgba(255,255,255,0.15); }

        .pt-inner {
          position: relative; z-index: 1;
          width: 100%; max-width: 380px;
          padding: 0 20px;
          display: flex; flex-direction: column; align-items: center; gap: 16px;
        }

        .pt-title {
          font-size: 20px; font-weight: 700; color: #d4a017;
          text-shadow: 0 0 22px rgba(212,160,23,0.40);
          letter-spacing: .04em;
        }

        .pt-progress {
          font-size: 14px; color: rgba(212,160,23,0.60);
          transition: color .3s;
        }
        .pt-progress.pt-done {
          color: #ffd700;
          text-shadow: 0 0 16px rgba(255,215,0,0.50);
          font-weight: 600;
        }

        .pt-bar-wrap {
          width: 100%; height: 4px; border-radius: 2px;
          background: rgba(212,160,23,0.12);
          overflow: hidden;
        }
        .pt-bar-fill {
          height: 100%; border-radius: 2px;
          background: linear-gradient(90deg, rgba(212,160,23,0.55), #d4a017);
          transition: width .35s ease;
        }

        .pt-list {
          width: 100%;
          display: flex; flex-direction: column; gap: 10px;
        }

        .pt-row {
          width: 100%;
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px;
          background: rgba(8,12,28,0.80);
          border: 1px solid rgba(212,160,23,0.16);
          border-radius: 16px;
          cursor: pointer;
          transition: background .18s, border-color .18s, box-shadow .18s;
          backdrop-filter: blur(18px);
          -webkit-tap-highlight-color: transparent;
        }
        .pt-row:hover   { background: rgba(8,12,28,0.92); border-color: rgba(212,160,23,0.28); }
        .pt-row:active  { transform: scale(0.98); }
        .pt-row.pt-checked {
          background: rgba(212,160,23,0.08);
          border-color: rgba(212,160,23,0.40);
          box-shadow: 0 0 16px rgba(212,160,23,0.10);
        }

        .pt-name {
          font-size: 18px; font-weight: 600; color: #e8d5a0;
          transition: color .18s;
        }
        .pt-row.pt-checked .pt-name {
          color: #d4a017;
          text-shadow: 0 0 12px rgba(212,160,23,0.30);
        }

        .pt-check {
          display: flex; align-items: center; justify-content: center;
          color: rgba(212,160,23,0.70);
          transition: transform .2s;
        }
        .pt-row.pt-checked .pt-check { transform: scale(1.12); }
      `}</style>
    </div>
  );
}
