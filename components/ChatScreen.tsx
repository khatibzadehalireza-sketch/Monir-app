"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Message } from "@/lib/types";

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
      setTimeout(() => setMessages(p => [...p, { role: "assistant", content: INTENT_REPLIES[intent], id: Date.now().toString() }]), 400);
      setTimeout(() => {
        if (intent === 'story' || intent === 'post') onOpenPost?.();
        else if (intent === 'prayer' || intent === 'qibla') router.push('/prayer');
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
      setMessages(p => [...p, { role: "assistant", content: data.reply, id: Date.now().toString() }]);
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
          <div key={m.id} className={`row row-${m.role}`}>
            {m.role === "assistant" && <div className="av"><span>✦</span></div>}
            <div className={`bubble bubble-${m.role}`}>{m.content}</div>
          </div>
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
