"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Header }        from "@/components/Header";
import { MonirOrb }      from "@/components/MonirOrb";
import { BottomNav }     from "@/components/BottomNav";
import type { Tab }      from "@/components/BottomNav";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { Post }     from "@/lib/types";

interface Props {
  activeTab:   Tab;
  onTab:       (tab: Tab) => void;
  userId:      string | null;
  posts:       Post[];
  nextCursor:  string | null;
  loadingFeed: boolean;
  loadingMore: boolean;
  onLoadMore:  () => void;
  onNewPost:   () => void;
  onOpenChat:  () => void;
}

const PRAYER_ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const PRAYER_FA: Record<string, string> = {
  Fajr: 'فجر', Dhuhr: 'ظهر', Asr: 'عصر', Maghrib: 'مغرب', Isha: 'عشا',
};

export function HomeScreen({
  activeTab, onTab, onOpenChat,
}: Props) {
  const [input,      setInput]      = useState("");
  const [nextPrayer, setNextPrayer] = useState<{ name: string; time: string } | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const load = (lat: number, lon: number) =>
      fetch(`https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lon}&method=3`)
        .then(r => r.json())
        .then(d => {
          const t = d?.data?.timings;
          if (!t) return;
          const now = new Date().getHours() * 60 + new Date().getMinutes();
          for (const p of PRAYER_ORDER) {
            const [h, m] = (t[p] || '').split(':').map(Number);
            if (h * 60 + m > now) { setNextPrayer({ name: p, time: t[p] }); return; }
          }
          setNextPrayer({ name: 'Fajr', time: t['Fajr'] });
        })
        .catch(() => {});

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => load(p.coords.latitude, p.coords.longitude),
        () => load(52.3676, 4.9041),
        { timeout: 8000, maximumAge: 300_000 },
      );
    } else {
      load(52.3676, 4.9041);
    }
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem("dua-played-date") === today) return;

    let played = false;
    const play = () => {
      if (played) return;
      played = true;
      document.removeEventListener('click', play);
      document.removeEventListener('touchstart', play);
      const audio = new Audio("https://cdn.islamic.network/quran/audio/128/ar.alafasy/1374.mp3");
      audio.volume = 0.6;
      audio.play().then(() => {
        localStorage.setItem("dua-played-date", today);
      }).catch(() => {});
    };

    document.addEventListener('click', play);
    document.addEventListener('touchstart', play);
    return () => {
      document.removeEventListener('click', play);
      document.removeEventListener('touchstart', play);
    };
  }, []);

  const submit = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    localStorage.setItem("monir_auto_msg", text);
    onOpenChat();
  }, [input, onOpenChat]);

  const onKey = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  }, [submit]);

  return (
    <div className="screen home">
      <div aria-hidden="true" style={{ position: "absolute", top: "5%", left: "50%", transform: "translateX(-50%)", fontFamily: "'Scheherazade New', serif", fontSize: "2.5rem", background: "linear-gradient(135deg, #D4A017, #F5D060, #B8860B)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", zIndex: 10, pointerEvents: "none", userSelect: "none" }}>ﷲ</div>
      <ErrorBoundary silent>
        <Header />
      </ErrorBoundary>

      <div className="home-body">
        <MonirOrb onClick={onOpenChat} />

        <p className="home-subtitle">امروز چه در دلت داری؟</p>

        <div className="home-ibox">
          <textarea
            ref={taRef}
            className="home-ta"
            placeholder="بنویس..."
            rows={1}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={onKey}
          />
          <button
            className={`home-sbtn${input.trim() ? " home-sbtn-on" : ""}`}
            onClick={submit}
            disabled={!input.trim()}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>

        {nextPrayer && (
          <p className="home-prayer">
            {PRAYER_FA[nextPrayer.name]} · {nextPrayer.time}
          </p>
        )}
      </div>

      <ErrorBoundary silent>
        <BottomNav activeTab={activeTab} onTab={onTab} />
      </ErrorBoundary>

      <style>{`
        .home-body {
          flex: 1; min-height: 0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 18px; padding: 20px 24px;
        }
        .home-dua {
          font-size: 13px;
          color: rgba(212,160,23,0.55);
          font-family: 'Scheherazade New', 'Vazirmatn', serif;
          letter-spacing: 0.05em;
          text-align: center;
        }
        .home-subtitle {
          font-size: 14px; font-weight: 300;
          color: rgba(232,223,200,0.42);
          font-family: 'Vazirmatn', sans-serif;
          direction: rtl; text-align: center;
        }
        .home-ibox {
          width: 100%; max-width: 360px;
          display: flex; align-items: flex-end; gap: 10px;
          background: rgba(255,255,255,0.034);
          border: 1px solid rgba(212,160,23,0.18);
          border-radius: 22px; padding: 10px 14px;
          transition: border-color .25s, box-shadow .25s;
        }
        .home-ibox:focus-within {
          border-color: rgba(212,160,23,0.50);
          box-shadow: 0 0 0 3px rgba(212,160,23,0.07), 0 0 30px rgba(212,160,23,0.12);
        }
        .home-ta {
          flex: 1; background: transparent; border: none; outline: none;
          color: #e8dab5; font-size: 14px; line-height: 1.65;
          font-family: 'Vazirmatn', sans-serif;
          text-align: right; direction: rtl; resize: none;
          max-height: 120px; overflow-y: auto; font-weight: 300;
        }
        .home-ta::placeholder { color: rgba(212,160,23,0.26); }
        .home-sbtn {
          width: 38px; height: 38px; border-radius: 50%; border: none; flex-shrink: 0;
          background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.20);
          display: flex; align-items: center; justify-content: center;
          cursor: not-allowed; transition: all .22s;
        }
        .home-sbtn.home-sbtn-on {
          background: linear-gradient(135deg, #e8b520, #d4a017);
          color: #06080f; cursor: pointer;
          box-shadow: 0 0 18px rgba(212,160,23,0.58), 0 0 36px rgba(212,160,23,0.20);
        }
        .home-sbtn.home-sbtn-on:hover { background: linear-gradient(135deg, #f5c830, #e8b520); }
        .home-prayer {
          font-size: 12px; font-weight: 300;
          color: rgba(212,160,23,0.38);
          font-family: 'Vazirmatn', sans-serif;
          direction: rtl; text-align: center;
        }
      `}</style>
    </div>
  );
}
