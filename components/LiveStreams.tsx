"use client";

import { useRef, useState, useEffect } from "react";

// Al Quran Al Kareem TV  → broadcasts Al-Masjid al-Haram live 24/7
// Al Sunnah Al Nabawiyah → broadcasts Masjid al-Nabawi live 24/7
// Both streams served via Akamai CDN (Globecast); update if they rotate.
const STREAMS = [
  {
    key:    "haram",
    line1:  "مسجد",
    line2:  "الحرام",
    hlsSrc: "https://cdn-globecast.akamaized.net/live/eds/saudi_quran/hls_roku/index.m3u8",
  },
  {
    key:    "nabawi",
    line1:  "مسجد",
    line2:  "النبوی",
    hlsSrc: "https://cdn-globecast.akamaized.net/live/eds/saudi_sunnah/hls_roku/index.m3u8",
  },
];

type Stream = (typeof STREAMS)[0];

function StreamPlayer({ stream, onClose }: { stream: Stream; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef   = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;

    (async () => {
      const Hls = (await import("hls.js")).default;
      if (cancelled) return;

      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: false });
        hlsRef.current = hls;
        hls.loadSource(stream.hlsSrc);
        hls.attachMedia(video);
        hls.once(Hls.Events.MANIFEST_PARSED, () => {
          if (!cancelled) { setLoading(false); video.play().catch(() => {}); }
        });
        hls.on(Hls.Events.ERROR, (_: unknown, data: any) => {
          if (data.fatal && !cancelled) setError(true);
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari native HLS
        video.src = stream.hlsSrc;
        video.onloadedmetadata = () => {
          if (!cancelled) { setLoading(false); video.play().catch(() => {}); }
        };
        video.onerror = () => { if (!cancelled) setError(true); };
      } else {
        setError(true);
      }
    })();

    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [stream.hlsSrc]);

  return (
    <div className="sp-overlay" onClick={onClose}>
      <div className="sp-modal" onClick={(e) => e.stopPropagation()}>

        <div className="sp-header">
          <span className="sp-title">{stream.line1} {stream.line2} — پخش زنده 🔴</span>
          <button className="sp-close" onClick={onClose} aria-label="بستن">✕</button>
        </div>

        <div className="sp-body">
          {loading && !error && (
            <div className="sp-loader">
              <span className="sp-spinner" />
              <span>در حال بارگذاری پخش زنده...</span>
            </div>
          )}
          {error && (
            <div className="sp-error">
              <span style={{ fontSize: 28 }}>⚠️</span>
              <span>پخش در این مرورگر پشتیبانی نمی‌شود</span>
            </div>
          )}
          <video
            ref={videoRef}
            className="sp-video"
            playsInline
            controls
            style={{ opacity: loading && !error ? 0 : 1, transition: "opacity .3s" }}
          />
        </div>

      </div>
    </div>
  );
}

export function LiveStreams() {
  const [active, setActive] = useState<Stream | null>(null);

  return (
    <>
      <div className="live-section">
        <div className="live-row">
          {STREAMS.map((s) => (
            <button
              key={s.key}
              className="live-story"
              onClick={() => setActive(s)}
              aria-label={`پخش زنده ${s.line1} ${s.line2}`}
            >
              <div className="live-ring">
                <div className="live-circle">
                  <span className="live-circle-line">{s.line1}</span>
                  <span className="live-circle-line">{s.line2}</span>
                </div>
              </div>
              <span className="live-label">● زنده</span>
            </button>
          ))}
        </div>
      </div>

      {active && <StreamPlayer stream={active} onClose={() => setActive(null)} />}

      <style>{`
        button.live-story {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          font-family: inherit;
        }

        /* ── stream player overlay ── */
        .sp-overlay {
          position: fixed; inset: 0; z-index: 300;
          background: rgba(0,0,0,0.88);
          display: flex; align-items: center; justify-content: center;
          animation: sp-fade .2s ease;
        }
        @keyframes sp-fade { from { opacity:0; } to { opacity:1; } }

        .sp-modal {
          width: min(96vw, 640px);
          background: rgba(4,10,28,0.97);
          border: 1px solid rgba(212,160,23,0.30);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 20px 80px rgba(0,0,0,0.80);
          animation: sp-slide .25s cubic-bezier(.22,.68,0,1.15);
        }
        @keyframes sp-slide {
          from { opacity:0; transform:scale(.92) translateY(16px); }
          to   { opacity:1; transform:none; }
        }

        .sp-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 13px 16px;
          border-bottom: 1px solid rgba(212,160,23,0.12);
        }
        .sp-title {
          font-size: 14px; font-weight: 600;
          color: #e8d5a0; direction: rtl;
        }
        .sp-close {
          width: 30px; height: 30px; border-radius: 50%;
          border: none; background: rgba(255,255,255,0.08);
          color: rgba(212,160,23,0.70);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; font-size: 13px;
          transition: background .15s;
        }
        .sp-close:hover { background: rgba(255,255,255,0.14); color: #d4a017; }

        .sp-body {
          position: relative;
          background: #000;
          aspect-ratio: 16/9;
        }
        .sp-video {
          width: 100%; height: 100%;
          display: block;
        }
        .sp-loader, .sp-error {
          position: absolute; inset: 0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 10px;
          color: rgba(212,160,23,0.65); font-size: 13px;
          direction: rtl; pointer-events: none;
        }
        .sp-spinner {
          width: 32px; height: 32px; border-radius: 50%;
          border: 3px solid rgba(212,160,23,0.18);
          border-top-color: rgba(212,160,23,0.75);
          animation: sp-spin .9s linear infinite;
        }
        @keyframes sp-spin { to { transform: rotate(360deg); } }
        .sp-error { color: rgba(232,223,200,0.60); }
      `}</style>
    </>
  );
}
