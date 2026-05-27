"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Message { role: "user" | "assistant"; content: string; id: string; }

const OPENING = "اینجام و دوست دارم بشنوم 🌙";

export default function App() {
  const [screen, setScreen] = useState<"home" | "chat">("home");
  const [silLeaving, setSilLeaving] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [consentExpanded, setConsentExpanded] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingName, setOnboardingName] = useState("");
  const [onboardingAge, setOnboardingAge] = useState("");
  const [userName, setUserName] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const router = useRouter();

  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const sessionStart = useRef(new Date().toISOString());
  const msgCount = useRef(0);
  const feedbackShownRef = useRef(false);

  useEffect(() => {
    if (!localStorage.getItem("monir_consent_given")) {
      setShowConsent(true);
    } else if (!localStorage.getItem("monir_onboarding_done")) {
      setShowOnboarding(true);
    } else {
      setUserName(localStorage.getItem("monir_user_name") || "");
    }
  }, []);

  useEffect(() => {
    if (screen === "chat" && messages.length === 0)
      setTimeout(() => setMessages([{ role: "assistant", content: OPENING, id: "0" }]), 600);
  }, [screen]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);

  const handleConsent = useCallback(() => {
    const date = new Date().toISOString();
    localStorage.setItem("monir_consent_given", "true");
    localStorage.setItem("monir_consent_date", date);
    setShowConsent(false);
    if (!localStorage.getItem("monir_onboarding_done")) {
      setShowOnboarding(true);
    } else {
      setUserName(localStorage.getItem("monir_user_name") || "");
    }
  }, []);

  const completeOnboarding = useCallback(() => {
    const name = onboardingName.trim();
    const age  = onboardingAge.trim();
    if (name) localStorage.setItem("monir_user_name", name);
    if (age)  localStorage.setItem("monir_user_age",  age);
    localStorage.setItem("monir_onboarding_done", "true");
    setUserName(name);
    setShowOnboarding(false);
  }, [onboardingName, onboardingAge]);

  const goToChat = useCallback(() => {
    setSilLeaving(true);
    setTimeout(() => setScreen("chat"), 820);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
  }, []);

  const submitFeedback = useCallback(async (score: number) => {
    setShowFeedback(false);
    setFeedbackSubmitted(true);
    const uid = localStorage.getItem("munir_uid") || "";
    const sid = `${uid}_${sessionStart.current.replace(/\D/g, '').slice(2, 16)}`;
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sid, user_id: uid, helpfulness_score: score }),
      });
    } catch { /* silent */ }
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    const userMsg: Message = { role: "user", content: text, id: Date.now().toString() };
    setMessages(p => [...p, userMsg]);
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    setIsLoading(true);
    msgCount.current++;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          userId: (() => {
            let id = localStorage.getItem("munir_uid");
            if (!id) { id = "u_" + Math.random().toString(36).slice(2); localStorage.setItem("munir_uid", id); }
            return id;
          })(),
          sessionStartTime: sessionStart.current,
          sessionMessageCount: msgCount.current,
          userName: userName || undefined,
          consentGiven: localStorage.getItem("monir_consent_given") === "true" ? true : undefined,
          consentDate: localStorage.getItem("monir_consent_date") || undefined,
        }),
      });
      const data = await res.json();
      setMessages(p => [...p, { role: "assistant", content: data.reply, id: Date.now().toString() }]);
      if (msgCount.current >= 5 && !feedbackShownRef.current) {
        feedbackShownRef.current = true;
        setShowFeedback(true);
      }
    } catch {
      setMessages(p => [...p, { role: "assistant", content: "فرزندم... ارتباط قطع شد.", id: Date.now().toString() }]);
    } finally { setIsLoading(false); }
  }, [input, isLoading, messages]);

  const onKey = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }, [send]);

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700&display=swap" rel="stylesheet" />
      <div className="bg" />

      <div className="app">

        {/* ── HOME SCREEN ── */}
        {screen === "home" && (
          <div className="screen home">

            {/* Top nav */}
            <div className="tnav">
              <button className="ibtn">
                <svg width="20" height="15" viewBox="0 0 20 15" fill="none">
                  <rect width="20" height="2" rx="1" fill="currentColor"/>
                  <rect y="6.5" width="14" height="2" rx="1" fill="currentColor"/>
                  <rect y="13" width="20" height="2" rx="1" fill="currentColor"/>
                </svg>
              </button>
              <button className="ibtn nbtn">
                <svg width="20" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                <span className="ndot" />
              </button>
            </div>

            {/* Hero */}
            <div className="hero">
              <div className="htxt">
                <p className="wsub">خوش اومدی،</p>
                <h1 className="wname">منیر</h1>
                <p className="wq">امروز چه حالی داری؟</p>
              </div>
            </div>

            {/* Cards */}
            <div className="cards">
              <button className="cmain" onClick={goToChat}>
                <div className="orb" />
                <div className="ctxt">
                  <span className="ctitle">بزن بریم</span>
                  <span className="csub">اینجام که گوش بدم و کمکت کنم</span>
                </div>
                <span className="carr">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/>
                  </svg>
                </span>
              </button>
              <div className="crow">
                <button className="csm" onClick={() => router.push("/prayer")}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(212,160,23,0.72)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  <span className="ctitle-s">چک‌این روزانه</span>
                  <span className="csub-s">احساساتت رو بهتر بشناس</span>
                </button>
                <button className="csm" onClick={() => router.push("/feed")}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(212,160,23,0.72)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  <span className="ctitle-s">فضای اجتماعی</span>
                  <span className="csub-s">پست‌ها و دعاهای جامعه</span>
                </button>
              </div>
            </div>

            {/* Bottom nav */}
            <nav className="bnav">
              <button className="ni ni-on">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                <span>خانه</span>
              </button>
              <button className="ni" onClick={goToChat}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span>چت</span>
              </button>
              <button className="ni" onClick={() => router.push("/feed")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span>فضا</span>
              </button>
              <button className="ni" onClick={() => router.push("/memory")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                <span>خاطرات</span>
              </button>
              <button className="ni" onClick={() => router.push("/profile")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span>پروفایل</span>
              </button>
            </nav>
          </div>
        )}

        {/* ── CHAT SCREEN ── */}
        {screen === "chat" && (
          <div className="screen chat">
            <header className="chdr">
              <button className="ibtn" onClick={() => setScreen("home")}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15,18 9,12 15,6"/></svg>
              </button>
              <div className="chdr-mid">
                <div className="logo"><span>✦</span></div>
                <div>
                  <div className="hname">منیر</div>
                  <div className="htag">همراه معنوی</div>
                </div>
              </div>
              <div className="hverse">أَفَلَا تَتَفَکَّرُونَ</div>
            </header>

            <div className="msgs">
              {messages.map(m => (
                <div key={m.id} className={`row row-${m.role}`}>
                  {m.role === "assistant" && <div className="av"><span>✦</span></div>}
                  <div className={`bubble bubble-${m.role}`}>{m.content}</div>
                </div>
              ))}
              {isLoading && (
                <div className="row row-assistant">
                  <div className="av"><span>✦</span></div>
                  <div className="bubble bubble-assistant bubble-dots">
                    <span className="d" style={{animationDelay:"0s"}}/>
                    <span className="d" style={{animationDelay:".2s"}}/>
                    <span className="d" style={{animationDelay:".4s"}}/>
                  </div>
                </div>
              )}
              {showFeedback && !feedbackSubmitted && (
                <div className="fb-row">
                  <div className="fb-card">
                    <p className="fb-q">این مکالمه چقدر کمک کرد؟</p>
                    <div className="fb-emojis">
                      {(["😞","😕","😐","🙂","😊"] as const).map((em, i) => (
                        <button key={i} className="fb-em" onClick={() => submitFeedback(i + 1)}>{em}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {feedbackSubmitted && (
                <div className="fb-done">ممنون از نظرت 🌙</div>
              )}
              <div ref={endRef} />
            </div>

            <div className="bar">
              <div className={`ibox${focused ? " ibox-on" : ""}`}>
                <textarea
                  ref={taRef} value={input} onChange={handleChange} onKeyDown={onKey}
                  onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                  placeholder="هر چه در دل داری بگو..." rows={1} className="ta"
                />
                <button onClick={send} disabled={!input.trim() || isLoading}
                  className={`sbtn${input.trim() && !isLoading ? " sbtn-on" : ""}`}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
            </div>

            <nav className="bnav">
              <button className="ni" onClick={() => setScreen("home")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
                <span>خانه</span>
              </button>
              <button className="ni ni-on">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span>چت</span>
              </button>
              <button className="ni" onClick={() => router.push("/feed")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span>فضا</span>
              </button>
              <button className="ni" onClick={() => router.push("/memory")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                <span>خاطرات</span>
              </button>
              <button className="ni" onClick={() => router.push("/profile")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span>پروفایل</span>
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* ── CONSENT OVERLAY ── */}
      {showConsent && (
        <div className="cn-overlay">
          <div className="cn-card">
            <div className="cn-logo"><span>✦</span></div>
            <h2 className="cn-title">منیر</h2>
            <p className="cn-text">
              منیر برای بهتر شدن تجربه‌ات، بعضی اطلاعات رو ذخیره می‌کنه
            </p>
            {consentExpanded && (
              <div className="cn-details">
                <p>اطلاعاتی که ذخیره می‌شه:</p>
                <ul>
                  <li>احساسات و موضوعات مکالمه</li>
                  <li>موقعیت تقریبی (کشور / شهر)</li>
                  <li>الگوهای رشد معنوی</li>
                </ul>
                <p className="cn-note">هیچ اطلاعات شخصی‌ای به کسی داده نمی‌شه</p>
              </div>
            )}
            <div className="cn-btns">
              <button className="cn-btn-accept" onClick={handleConsent}>قبول می‌کنم</button>
              <button className="cn-btn-more" onClick={() => setConsentExpanded(p => !p)}>
                {consentExpanded ? "بستن" : "بیشتر بدون"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ONBOARDING OVERLAY ── */}
      {showOnboarding && (
        <div className="ob-overlay">
          <div className="ob-card">
            <div className="ob-logo"><span>✦</span></div>
            <h1 className="ob-title">منیر</h1>
            <p className="ob-sub">همراه معنوی تو<br/><span className="ob-sub-en">Your Spiritual Companion</span></p>

            <div className="ob-fields">
              <div className="ob-field">
                <label className="ob-label">اسم <span className="ob-label-en">/ Name</span> <span className="ob-opt">(اختیاری / optional)</span></label>
                <input
                  className="ob-input"
                  type="text"
                  placeholder="اسمت چیه؟ / What's your name?"
                  value={onboardingName}
                  onChange={e => setOnboardingName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && completeOnboarding()}
                  autoComplete="off"
                />
              </div>
              <div className="ob-field">
                <label className="ob-label">سن <span className="ob-label-en">/ Age</span> <span className="ob-opt">(اختیاری / optional)</span></label>
                <input
                  className="ob-input"
                  type="number"
                  placeholder="سنت چنده؟ / How old are you?"
                  value={onboardingAge}
                  onChange={e => setOnboardingAge(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && completeOnboarding()}
                  min="10" max="100"
                />
              </div>
            </div>

            <button className="ob-btn" onClick={completeOnboarding}>
              شروع کن &nbsp;/&nbsp; Start
            </button>
          </div>
        </div>
      )}

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #020d1f; overflow: hidden; }

        .bg {
          position: fixed; inset: 0; z-index: 0;
          background-image: url('https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1080&q=85');
          background-size: cover; background-position: center;
        }
        .bg::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(180deg,
            rgba(2,8,22,0.30) 0%,
            rgba(4,10,24,0.18) 25%,
            rgba(10,6,2,0.30) 60%,
            rgba(6,3,0,0.88) 100%);
        }

        .app {
          position: relative; z-index: 1;
          height: 100dvh;
          font-family: 'Vazirmatn', sans-serif;
          direction: rtl; color: #e8dfc8;
          overflow: hidden;
        }

        .screen {
          position: absolute; inset: 0;
          display: flex; flex-direction: column;
        }

        /* ── TOP NAV ── */
        .tnav {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px; flex-shrink: 0; position: relative; z-index: 5;
        }
        .ibtn {
          width: 40px; height: 40px; border-radius: 50%; border: none;
          background: rgba(255,255,255,0.09);
          backdrop-filter: blur(14px);
          color: rgba(212,160,23,0.80);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background .2s;
        }
        .ibtn:hover { background: rgba(255,255,255,0.14); }
        .nbtn { position: relative; }
        .ndot {
          position: absolute; top: 9px; right: 9px;
          width: 7px; height: 7px; border-radius: 50%;
          background: #d4a017;
          box-shadow: 0 0 6px rgba(212,160,23,0.85);
        }

        /* ── HERO ── */
        .hero {
          flex: 1; min-height: 0;
          display: flex; flex-direction: column;
          padding: 8px 24px 0;
          position: relative;
          justify-content: flex-end;
        }
        .htxt { position: relative; z-index: 2; }
        .wsub {
          font-size: 15px; font-weight: 300;
          color: rgba(212,160,23,0.72);
        }
        .wname {
          font-size: 52px; font-weight: 700; line-height: 1.08;
          color: #d4a017;
          text-shadow: 0 0 40px rgba(212,160,23,0.55), 0 0 80px rgba(212,160,23,0.28);
        }
        .wq {
          font-size: 15px; font-weight: 300; margin-top: 7px; line-height: 1.5;
          color: rgba(232,223,200,0.60);
        }

        /* Silhouette */
        .sil-wrap {
          flex: 1; display: flex; justify-content: center; align-items: flex-end;
        }
        .sil {
          width: 195px;
          transform-origin: bottom center;
          pointer-events: none; user-select: none;
        }
        .sil svg { display: block; width: 100%; height: auto; }
        .sil-go {
          animation: silFly 0.78s cubic-bezier(0.55, 0.05, 1, 0.5) forwards;
        }
        @keyframes silFly {
          0%   { transform: translate(0, 0) scale(1);    opacity: 1; }
          100% { transform: translate(46vw, 32vh) scale(0.06); opacity: 0; }
        }

        /* ── CARDS ── */
        .cards {
          flex-shrink: 0;
          padding: 14px 14px 8px;
          display: flex; flex-direction: column; gap: 10px;
          background: linear-gradient(180deg, transparent 0%, rgba(5,3,1,0.55) 25%, rgba(7,4,1,0.85) 100%);
        }

        /* Main CTA card */
        .cmain {
          display: flex; align-items: center; gap: 14px;
          padding: 15px 16px;
          background: rgba(16,10,3,0.80);
          border: 1px solid rgba(212,160,23,0.28);
          border-radius: 18px;
          backdrop-filter: blur(22px);
          cursor: pointer; text-align: right; width: 100%;
          box-shadow: 0 4px 32px rgba(0,0,0,0.50), inset 0 1px 0 rgba(212,160,23,0.07);
          transition: transform .15s, box-shadow .15s;
        }
        .cmain:active { transform: scale(0.98); }

        /* Glowing orb */
        .orb {
          width: 56px; height: 56px; flex-shrink: 0; border-radius: 50%;
          background: radial-gradient(circle at 38% 35%, #fffae8, #e8a012 32%, #8a4c00 72%, #2e1200 100%);
          box-shadow:
            0 0 18px rgba(212,160,23,0.75),
            0 0 38px rgba(212,160,23,0.42),
            0 0 65px rgba(200,110,5,0.28);
          animation: orbPulse 2.8s ease-in-out infinite;
        }
        @keyframes orbPulse {
          0%,100% { box-shadow: 0 0 18px rgba(212,160,23,0.75), 0 0 38px rgba(212,160,23,0.42), 0 0 65px rgba(200,110,5,0.28); }
          50%      { box-shadow: 0 0 28px rgba(212,160,23,0.95), 0 0 58px rgba(212,160,23,0.62), 0 0 95px rgba(200,110,5,0.45); }
        }

        .ctxt { flex: 1; }
        .ctitle { display: block; font-size: 18px; font-weight: 600; color: #e8d5a0; }
        .csub   { display: block; font-size: 12.5px; font-weight: 300; color: rgba(212,160,23,0.52); margin-top: 4px; }
        .carr {
          width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
          background: rgba(212,160,23,0.14);
          display: flex; align-items: center; justify-content: center;
          color: #d4a017;
        }

        /* Small cards row */
        .crow { display: flex; gap: 10px; }
        .csm {
          flex: 1; padding: 15px 13px; border: none;
          background: rgba(16,10,3,0.80);
          border: 1px solid rgba(212,160,23,0.18);
          border-radius: 16px;
          backdrop-filter: blur(18px);
          text-align: right; cursor: pointer;
          display: flex; flex-direction: column; gap: 6px;
          box-shadow: 0 4px 22px rgba(0,0,0,0.42);
          transition: transform .15s;
        }
        .csm:active { transform: scale(0.97); }
        .ctitle-s { font-size: 13.5px; font-weight: 500; color: #e0cfa0; }
        .csub-s   { font-size: 11px; font-weight: 300; color: rgba(212,160,23,0.42); line-height: 1.45; }

        /* ── BOTTOM NAV ── */
        .bnav {
          display: flex; align-items: center; justify-content: space-around;
          padding: 10px 4px 16px; flex-shrink: 0;
          background: rgba(4,2,0,0.90);
          backdrop-filter: blur(26px) saturate(140%);
          border-top: 1px solid rgba(212,160,23,0.11);
        }
        .ni {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          border: none; background: none; cursor: pointer;
          color: rgba(212,160,23,0.35);
          font-family: 'Vazirmatn', sans-serif;
          font-size: 10px; font-weight: 300;
          padding: 4px 12px; transition: color .2s;
        }
        .ni:hover { color: rgba(212,160,23,0.60); }
        .ni-on { color: #d4a017; }
        .ni-on svg { filter: drop-shadow(0 0 5px rgba(212,160,23,0.55)); }

        /* ── CHAT SCREEN ── */
        .chdr {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; flex-shrink: 0;
          background: rgba(2,8,26,0.82);
          backdrop-filter: blur(22px) saturate(170%);
          border-bottom: 1px solid rgba(212,160,23,0.14);
          box-shadow: 0 8px 40px rgba(0,0,0,0.45);
        }
        .chdr-mid { display: flex; align-items: center; gap: 11px; }
        .logo {
          width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
          background: radial-gradient(circle at 36% 36%, #fff5d0, #d4a017 42%, #7a5200 88%);
          display: flex; align-items: center; justify-content: center; font-size: 18px;
          animation: lp 3.2s ease-in-out infinite;
        }
        @keyframes lp {
          0%,100% { box-shadow: 0 0 14px rgba(212,160,23,0.55), 0 0 28px rgba(212,160,23,0.28); }
          50%      { box-shadow: 0 0 26px rgba(212,160,23,0.85), 0 0 52px rgba(212,160,23,0.45); }
        }
        .hname  { color: #d4a017; font-weight: 700; font-size: 17px; }
        .htag   { color: rgba(212,160,23,0.46); font-size: 11px; font-weight: 300; margin-top: 1px; }
        .hverse { color: rgba(150,185,255,0.34); font-size: 11px; font-weight: 300; letter-spacing: .05em; }

        .msgs {
          flex: 1; overflow-y: auto; min-height: 0;
          padding: 16px 13px; display: flex; flex-direction: column; gap: 12px;
        }
        .msgs::-webkit-scrollbar { width: 3px; }
        .msgs::-webkit-scrollbar-thumb { background: rgba(212,160,23,0.20); border-radius: 2px; }

        .row { display: flex; align-items: flex-end; gap: 8px; }
        .row-user      { flex-direction: row-reverse; }
        .row-assistant { flex-direction: row; }

        .av {
          width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
          background: radial-gradient(circle at 36% 36%, #fff5d0, #d4a017 42%, #7a5200 88%);
          display: flex; align-items: center; justify-content: center; font-size: 12px;
          box-shadow: 0 0 10px rgba(212,160,23,0.40);
          animation: lp 3.2s ease-in-out infinite;
        }
        .bubble {
          max-width: min(74%, 420px); padding: 11px 15px;
          font-size: 14px; line-height: 1.82; text-align: right;
          backdrop-filter: blur(16px);
          animation: pop .28s cubic-bezier(.22,.68,0,1.2) both;
        }
        @keyframes pop {
          from { opacity: 0; transform: translateY(8px) scale(.97); }
          to   { opacity: 1; transform: none; }
        }
        .bubble-user {
          border-radius: 20px 4px 20px 20px; border: 1px solid transparent;
          background: linear-gradient(rgba(10,26,58,.80),rgba(10,26,58,.80)) padding-box,
                      linear-gradient(135deg,rgba(110,165,255,.50),rgba(50,90,210,.18)) border-box;
          color: #cdddf8; box-shadow: 0 4px 24px rgba(0,8,60,.35);
        }
        .bubble-assistant {
          border-radius: 4px 20px 20px 20px; border: 1px solid transparent;
          background: linear-gradient(rgba(7,14,36,.84),rgba(7,14,36,.84)) padding-box,
                      linear-gradient(135deg,rgba(212,160,23,.36),rgba(170,120,8,.13)) border-box;
          color: #eddcaa; box-shadow: 0 4px 24px rgba(0,0,0,.40);
        }
        .bubble-dots { display: flex; gap: 6px; align-items: center; padding: 13px 17px; }
        .d {
          width: 7px; height: 7px; border-radius: 50%; background: #d4a017;
          box-shadow: 0 0 7px rgba(212,160,23,.55);
          animation: db 1.4s ease-in-out infinite;
        }
        @keyframes db {
          0%,60%,100% { transform: translateY(0); opacity: .4; }
          30%          { transform: translateY(-8px); opacity: 1; }
        }

        .bar {
          padding: 10px 13px 10px; flex-shrink: 0;
          background: rgba(2,5,18,.92); backdrop-filter: blur(22px);
          border-top: 1px solid rgba(212,160,23,.10);
        }
        .ibox {
          display: flex; align-items: flex-end; gap: 10px;
          background: rgba(255,255,255,.033);
          border: 1px solid rgba(212,160,23,.20);
          border-radius: 18px; padding: 9px 12px;
          transition: border-color .25s, box-shadow .25s;
        }
        .ibox-on {
          border-color: rgba(212,160,23,.55);
          box-shadow: 0 0 0 2px rgba(212,160,23,.08), 0 0 28px rgba(212,160,23,.13);
        }
        .ta {
          flex: 1; background: transparent; border: none; outline: none;
          color: #e8dab5; font-size: 14px; line-height: 1.65;
          font-family: 'Vazirmatn', sans-serif;
          text-align: right; direction: rtl; resize: none; max-height: 200px; overflow-y: auto;
        }
        .ta::placeholder { color: rgba(212,160,23,.28); }
        .sbtn {
          width: 36px; height: 36px; border-radius: 12px; border: none; flex-shrink: 0;
          background: rgba(255,255,255,.05); color: rgba(255,255,255,.22);
          display: flex; align-items: center; justify-content: center;
          cursor: not-allowed; transition: all .22s;
        }
        .sbtn-on { background: #d4a017; color: #06080f; cursor: pointer; box-shadow: 0 0 16px rgba(212,160,23,.55); }
        .sbtn-on:hover { background: #e8b520; }
        .sbtn-on:active { transform: scale(.92); transition: transform .09s; }

        @media (max-width: 480px) {
          .wname { font-size: 44px; }
          .sil { width: 160px; }
          .tnav { padding: 12px 16px; }
          .htxt { padding-top: 4px; }
        }

        /* ── CONSENT ── */
        .cn-overlay {
          position: fixed; inset: 0; z-index: 110;
          display: flex; align-items: center; justify-content: center;
          background: rgba(2,6,18,0.88);
          backdrop-filter: blur(14px);
          animation: obFade .35s ease both;
        }
        .cn-card {
          width: min(340px, 90vw);
          background: rgba(5,9,24,0.97);
          border: 1px solid rgba(212,160,23,0.28);
          border-radius: 24px;
          padding: 36px 26px 30px;
          display: flex; flex-direction: column; align-items: center; gap: 16px;
          box-shadow: 0 12px 70px rgba(0,0,0,0.82), 0 0 80px rgba(212,160,23,0.05);
          animation: obSlide .45s cubic-bezier(.22,.68,0,1.2) both;
        }
        .cn-logo {
          width: 52px; height: 52px; border-radius: 50%;
          background: radial-gradient(circle at 36% 36%, #fff5d0, #d4a017 42%, #7a5200 88%);
          display: flex; align-items: center; justify-content: center; font-size: 20px;
          box-shadow: 0 0 20px rgba(212,160,23,0.62), 0 0 44px rgba(212,160,23,0.26);
          animation: lp 3.2s ease-in-out infinite;
        }
        .cn-title {
          font-size: 30px; font-weight: 700; color: #d4a017;
          text-shadow: 0 0 28px rgba(212,160,23,0.50); margin: 0;
        }
        .cn-text {
          font-size: 14px; color: rgba(232,223,200,0.82);
          text-align: center; line-height: 1.80; direction: rtl;
        }
        .cn-details {
          width: 100%;
          background: rgba(212,160,23,0.05);
          border: 1px solid rgba(212,160,23,0.15);
          border-radius: 12px; padding: 14px 16px;
          animation: obFade .25s ease both;
        }
        .cn-details p { font-size: 12.5px; color: rgba(212,160,23,0.70); margin-bottom: 8px; direction: rtl; text-align: right; }
        .cn-details ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 7px; }
        .cn-details li { font-size: 12px; color: rgba(232,223,200,0.60); direction: rtl; text-align: right; padding-right: 12px; position: relative; }
        .cn-details li::before { content: "•"; color: rgba(212,160,23,0.50); position: absolute; right: 0; }
        .cn-note { font-size: 11px !important; color: rgba(212,160,23,0.38) !important; margin-top: 10px !important; margin-bottom: 0 !important; }
        .cn-btns { width: 100%; display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
        .cn-btn-accept {
          width: 100%; padding: 14px;
          background: #d4a017; color: #06080f;
          border: none; border-radius: 14px;
          font-size: 15px; font-weight: 700;
          font-family: 'Vazirmatn', sans-serif; cursor: pointer;
          box-shadow: 0 0 22px rgba(212,160,23,0.50);
          transition: background .2s, transform .1s;
        }
        .cn-btn-accept:hover  { background: #e8b520; }
        .cn-btn-accept:active { transform: scale(.97); }
        .cn-btn-more {
          width: 100%; padding: 10px;
          background: transparent; color: rgba(212,160,23,0.50);
          border: 1px solid rgba(212,160,23,0.18);
          border-radius: 12px; font-size: 13px;
          font-family: 'Vazirmatn', sans-serif; cursor: pointer;
          transition: color .2s, border-color .2s;
        }
        .cn-btn-more:hover { color: rgba(212,160,23,0.80); border-color: rgba(212,160,23,0.38); }

        /* ── ONBOARDING ── */
        .ob-overlay {
          position: fixed; inset: 0; z-index: 100;
          display: flex; align-items: center; justify-content: center;
          background: rgba(2,6,18,0.80);
          backdrop-filter: blur(10px);
          animation: obFade .35s ease both;
        }
        @keyframes obFade { from { opacity:0; } to { opacity:1; } }

        .ob-card {
          width: min(360px, 92vw);
          background: rgba(6,10,26,0.95);
          border: 1px solid rgba(212,160,23,0.28);
          border-radius: 26px;
          padding: 38px 28px 34px;
          display: flex; flex-direction: column; align-items: center; gap: 14px;
          box-shadow: 0 12px 70px rgba(0,0,0,0.75), 0 0 80px rgba(212,160,23,0.06);
          animation: obSlide .45s cubic-bezier(.22,.68,0,1.2) both;
        }
        @keyframes obSlide {
          from { transform: translateY(28px); opacity:0; }
          to   { transform: none; opacity:1; }
        }

        .ob-logo {
          width: 58px; height: 58px; border-radius: 50%;
          background: radial-gradient(circle at 36% 36%, #fff5d0, #d4a017 42%, #7a5200 88%);
          display: flex; align-items: center; justify-content: center; font-size: 22px;
          box-shadow: 0 0 22px rgba(212,160,23,0.65), 0 0 50px rgba(212,160,23,0.28);
          animation: lp 3.2s ease-in-out infinite;
        }

        .ob-title {
          font-size: 46px; font-weight: 700; color: #d4a017;
          text-shadow: 0 0 34px rgba(212,160,23,0.55); margin: 0;
        }
        .ob-sub {
          font-size: 13px; color: rgba(212,160,23,0.50);
          text-align: center; line-height: 1.7;
        }
        .ob-sub-en { font-size: 11px; color: rgba(212,160,23,0.32); }

        .ob-fields { width: 100%; display: flex; flex-direction: column; gap: 14px; margin-top: 4px; }
        .ob-field  { display: flex; flex-direction: column; gap: 6px; }

        .ob-label {
          font-size: 12.5px; color: rgba(212,160,23,0.65);
          text-align: right; direction: rtl;
        }
        .ob-label-en { color: rgba(212,160,23,0.40); }
        .ob-opt { font-size: 11px; color: rgba(212,160,23,0.30); }

        .ob-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(212,160,23,0.22);
          border-radius: 12px; padding: 12px 14px;
          color: #e8dab5; font-size: 14px;
          font-family: 'Vazirmatn', sans-serif;
          text-align: right; direction: rtl; outline: none;
          transition: border-color .25s, box-shadow .25s;
        }
        .ob-input:focus {
          border-color: rgba(212,160,23,0.55);
          box-shadow: 0 0 0 2px rgba(212,160,23,0.08);
        }
        .ob-input::placeholder { color: rgba(212,160,23,0.22); }
        .ob-input[type=number]::-webkit-inner-spin-button { opacity: 0.3; }

        .ob-btn {
          width: 100%; margin-top: 8px; padding: 14px;
          background: #d4a017; color: #06080f;
          border: none; border-radius: 14px;
          font-size: 15px; font-weight: 600;
          font-family: 'Vazirmatn', sans-serif; cursor: pointer;
          box-shadow: 0 0 22px rgba(212,160,23,0.50);
          transition: background .2s, transform .1s;
          letter-spacing: .02em;
        }
        .ob-btn:hover  { background: #e8b520; }
        .ob-btn:active { transform: scale(.97); }

        /* ── FEEDBACK RATING ── */
        .fb-row {
          display: flex; justify-content: center;
          padding: 4px 0 8px;
          animation: pop .35s cubic-bezier(.22,.68,0,1.2) both;
        }
        .fb-card {
          background: rgba(7,14,36,.90);
          border: 1px solid rgba(212,160,23,.28);
          border-radius: 18px;
          padding: 14px 20px;
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          backdrop-filter: blur(16px);
          box-shadow: 0 4px 28px rgba(0,0,0,.45);
          max-width: 320px; width: 100%;
        }
        .fb-q {
          font-size: 13.5px; color: rgba(232,223,200,.85);
          text-align: center; direction: rtl; font-weight: 400; margin: 0;
        }
        .fb-emojis { display: flex; gap: 10px; }
        .fb-em {
          font-size: 26px; background: none; border: none; cursor: pointer;
          padding: 4px 6px; border-radius: 10px;
          transition: transform .15s, background .15s;
        }
        .fb-em:hover  { transform: scale(1.28); background: rgba(212,160,23,.10); }
        .fb-em:active { transform: scale(.92); }
        .fb-done {
          text-align: center; font-size: 13px;
          color: rgba(212,160,23,.60); padding: 8px 0 4px;
          direction: rtl;
          animation: pop .28s both;
        }
      `}</style>
    </>
  );
}
