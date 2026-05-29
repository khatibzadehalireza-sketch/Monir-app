"use client";

/* Video IDs for the official Saudi live streams — update here if YouTube rotates them */
const STREAMS = [
  { id: "bCFiCCSFoHs", line1: "مسجد", line2: "الحرام" },
  { id: "oMTFCLEGJTs", line1: "مسجد", line2: "النبوی"  },
];

export function LiveStreams() {
  return (
    <div className="live-section">
      <div className="live-row">
        {STREAMS.map(s => (
          <a
            key={s.id}
            className="live-story"
            href={`https://www.youtube.com/watch?v=${s.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="live-ring">
              <div className="live-circle">
                <span className="live-circle-line">{s.line1}</span>
                <span className="live-circle-line">{s.line2}</span>
              </div>
            </div>
            <span className="live-label">● زنده</span>
          </a>
        ))}
      </div>
    </div>
  );
}
