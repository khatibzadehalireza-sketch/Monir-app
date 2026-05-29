"use client";

interface Stream {
  id: string;
  nameFA: string;
  location: string;
}

/* Video IDs for the official Saudi live streams — update here if YouTube rotates them */
const STREAMS: Stream[] = [
  { id: "bCFiCCSFoHs", nameFA: "مسجد الحرام",  location: "مکه مکرمه 🕋" },
  { id: "oMTFCLEGJTs", nameFA: "مسجد النبی",   location: "مدینه منوره 🌹" },
];

export function LiveStreams() {
  return (
    <div className="live-section">
      <div className="live-row">
        {STREAMS.map(s => (
          <a
            key={s.id}
            className="live-card"
            href={`https://www.youtube.com/watch?v=${s.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              className="live-thumb-img"
              src={`https://img.youtube.com/vi/${s.id}/hqdefault.jpg`}
              alt={s.nameFA}
            />
            <div className="live-overlay">
              <span className="live-badge">● زنده</span>
              <div className="live-overlay-info">
                <div className="live-card-name">{s.nameFA}</div>
                <div className="live-card-loc">{s.location}</div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
