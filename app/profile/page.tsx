"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

interface ProfileData {
  name:    string | null;
  country: string | null;
  streak:  number;
}

export default function ProfilePage() {
  const router  = useRouter();
  const [data, setData]         = useState<ProfileData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [userId, setUserId]     = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowser();

    // Use the real Supabase auth session — not the raw localStorage key,
    // because the chat page auto-generates a munir_uid for every visitor,
    // so checking localStorage alone would never show the guest state.
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      if (!uid) { setLoading(false); return; }

      setUserId(uid);
      // Keep localStorage in sync so the chat API uses the same ID
      localStorage.setItem("munir_uid", uid);

      fetch(`/api/profile?userId=${encodeURIComponent(uid)}`)
        .then(r => r.json())
        .then(setData)
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    });
  }, []);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      const supabase = getSupabaseBrowser();
      await supabase.auth.signOut();
      localStorage.removeItem("munir_uid");
      router.replace("/login");
    } catch {
      setLoggingOut(false);
    }
  }, [router]);

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700&display=swap"
        rel="stylesheet"
      />
      <div className="bg" />

      <div className="app">
        {/* Header */}
        <header className="phdr">
          <button className="ibtn" onClick={() => router.push("/")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </button>
          <div className="phdr-mid">
            <div className="logo"><span>✦</span></div>
            <div>
              <div className="phdr-title">پروفایل</div>
              <div className="phdr-sub">اطلاعات تو</div>
            </div>
          </div>
          <div style={{ width: 40 }} />
        </header>

        <div className="scroll">
          {loading && (
            <div className="center">
              <div className="spinner" />
              <p className="hint">در حال بارگذاری...</p>
            </div>
          )}

          {!loading && !userId && (
            <div className="center">
              <div className="empty-icon">🌙</div>
              <p className="hint">هنوز وارد نشدی</p>
              <div className="auth-btns">
                <button className="btn-gold" onClick={() => router.push("/login")}>
                  ورود
                </button>
                <button className="btn-outline" onClick={() => router.push("/signup")}>
                  ثبت‌نام
                </button>
              </div>
            </div>
          )}

          {!loading && userId && (
            <>
              {/* Avatar */}
              <div className="avatar-wrap">
                <div className="avatar">
                  <span className="avatar-star">✦</span>
                </div>
                <h2 className="uname">
                  {data?.name || "کاربر منیر"}
                </h2>
              </div>

              {/* Stats row */}
              <div className="stats">
                {/* Streak */}
                <div className="stat-card">
                  <div className="stat-val">{data?.streak ?? 0}</div>
                  <div className="stat-label">روز پشت سر هم 🔥</div>
                </div>
              </div>

              {/* Info cards */}
              <section className="section">
                <h3 className="sec-title">
                  <span className="sec-icon">👤</span> اطلاعات
                </h3>
                <div className="info-list">
                  <div className="info-row">
                    <span className="info-key">اسم</span>
                    <span className="info-val">{data?.name || "—"}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-key">کشور</span>
                    <span className="info-val">{data?.country || "—"}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-key">استریک</span>
                    <span className="info-val">{data?.streak ?? 0} روز</span>
                  </div>
                </div>
              </section>

              {/* More links */}
              <section className="section">
                <h3 className="sec-title">
                  <span className="sec-icon">🔖</span> بیشتر
                </h3>
                <div className="info-list">
                  <button className="nav-row" onClick={() => router.push("/memory")}>
                    <span className="nav-label">حافظه منیر</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="rgba(212,160,23,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9,18 15,12 9,6" />
                    </svg>
                  </button>
                </div>
              </section>

              {/* Logout */}
              <button className="logout-btn" onClick={handleLogout} disabled={loggingOut}>
                {loggingOut ? "در حال خروج..." : "خروج از حساب"}
              </button>
            </>
          )}

          <div style={{ height: 32 }} />
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
        .phdr {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; flex-shrink: 0;
          background: rgba(2,8,26,0.82);
          backdrop-filter: blur(22px) saturate(170%);
          border-bottom: 1px solid rgba(212,160,23,0.14);
          box-shadow: 0 8px 40px rgba(0,0,0,0.45);
        }
        .phdr-mid { display: flex; align-items: center; gap: 11px; }
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
        .phdr-title { color: #d4a017; font-weight: 700; font-size: 17px; }
        .phdr-sub   { color: rgba(212,160,23,0.46); font-size: 11px; font-weight: 300; margin-top: 1px; }
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
          padding: 20px 16px;
          display: flex; flex-direction: column; gap: 20px;
        }
        .scroll::-webkit-scrollbar { width: 3px; }
        .scroll::-webkit-scrollbar-thumb { background: rgba(212,160,23,0.20); border-radius: 2px; }

        /* ── CENTER (loading / no-user) ── */
        .center {
          flex: 1; display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 16px; padding: 60px 20px; text-align: center;
        }
        .empty-icon { font-size: 44px; opacity: 0.55; }
        .hint { font-size: 14px; color: rgba(212,160,23,0.50); }
        .spinner {
          width: 32px; height: 32px; border-radius: 50%;
          border: 2px solid rgba(212,160,23,0.20);
          border-top-color: rgba(212,160,23,0.70);
          animation: spin 0.9s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Auth buttons (when not logged in) */
        .auth-btns { display: flex; flex-direction: column; gap: 10px; width: min(280px, 100%); }
        .btn-gold {
          padding: 13px; border: none; border-radius: 14px;
          background: #d4a017; color: #06080f;
          font-size: 15px; font-weight: 700;
          font-family: 'Vazirmatn', sans-serif; cursor: pointer;
          box-shadow: 0 0 20px rgba(212,160,23,0.45);
          transition: background .2s;
        }
        .btn-gold:hover { background: #e8b520; }
        .btn-outline {
          padding: 12px; background: transparent;
          border: 1px solid rgba(212,160,23,0.28);
          border-radius: 14px; color: rgba(212,160,23,0.70);
          font-size: 14px; font-family: 'Vazirmatn', sans-serif; cursor: pointer;
          transition: all .2s;
        }
        .btn-outline:hover {
          border-color: rgba(212,160,23,0.55);
          color: rgba(212,160,23,0.90);
        }

        /* ── AVATAR ── */
        .avatar-wrap {
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          padding-top: 8px;
          animation: fadeIn .4s ease both;
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity:1; transform:none; } }
        .avatar {
          width: 82px; height: 82px; border-radius: 50%;
          background: radial-gradient(circle at 36% 36%, #fff5d0, #d4a017 42%, #7a5200 88%);
          display: flex; align-items: center; justify-content: center;
          font-size: 30px;
          box-shadow:
            0 0 22px rgba(212,160,23,0.65),
            0 0 50px rgba(212,160,23,0.30),
            0 0 90px rgba(212,160,23,0.12);
          animation: lp 3.2s ease-in-out infinite;
        }
        .avatar-star { font-size: 28px; }
        .uname {
          font-size: 22px; font-weight: 700; color: #e8d5a0;
          text-align: center;
        }

        /* ── STATS ── */
        .stats {
          display: flex; justify-content: center; gap: 14px;
          animation: fadeIn .5s ease both;
        }
        .stat-card {
          flex: 1; max-width: 160px;
          background: rgba(8,12,28,0.82);
          border: 1px solid rgba(212,160,23,0.22);
          border-radius: 18px; padding: 18px 14px;
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          backdrop-filter: blur(18px);
          box-shadow: 0 4px 22px rgba(0,0,0,0.42);
        }
        .stat-val {
          font-size: 36px; font-weight: 700; color: #d4a017;
          text-shadow: 0 0 20px rgba(212,160,23,0.55);
          line-height: 1;
        }
        .stat-label {
          font-size: 12px; color: rgba(212,160,23,0.55);
          text-align: center; line-height: 1.5;
        }

        /* ── SECTIONS ── */
        .section { display: flex; flex-direction: column; gap: 10px; }
        .sec-title {
          font-size: 12.5px; font-weight: 500;
          color: rgba(212,160,23,0.50);
          display: flex; align-items: center; gap: 7px;
          padding-right: 4px;
        }
        .sec-icon { font-size: 14px; }

        .info-list {
          background: rgba(8,12,28,0.80);
          border: 1px solid rgba(212,160,23,0.15);
          border-radius: 16px;
          overflow: hidden;
          backdrop-filter: blur(16px);
        }
        .info-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid rgba(212,160,23,0.08);
        }
        .info-row:last-child { border-bottom: none; }
        .info-key { font-size: 13px; color: rgba(212,160,23,0.55); }
        .info-val { font-size: 14px; color: #e8d5a0; font-weight: 400; direction: ltr; text-align: left; }

        /* nav row (clickable info row) */
        .nav-row {
          width: 100%; display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px;
          background: none; border: none; cursor: pointer;
          font-family: 'Vazirmatn', sans-serif;
          transition: background .15s;
        }
        .nav-row:hover { background: rgba(212,160,23,0.05); }
        .nav-label { font-size: 13px; color: rgba(212,160,23,0.65); }

        /* ── LOGOUT ── */
        .logout-btn {
          width: 100%; padding: 13px;
          background: rgba(255,60,60,0.06);
          border: 1px solid rgba(255,80,80,0.20);
          border-radius: 14px; color: rgba(255,110,110,0.70);
          font-size: 14px; font-family: 'Vazirmatn', sans-serif;
          cursor: pointer; transition: all .2s; margin-top: 4px;
        }
        .logout-btn:hover {
          background: rgba(255,60,60,0.12);
          border-color: rgba(255,80,80,0.40);
          color: rgba(255,130,130,0.90);
        }
        .logout-btn:disabled { opacity: 0.50; cursor: not-allowed; }
      `}</style>
    </>
  );
}
