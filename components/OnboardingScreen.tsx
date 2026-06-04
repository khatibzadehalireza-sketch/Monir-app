"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Props {
  onComplete: () => void;
}

type Step = 0 | 1 | 2;

export function OnboardingScreen({ onComplete }: Props) {
  const [step,     setStep]     = useState<Step>(0);
  const [name,     setName]     = useState("");
  const [location, setLocation] = useState("");
  const [visible,  setVisible]  = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (localStorage.getItem("monir-onboarding-done") === "true") {
      onComplete();
    }
  }, [onComplete]);

  useEffect(() => {
    if (step < 2) setTimeout(() => inputRef.current?.focus(), 380);
  }, [step]);

  const transition = useCallback((next: Step | "done", afterDone?: () => void) => {
    setVisible(false);
    setTimeout(() => {
      if (next === "done") {
        afterDone?.();
      } else {
        setStep(next);
        setVisible(true);
      }
    }, 320);
  }, []);

  const handleNameSubmit = () => {
    if (!name.trim()) return;
    transition(1);
  };

  const handleLocationSubmit = () => {
    if (!location.trim()) return;
    transition(2);
  };

  const handleNeedSelect = (need: string) => {
    localStorage.setItem("monir-user-name",     name.trim());
    localStorage.setItem("monir-user-location", location.trim());
    localStorage.setItem("monir-user-need",     need);
    localStorage.setItem("monir-onboarding-done", "true");
    transition("done", onComplete);
  };

  const monirMessage =
    step === 0 ? "سلام، من منیرم — همراه روحت.\nاسمت چیه؟" :
    step === 1 ? `خوشوقتم ${name.trim()}!\nکجا زندگی می‌کنی؟` :
                 `${name.trim()} عزیز، الان بیشتر\nبه چی نیاز داری؟`;

  const needs = [
    { label: "آرامش و ذکر",      icon: "☮️" },
    { label: "قرآن و نماز",      icon: "📿" },
    { label: "کسی که گوش بده",   icon: "💙" },
    { label: "رشد معنوی",        icon: "✨" },
  ];

  return (
    <div className="ob">
      <div className="ob-bg" />
      <div className="ob-stars" />
      <div className="ob-glow-bottom" />

      {/* Monir orb */}
      <div className="ob-orb-wrap">
        <div className="ob-orb-ring ob-orb-ring-3" />
        <div className="ob-orb-ring ob-orb-ring-2" />
        <div className="ob-orb-ring ob-orb-ring-1" />
        <div className="ob-orb">
          <div className="ob-orb-shine" />
        </div>
      </div>

      {/* Conversation area */}
      <div className={`ob-scene${visible ? "" : " ob-hidden"}`}>

        {/* Monir speech bubble */}
        <div className="ob-bubble">
          <p className="ob-msg">{monirMessage}</p>
        </div>

        {/* Step dots */}
        <div className="ob-dots">
          {([0, 1, 2] as Step[]).map(i => (
            <div key={i} className={`ob-dot${step === i ? " ob-dot-active" : step > i ? " ob-dot-done" : ""}`} />
          ))}
        </div>

        {/* Step 0 — name */}
        {step === 0 && (
          <div className="ob-form">
            <input
              ref={inputRef}
              className="ob-input"
              placeholder="اسمت رو بنویس..."
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleNameSubmit()}
              dir="rtl"
              autoComplete="off"
            />
            <button className="ob-next-btn" onClick={handleNameSubmit} disabled={!name.trim()}>
              بعدی →
            </button>
          </div>
        )}

        {/* Step 1 — location */}
        {step === 1 && (
          <div className="ob-form">
            <input
              ref={inputRef}
              className="ob-input"
              placeholder="شهر یا کشورت..."
              value={location}
              onChange={e => setLocation(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLocationSubmit()}
              dir="rtl"
              autoComplete="off"
            />
            <button className="ob-next-btn" onClick={handleLocationSubmit} disabled={!location.trim()}>
              بعدی →
            </button>
          </div>
        )}

        {/* Step 2 — need selection */}
        {step === 2 && (
          <div className="ob-needs">
            {needs.map(n => (
              <button key={n.label} className="ob-need-btn" onClick={() => handleNeedSelect(n.label)}>
                <span className="ob-need-icon">{n.icon}</span>
                <span className="ob-need-label">{n.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .ob {
          position: fixed; inset: 0; z-index: 400;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          font-family: 'Vazirmatn', sans-serif; direction: rtl;
          color: #e8dfc8; overflow: hidden;
          padding: 24px 0;
        }

        /* ── backgrounds ── */
        .ob-bg {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 50% 10%,
            rgba(22,10,65,1) 0%,
            rgba(5,4,22,1)  45%,
            rgba(1,2,10,1)  100%);
        }
        .ob-stars {
          position: absolute; inset: 0; pointer-events: none;
          background-image:
            radial-gradient(1px 1px at  8% 12%, rgba(255,255,255,0.65) 0%, transparent 100%),
            radial-gradient(1px 1px at 22% 58%, rgba(255,255,255,0.45) 0%, transparent 100%),
            radial-gradient(1px 1px at 38% 28%, rgba(255,255,255,0.55) 0%, transparent 100%),
            radial-gradient(1px 1px at 53% 78%, rgba(255,255,255,0.35) 0%, transparent 100%),
            radial-gradient(1px 1px at 68% 18%, rgba(255,255,255,0.60) 0%, transparent 100%),
            radial-gradient(1px 1px at 82% 52%, rgba(255,255,255,0.40) 0%, transparent 100%),
            radial-gradient(1px 1px at 91% 68%, rgba(255,255,255,0.50) 0%, transparent 100%),
            radial-gradient(1px 1px at 14% 88%, rgba(255,255,255,0.30) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 47% 42%, rgba(212,160,23,0.45) 0%, transparent 100%),
            radial-gradient(1.5px 1.5px at 33%  8%, rgba(212,160,23,0.35) 0%, transparent 100%),
            radial-gradient(1px 1px at 75% 35%, rgba(255,255,255,0.40) 0%, transparent 100%),
            radial-gradient(1px 1px at 60% 92%, rgba(255,255,255,0.25) 0%, transparent 100%);
        }
        .ob-glow-bottom {
          position: absolute; bottom: -80px; left: 50%;
          transform: translateX(-50%);
          width: 500px; height: 300px; border-radius: 50%;
          background: radial-gradient(ellipse, rgba(212,160,23,0.06) 0%, transparent 70%);
          pointer-events: none;
        }

        /* ── orb ── */
        .ob-orb-wrap {
          position: relative; z-index: 1;
          width: 110px; height: 110px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 28px; flex-shrink: 0;
        }
        .ob-orb-ring {
          position: absolute; border-radius: 50%;
          background: radial-gradient(circle, rgba(212,160,23,0.08) 0%, transparent 70%);
        }
        .ob-orb-ring-1 { inset: -6px;  animation: obPulse 3.8s ease-in-out infinite; }
        .ob-orb-ring-2 { inset: -18px; animation: obPulse 3.8s ease-in-out infinite .4s; }
        .ob-orb-ring-3 { inset: -34px; animation: obPulse 3.8s ease-in-out infinite .8s; }
        @keyframes obPulse {
          0%,100% { transform: scale(1);    opacity: 1;   }
          50%      { transform: scale(1.12); opacity: 0.7; }
        }
        .ob-orb {
          position: relative; z-index: 1;
          width: 80px; height: 80px; border-radius: 50%;
          background: radial-gradient(circle at 38% 34%,
            rgba(255,235,120,0.98) 0%,
            rgba(212,160,23,0.88) 38%,
            rgba(150,95,8,0.72)  100%);
          box-shadow:
            0 0 28px rgba(212,160,23,0.55),
            0 0 64px rgba(212,160,23,0.22),
            inset 0 1px 3px rgba(255,245,190,0.45);
          animation: obPulse 3.8s ease-in-out infinite;
        }
        .ob-orb-shine {
          position: absolute; inset: 0; border-radius: 50%;
          background: radial-gradient(circle at 38% 34%,
            rgba(255,255,255,0.28) 0%, transparent 52%);
        }

        /* ── conversation scene ── */
        .ob-scene {
          position: relative; z-index: 1;
          display: flex; flex-direction: column; align-items: center;
          width: 100%; max-width: 420px; padding: 0 24px;
          transition: opacity .32s ease, transform .32s ease;
        }
        .ob-hidden { opacity: 0; transform: translateY(14px); pointer-events: none; }

        /* ── monir bubble ── */
        .ob-bubble {
          width: 100%;
          background: rgba(212,160,23,0.07);
          border: 1px solid rgba(212,160,23,0.20);
          border-radius: 18px 18px 18px 4px;
          padding: 16px 20px;
          margin-bottom: 20px;
          animation: obIn .45s cubic-bezier(.22,.68,0,1.2) both;
        }
        .ob-msg {
          font-family: 'Scheherazade New', serif;
          font-size: 21px; line-height: 1.85;
          color: #f0e6c0; text-align: right; direction: rtl;
          white-space: pre-line; margin: 0;
        }

        /* ── step dots ── */
        .ob-dots {
          display: flex; gap: 7px; margin-bottom: 22px;
          animation: obIn .45s ease .08s both;
        }
        .ob-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: rgba(212,160,23,0.18);
          transition: width .3s, background .3s, border-radius .3s;
        }
        .ob-dot-active {
          width: 22px; border-radius: 4px;
          background: #d4a017;
          box-shadow: 0 0 8px rgba(212,160,23,0.55);
        }
        .ob-dot-done { background: rgba(212,160,23,0.48); }

        /* ── text input form ── */
        .ob-form {
          width: 100%;
          display: flex; flex-direction: column; gap: 11px;
          animation: obIn .45s ease .15s both;
        }
        .ob-input {
          width: 100%; padding: 14px 18px;
          background: rgba(255,255,255,0.055);
          border: 1px solid rgba(212,160,23,0.24);
          border-radius: 14px;
          color: #f0e6c0;
          font-family: 'Vazirmatn', sans-serif; font-size: 16px;
          text-align: right; direction: rtl;
          outline: none;
          transition: border-color .2s, background .2s;
          box-sizing: border-box;
        }
        .ob-input::placeholder { color: rgba(212,160,23,0.28); }
        .ob-input:focus {
          border-color: rgba(212,160,23,0.52);
          background: rgba(255,255,255,0.085);
        }
        .ob-next-btn {
          align-self: flex-end;
          padding: 12px 26px; border-radius: 14px;
          background: rgba(212,160,23,0.15);
          border: 1px solid rgba(212,160,23,0.38);
          color: #d4a017;
          font-family: 'Vazirmatn', sans-serif; font-size: 15px;
          cursor: pointer; transition: all .2s;
        }
        .ob-next-btn:hover:not(:disabled) {
          background: rgba(212,160,23,0.26);
          box-shadow: 0 0 16px rgba(212,160,23,0.20);
        }
        .ob-next-btn:disabled { opacity: 0.32; cursor: default; }

        /* ── need buttons ── */
        .ob-needs {
          width: 100%;
          display: grid; grid-template-columns: 1fr 1fr; gap: 11px;
          animation: obIn .45s ease .15s both;
        }
        .ob-need-btn {
          display: flex; flex-direction: column; align-items: center; gap: 9px;
          padding: 18px 10px; border-radius: 18px;
          background: rgba(212,160,23,0.07);
          border: 1px solid rgba(212,160,23,0.18);
          color: #e8dfc8;
          font-family: 'Vazirmatn', sans-serif; font-size: 13px;
          cursor: pointer;
          transition: background .2s, border-color .2s, transform .2s, box-shadow .2s;
        }
        .ob-need-btn:hover {
          background: rgba(212,160,23,0.16);
          border-color: rgba(212,160,23,0.44);
          transform: translateY(-3px);
          box-shadow: 0 6px 22px rgba(212,160,23,0.16);
        }
        .ob-need-icon  { font-size: 28px; }
        .ob-need-label { color: rgba(232,223,200,0.88); line-height: 1.4; text-align: center; }

        /* ── shared animation ── */
        @keyframes obIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
