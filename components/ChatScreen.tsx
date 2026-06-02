"use client";

import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";
import type { Message } from "@/lib/types";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const OPENING = "اینجام و دوست دارم بشنوم 🌙";
const QURAN_STREAM = "https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/55.mp3";

type ChatIntent = 'story' | 'post' | 'prayer' | 'qibla' | 'profile';

function detectChatIntent(text: string): ChatIntent | null {
  if (/استوری/.test(text))       return 'story';
  if (/پست/.test(text))          return 'post';
  if (/نماز|اذان/.test(text))    return 'prayer';
  if (/قبله/.test(text))         return 'qibla';
  if (/پروفایل/.test(text))      return 'profile';
  return null;
}

const INTENT_REPLIES: Record<ChatIntent, string> = {
  story:   'باشه، ویرایشگر استوری رو برات باز می‌کنم ✦',
  post:    'باشه، ویرایشگر پست رو برات باز می‌کنم ✦',
  prayer:  'آوردم اوقات شرعی رو برات 🕌',
  qibla:   'آوردم قبله‌نما رو برات 🧭',
  profile: 'داری می‌بری به پروفایل 👤',
};

/* ── Intent widget helpers ─────────────────────── */

function calcQibla(lat: number, lon: number): number {
  const KAABA_LAT = 21.4225, KAABA_LON = 39.8262;
  const dL = (KAABA_LON - lon) * Math.PI / 180;
  const φ1 = lat * Math.PI / 180, φ2 = KAABA_LAT * Math.PI / 180;
  const x = Math.sin(dL) * Math.cos(φ2);
  const y = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dL);
  return ((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360;
}

function PrayerWidget() {
  const [times, setTimes] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = (lat: number, lon: number) =>
      fetch(`https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lon}&method=3`)
        .then(r => r.json())
        .then(d => { setTimes(d?.data?.timings ?? null); setLoading(false); })
        .catch(() => setLoading(false));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => load(p.coords.latitude, p.coords.longitude),
        ()  => load(52.3676, 4.9041),
      );
    } else {
      load(52.3676, 4.9041);
    }
  }, []);

  const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
  const NAMES: Record<string, string> = { Fajr: 'صبح', Dhuhr: 'ظهر', Asr: 'عصر', Maghrib: 'مغرب', Isha: 'عشا' };

  if (loading) return <div className="wgt-card"><div className="wgt-loading">در حال بارگذاری اوقات شرعی...</div></div>;
  if (!times)  return null;
  return (
    <div className="wgt-card">
      <div className="wgt-title">🕌 اوقات شرعی امروز</div>
      {PRAYERS.map(p => (
        <div key={p} className="wgt-row">
          <span className="wgt-label">{NAMES[p]}</span>
          <span className="wgt-value">{times[p]}</span>
        </div>
      ))}
    </div>
  );
}

function QiblaWidget() {
  const [deg, setDeg] = useState<number | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) { setErr(true); return; }
    navigator.geolocation.getCurrentPosition(
      p => setDeg(Math.round(calcQibla(p.coords.latitude, p.coords.longitude))),
      () => setErr(true),
    );
  }, []);

  return (
    <div className="wgt-card">
      <div className="wgt-title">🧭 جهت قبله</div>
      {deg !== null ? (
        <div className="wgt-qibla-row">
          <div className="wgt-compass-ring">
            <div className="wgt-compass-needle" style={{ transform: `rotate(${deg}deg)` }}>
              <div className="wgt-needle-up" />
              <div className="wgt-needle-dot" />
            </div>
          </div>
          <div>
            <div className="wgt-value">{deg}°</div>
            <div className="wgt-sublabel">از شمال 🕋</div>
          </div>
        </div>
      ) : err ? (
        <div className="wgt-err">دسترسی به موقعیت لازمه — صفحه اوقات شرعی قبله‌نمای کامل داره</div>
      ) : (
        <div className="wgt-loading">در حال محاسبه جهت قبله...</div>
      )}
    </div>
  );
}

function PostWidget({ onOpen }: { onOpen?: () => void }) {
  return (
    <div className="wgt-card">
      <div className="wgt-title">✦ ایجاد محتوای جدید</div>
      <button className="wgt-btn" onClick={onOpen}>باز کردن ویرایشگر</button>
    </div>
  );
}

/* ────────────────────────────────────────────────── */

interface Props {
  onBack: () => void;
  userName: string;
  onOpenPost?: () => void;
}

export function ChatScreen({ onBack, userName, onOpenPost }: Props) {
  const router = useRouter();

  const [messages,          setMessages]          = useState<Message[]>([]);
  const [input,             setInput]             = useState("");
  const [isLoading,         setIsLoading]         = useState(false);
  const [focused,           setFocused]           = useState(false);
  const [showFeedback,      setShowFeedback]      = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const endRef           = useRef<HTMLDivElement>(null);
  const taRef            = useRef<HTMLTextAreaElement>(null);
  const sessionStart     = useRef(new Date().toISOString());
  const msgCount         = useRef(0);
  const feedbackShownRef = useRef(false);
  const audioRef         = useRef<HTMLAudioElement | null>(null);

  const [isReciting, setIsReciting] = useState(false);

  /* Opening message on first mount */
  useEffect(() => {
    const t = setTimeout(() => {
      setMessages([{ role: "assistant", content: OPENING, id: "0" }]);
    }, 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);

  useEffect(() => {
    return () => { audioRef.current?.pause(); audioRef.current = null; };
  }, []);

  const toggleRecitation = useCallback(() => {
    if (isReciting) {
      audioRef.current?.pause();
      setIsReciting(false);
    } else {
      if (!audioRef.current) {
        audioRef.current = new Audio(QURAN_STREAM);
        audioRef.current.loop = true;
        audioRef.current.volume = 0.35;
      }
      audioRef.current.play().catch(() => {});
      setIsReciting(true);
    }
  }, [isReciting]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
  }, []);

  const submitFeedback = useCallback(async (score: number) => {
    setShowFeedback(false); setFeedbackSubmitted(true);
    const uid = localStorage.getItem("munir_uid") || "";
    const sid = `${uid}_${sessionStart.current.replace(/\D/g, "").slice(2, 16)}`;
    try {
      await fetch("/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
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

    const intent = detectChatIntent(text);
    if (intent) {
      const widgetType: Message["widget"] =
        intent === 'prayer' ? 'prayer' :
        intent === 'qibla'  ? 'qibla'  :
        (intent === 'story' || intent === 'post') ? 'post' : undefined;

      setTimeout(() => setMessages(p => [...p, {
        role: "assistant" as const,
        content: INTENT_REPLIES[intent],
        id: Date.now().toString(),
        widget: widgetType,
      }]), 400);
      setTimeout(() => {
        if (intent === 'story' || intent === 'post') onOpenPost?.();
        else if (intent === 'profile') router.push('/profile');
      }, 900);
      return;
    }

    setIsLoading(true);
    msgCount.current++;
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          userId: (() => {
            let id = localStorage.getItem("munir_uid");
            if (!id) { id = "u_" + Math.random().toString(36).slice(2); localStorage.setItem("munir_uid", id); }
            return id;
          })(),
          sessionStartTime:    sessionStart.current,
          sessionMessageCount: msgCount.current,
          userName:    userName || undefined,
          consentGiven: localStorage.getItem("monir_consent_given") === "true" ? true : undefined,
          consentDate:  localStorage.getItem("monir_consent_date") || undefined,
        }),
      });
      const data = await res.json();
      setMessages(p => [...p, { role: "assistant", content: data.reply, id: Date.now().toString(), widget: data.uiComponent }]);
      if (msgCount.current >= 5 && !feedbackShownRef.current) {
        feedbackShownRef.current = true; setShowFeedback(true);
      }
    } catch {
      setMessages(p => [...p, { role: "assistant", content: "فرزندم... ارتباط قطع شد.", id: Date.now().toString() }]);
    } finally { setIsLoading(false); }
  }, [input, isLoading, messages, userName, onOpenPost, router]);

  const onKey = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }, [send]);

  return (
    <div className="screen chat">
      <header className="chdr">
        <button className="ibtn" onClick={onBack}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
        </button>
        <div className="chdr-mid">
          <div className="logo"><span>✦</span></div>
          <div>
            <div className="hname">منیر</div>
            <div className="htag">همراه معنوی</div>
          </div>
        </div>
        <div className="hverse">أَفَلَا تَتَفَکَّرُونَ</div>
        <button
          className={`ibtn qrn-btn${isReciting ? " qrn-on" : ""}`}
          onClick={toggleRecitation}
          title={isReciting ? "توقف تلاوت" : "تلاوت قرآن"}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </button>
      </header>

      <div className="msgs">
        {messages.map(m => (
          <Fragment key={m.id}>
            <div className={`row row-${m.role}`}>
              {m.role === "assistant" && <div className="av"><span>✦</span></div>}
              <div className={`bubble bubble-${m.role}`}>{m.content}</div>
            </div>
            {m.widget === 'prayer' && <ErrorBoundary silent><PrayerWidget /></ErrorBoundary>}
            {m.widget === 'qibla'  && <ErrorBoundary silent><QiblaWidget /></ErrorBoundary>}
            {m.widget === 'post'   && <ErrorBoundary silent><PostWidget onOpen={onOpenPost} /></ErrorBoundary>}
          </Fragment>
        ))}
        {isLoading && (
          <div className="row row-assistant">
            <div className="av"><span>✦</span></div>
            <div className="bubble bubble-assistant bubble-dots">
              <span className="d" style={{ animationDelay: "0s" }} />
              <span className="d" style={{ animationDelay: ".2s" }} />
              <span className="d" style={{ animationDelay: ".4s" }} />
            </div>
          </div>
        )}
        {showFeedback && !feedbackSubmitted && (
          <div className="fb-row">
            <div className="fb-card">
              <p className="fb-q">این مکالمه چقدر کمک کرد؟</p>
              <div className="fb-emojis">
                {(["😞", "😕", "😐", "🙂", "😊"] as const).map((em, i) => (
                  <button key={i} className="fb-em" onClick={() => submitFeedback(i + 1)}>{em}</button>
                ))}
              </div>
            </div>
          </div>
        )}
        {feedbackSubmitted && <div className="fb-done">ممنون از نظرت 🌙</div>}
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
