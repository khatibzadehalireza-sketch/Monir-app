"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface MemoryData {
  identity: Record<string, any>;
  profile:  Record<string, any>;
  lifeEvents: { id: string; event_type: string; event_year: number | null; description: string | null; impact_on_faith: number | null }[];
}

// Persian labels for each field
const IDENTITY_LABELS: Record<string, string> = {
  country:            "کشور فعلی",
  city:               "شهر",
  ip_country:         "کشور (شبکه)",
  ip_city:            "شهر (شبکه)",
  origin_country:     "کشور اصلی",
  age_range:          "گروه سنی",
  family_status:      "وضعیت خانوادگی",
  education_level:    "تحصیلات",
  years_in_west:      "سال‌ها در غرب",
  convert_status:     "پیشینه مسلمانی",
  communication_style:"سبک ارتباط",
};

const PROFILE_LABELS: Record<string, string> = {
  name:                    "اسم",
  prayer_status:           "وضعیت نماز",
  topic_tags:              "موضوعات مکالمه",
  recurring_struggles:     "چالش‌های تکرارشونده",
  spiritual_journey_stage: "مرحله سفر معنوی",
  quran_relationship:      "رابطه با قرآن",
  mosque_attendance:       "حضور در مسجد",
  identity_conflict:       "تعارض هویتی",
  coping_style:            "شیوه مقابله",
  fiqh_school:             "مذهب فقهی",
  emotional_state:         "حال عاطفی اخیر",
  breakthrough_moments:    "لحظات روشنایی",
};

function formatValue(v: any): string {
  if (v === null || v === undefined || v === "") return "";
  if (Array.isArray(v)) return v.join(" · ");
  return String(v);
}

export default function MemoryPage() {
  const router = useRouter();
  const [data, setData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [forgetting, setForgetting] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const uid = localStorage.getItem("munir_uid");
    if (!uid) { setLoading(false); return; }
    setUserId(uid);
    fetch(`/api/memory?userId=${encodeURIComponent(uid)}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const forget = useCallback(async (
    table: "user_identity" | "user_profiles" | "life_events",
    field?: string,
    lifeEventId?: string,
  ) => {
    if (!userId) return;
    const key = lifeEventId ?? `${table}:${field}`;
    setForgetting(key);
    await fetch("/api/memory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, table, field, lifeEventId }),
    });
    // Optimistic update
    setData(prev => {
      if (!prev) return prev;
      if (table === "life_events" && lifeEventId) {
        return { ...prev, lifeEvents: prev.lifeEvents.filter(e => e.id !== lifeEventId) };
      }
      if (table === "user_identity" && field) {
        return { ...prev, identity: { ...prev.identity, [field]: null } };
      }
      if (table === "user_profiles" && field) {
        return { ...prev, profile: { ...prev.profile, [field]: null } };
      }
      return prev;
    });
    setForgetting(null);
  }, [userId]);

  const hasAny = (obj: Record<string, any>, keys: string[]) =>
    keys.some(k => obj[k] !== null && obj[k] !== undefined && obj[k] !== "" && !(Array.isArray(obj[k]) && obj[k].length === 0));

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700&display=swap" rel="stylesheet" />
      <div className="bg" />

      <div className="app">
        {/* Header */}
        <header className="mhdr">
          <button className="ibtn" onClick={() => router.push("/")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15,18 9,12 15,6"/>
            </svg>
          </button>
          <div className="mhdr-mid">
            <div className="logo"><span>✦</span></div>
            <div>
              <div className="mhdr-title">حافظه منیر</div>
              <div className="mhdr-sub">چه چیزی درباره‌ات می‌دونم</div>
            </div>
          </div>
          <div style={{width:40}} />
        </header>

        <div className="scroll">

          {/* Loading */}
          {loading && (
            <div className="empty">
              <div className="spinner" />
              <p>در حال بارگذاری...</p>
            </div>
          )}

          {/* No userId */}
          {!loading && !userId && (
            <div className="empty">
              <div className="empty-icon">🌙</div>
              <p>هنوز گفتگویی نداشتیم</p>
              <button className="back-btn" onClick={() => router.push("/")}>برگرد به خانه</button>
            </div>
          )}

          {/* No data */}
          {!loading && userId && data && !hasAny(data.identity, Object.keys(IDENTITY_LABELS)) && !hasAny(data.profile, Object.keys(PROFILE_LABELS)) && data.lifeEvents.length === 0 && (
            <div className="empty">
              <div className="empty-icon">✦</div>
              <p>هنوز چیزی یاد نگرفتم</p>
              <p className="empty-sub">با صحبت کردن، بهتر می‌تونم کمکت کنم</p>
            </div>
          )}

          {!loading && data && (
            <>
              {/* Privacy note */}
              <div className="note-card">
                <span className="note-icon">🔒</span>
                <p>این اطلاعات فقط برای بهتر شدن مکالمه ذخیره شده. هیچ‌کدام به کسی داده نمی‌شه. هر آیتم رو می‌تونی حذف کنی.</p>
              </div>

              {/* Identity section */}
              {hasAny(data.identity, Object.keys(IDENTITY_LABELS)) && (
                <section className="section">
                  <h2 className="sec-title">
                    <span className="sec-icon">🌍</span> مکان و پیشینه
                  </h2>
                  <div className="cards-list">
                    {Object.entries(IDENTITY_LABELS).map(([field, label]) => {
                      const v = formatValue(data.identity[field]);
                      if (!v) return null;
                      return (
                        <div key={field} className="mem-card">
                          <div className="mem-left">
                            <span className="mem-label">{label}</span>
                            <span className="mem-value">{v}</span>
                          </div>
                          <button
                            className={`forget-btn${forgetting === `user_identity:${field}` ? " forget-btn-loading" : ""}`}
                            onClick={() => forget("user_identity", field)}
                            disabled={forgetting !== null}
                            title="فراموش کن"
                          >
                            {forgetting === `user_identity:${field}` ? "..." : "فراموش کن"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Profile section */}
              {hasAny(data.profile, Object.keys(PROFILE_LABELS)) && (
                <section className="section">
                  <h2 className="sec-title">
                    <span className="sec-icon">✦</span> معنویت و احساس
                  </h2>
                  <div className="cards-list">
                    {Object.entries(PROFILE_LABELS).map(([field, label]) => {
                      const v = formatValue(data.profile[field]);
                      if (!v) return null;
                      return (
                        <div key={field} className="mem-card">
                          <div className="mem-left">
                            <span className="mem-label">{label}</span>
                            <span className="mem-value">{v}</span>
                          </div>
                          <button
                            className={`forget-btn${forgetting === `user_profiles:${field}` ? " forget-btn-loading" : ""}`}
                            onClick={() => forget("user_profiles", field)}
                            disabled={forgetting !== null}
                            title="فراموش کن"
                          >
                            {forgetting === `user_profiles:${field}` ? "..." : "فراموش کن"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Life events section */}
              {data.lifeEvents.length > 0 && (
                <section className="section">
                  <h2 className="sec-title">
                    <span className="sec-icon">📖</span> رویدادهای زندگی
                  </h2>
                  <div className="cards-list">
                    {data.lifeEvents.map(ev => (
                      <div key={ev.id} className="mem-card mem-card-event">
                        <div className="mem-left">
                          <span className="mem-label">
                            {ev.event_type}
                            {ev.event_year ? ` · ${ev.event_year}` : ""}
                          </span>
                          {ev.description && <span className="mem-value">{ev.description}</span>}
                          {ev.impact_on_faith !== null && (
                            <span className="mem-tag">
                              تأثیر بر ایمان: {ev.impact_on_faith > 0 ? `+${ev.impact_on_faith}` : ev.impact_on_faith}
                            </span>
                          )}
                        </div>
                        <button
                          className={`forget-btn${forgetting === ev.id ? " forget-btn-loading" : ""}`}
                          onClick={() => forget("life_events", undefined, ev.id)}
                          disabled={forgetting !== null}
                        >
                          {forgetting === ev.id ? "..." : "فراموش کن"}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Forget everything */}
              <div className="danger-zone">
                <p className="danger-title">حذف همه چیز</p>
                <p className="danger-sub">اگه بخوای منیر کاملاً از صفر شروع کنه، از تنظیمات مرورگرت localStorage رو پاک کن.</p>
              </div>
            </>
          )}

          <div style={{height: "32px"}} />
        </div>
      </div>

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
            rgba(6,3,0,0.92) 100%);
        }

        .app {
          position: relative; z-index: 1;
          height: 100dvh;
          font-family: 'Vazirmatn', sans-serif;
          direction: rtl; color: #e8dfc8;
          display: flex; flex-direction: column;
          overflow: hidden;
        }

        /* ── HEADER ── */
        .mhdr {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; flex-shrink: 0;
          background: rgba(2,8,26,0.82);
          backdrop-filter: blur(22px) saturate(170%);
          border-bottom: 1px solid rgba(212,160,23,0.14);
          box-shadow: 0 8px 40px rgba(0,0,0,0.45);
        }
        .mhdr-mid { display: flex; align-items: center; gap: 11px; }
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
        .mhdr-title { color: #d4a017; font-weight: 700; font-size: 17px; }
        .mhdr-sub   { color: rgba(212,160,23,0.46); font-size: 11px; font-weight: 300; margin-top: 1px; }
        .ibtn {
          width: 40px; height: 40px; border-radius: 50%; border: none;
          background: rgba(255,255,255,0.09); backdrop-filter: blur(14px);
          color: rgba(212,160,23,0.80);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background .2s;
        }
        .ibtn:hover { background: rgba(255,255,255,0.14); }

        /* ── SCROLL ── */
        .scroll {
          flex: 1; overflow-y: auto; min-height: 0;
          padding: 16px 14px;
          display: flex; flex-direction: column; gap: 20px;
        }
        .scroll::-webkit-scrollbar { width: 3px; }
        .scroll::-webkit-scrollbar-thumb { background: rgba(212,160,23,0.20); border-radius: 2px; }

        /* ── LOADING / EMPTY ── */
        .empty {
          flex: 1; display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 12px; padding: 60px 20px; text-align: center;
          color: rgba(212,160,23,0.50);
        }
        .empty-icon { font-size: 38px; opacity: 0.55; }
        .empty-sub  { font-size: 12px; color: rgba(212,160,23,0.32); }
        .spinner {
          width: 32px; height: 32px; border-radius: 50%;
          border: 2px solid rgba(212,160,23,0.20);
          border-top-color: rgba(212,160,23,0.70);
          animation: spin 0.9s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .back-btn {
          margin-top: 8px; padding: 10px 22px;
          background: rgba(212,160,23,0.14);
          border: 1px solid rgba(212,160,23,0.30);
          border-radius: 12px; color: #d4a017;
          font-family: 'Vazirmatn', sans-serif; font-size: 13px;
          cursor: pointer; transition: background .2s;
        }
        .back-btn:hover { background: rgba(212,160,23,0.24); }

        /* ── PRIVACY NOTE ── */
        .note-card {
          display: flex; align-items: flex-start; gap: 10px;
          background: rgba(212,160,23,0.05);
          border: 1px solid rgba(212,160,23,0.14);
          border-radius: 14px; padding: 14px 16px;
        }
        .note-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
        .note-card p { font-size: 12.5px; color: rgba(212,160,23,0.60); line-height: 1.75; }

        /* ── SECTIONS ── */
        .section { display: flex; flex-direction: column; gap: 10px; }
        .sec-title {
          font-size: 13px; font-weight: 500;
          color: rgba(212,160,23,0.55);
          display: flex; align-items: center; gap: 7px;
          padding-right: 4px;
        }
        .sec-icon { font-size: 15px; }

        /* ── MEMORY CARDS ── */
        .cards-list { display: flex; flex-direction: column; gap: 8px; }
        .mem-card {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          background: rgba(8,12,28,0.82);
          border: 1px solid rgba(212,160,23,0.16);
          border-radius: 14px; padding: 13px 16px;
          backdrop-filter: blur(16px);
          animation: pop .28s cubic-bezier(.22,.68,0,1.2) both;
        }
        @keyframes pop {
          from { opacity: 0; transform: translateY(6px) scale(.98); }
          to   { opacity: 1; transform: none; }
        }
        .mem-card-event { align-items: flex-start; }
        .mem-left { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
        .mem-label {
          font-size: 11.5px; font-weight: 500;
          color: rgba(212,160,23,0.55);
        }
        .mem-value {
          font-size: 14px; font-weight: 400;
          color: #e8d5a0;
          word-break: break-word;
        }
        .mem-tag {
          display: inline-block; margin-top: 4px;
          font-size: 11px; color: rgba(212,160,23,0.40);
          background: rgba(212,160,23,0.07);
          border: 1px solid rgba(212,160,23,0.14);
          border-radius: 6px; padding: 2px 8px;
        }

        /* ── FORGET BUTTON ── */
        .forget-btn {
          flex-shrink: 0;
          padding: 6px 12px;
          background: transparent;
          border: 1px solid rgba(255,80,80,0.22);
          border-radius: 8px; color: rgba(255,100,100,0.55);
          font-family: 'Vazirmatn', sans-serif; font-size: 11.5px;
          cursor: pointer; transition: all .2s; white-space: nowrap;
        }
        .forget-btn:hover {
          background: rgba(255,60,60,0.10);
          border-color: rgba(255,80,80,0.45);
          color: rgba(255,120,120,0.90);
        }
        .forget-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .forget-btn-loading { opacity: 0.55; }

        /* ── DANGER ZONE ── */
        .danger-zone {
          margin-top: 8px;
          background: rgba(255,50,50,0.04);
          border: 1px solid rgba(255,80,80,0.12);
          border-radius: 14px; padding: 16px 18px;
        }
        .danger-title { font-size: 13px; font-weight: 500; color: rgba(255,100,100,0.60); margin-bottom: 6px; }
        .danger-sub   { font-size: 12px; color: rgba(212,160,23,0.35); line-height: 1.65; }
      `}</style>
    </>
  );
}
