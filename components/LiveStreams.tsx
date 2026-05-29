"use client";

import { useState } from "react";

interface Stream {
  id: string;
  nameFA: string;
  location: string;
}

/* Video IDs for the official Saudi live streams — update if YouTube rotates them */
const STREAMS: Stream[] = [
  { id: "bCFiCCSFoHs", nameFA: "مسجد الحرام",  location: "مکه مکرمه 🕋" },
  { id: "oMTFCLEGJTs", nameFA: "مسجد النبی",   location: "مدینه منوره 🌹" },
];

export function LiveStreams() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className="live-section">
      <div className="live-title">
        <span className="live-dot" />
        پخش زنده از حرمین شریفین
      </div>
      <div className="live-row">
        {STREAMS.map(s => (
          <div key={s.id} className="live-card">
            {active === s.id ? (
              <iframe
                className="live-iframe"
                src={`https://www.youtube.com/embed/${s.id}?autoplay=1&rel=0&modestbranding=1`}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <button className="live-thumb" onClick={() => setActive(s.id)}>
                <img
                  className="live-thumb-img"
                  src={`https://img.youtube.com/vi/${s.id}/hqdefault.jpg`}
                  alt={s.nameFA}
                />
                <div className="live-play">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                </div>
                <div className="live-badge">● زنده</div>
              </button>
            )}
            <div className="live-card-info">
              <div className="live-card-name">{s.nameFA}</div>
              <div className="live-card-loc">{s.location}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
