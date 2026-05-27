"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { hashEmail } from "@/lib/hash";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);   // email-confirm flow

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) return;
    if (password.length < 6) { setError("رمز باید حداقل ۶ کاراکتر باشه"); return; }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();

      // 1. Create Supabase auth account
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email:    email.trim(),
        password,
      });

      if (signUpErr) {
        setError(signUpErr.message);
        return;
      }

      const userId = data.user?.id;
      if (!userId) {
        // Email confirmation required — inform user
        setDone(true);
        return;
      }

      // 2. Hash the email (never store plain text)
      const emailHash = await hashEmail(email.trim());

      // 3. Create user_identity row via server route (uses service-role key)
      await fetch("/api/auth/create-profile", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ userId, emailHash }),
      });

      // 4. Store as app user ID — existing chat system picks this up
      localStorage.setItem("munir_uid", userId);

      // 5. Go home
      router.replace("/");
    } catch (err: any) {
      setError(err?.message ?? "خطای ناشناخته");
    } finally {
      setLoading(false);
    }
  }, [email, password, router]);

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700&display=swap"
        rel="stylesheet"
      />
      <div className="bg" />

      <div className="page">
        <div className="card">
          {/* Logo */}
          <div className="logo"><span>✦</span></div>
          <h1 className="title">ساخت حساب</h1>
          <p className="sub">به منیر خوش اومدی</p>

          {done ? (
            <div className="confirm-msg">
              <div className="confirm-icon">✉️</div>
              <p>لینک تأیید به ایمیلت فرستاده شد.</p>
              <p className="confirm-sub">بعد از تأیید برگرد و وارد بشو.</p>
              <button className="btn" onClick={() => router.push("/login")}>
                ورود
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="form">
              <div className="field">
                <label className="label">ایمیل</label>
                <input
                  type="email"
                  className="input"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  dir="ltr"
                />
              </div>
              <div className="field">
                <label className="label">رمز عبور</label>
                <input
                  type="password"
                  className="input"
                  placeholder="حداقل ۶ کاراکتر"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  dir="ltr"
                />
              </div>

              {error && <p className="err">{error}</p>}

              <button type="submit" className="btn" disabled={loading}>
                {loading ? "در حال ثبت‌نام..." : "ثبت‌نام"}
              </button>

              <button
                type="button"
                className="link-btn"
                onClick={() => router.push("/login")}
              >
                قبلاً ثبت‌نام کردی؟ وارد شو
              </button>
            </form>
          )}
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
            rgba(2,8,22,0.35) 0%,
            rgba(4,10,24,0.22) 30%,
            rgba(6,3,0,0.90) 100%);
        }

        .page {
          position: relative; z-index: 1;
          height: 100dvh;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Vazirmatn', sans-serif;
          direction: rtl; padding: 16px;
        }

        .card {
          width: min(380px, 100%);
          background: rgba(5,9,24,0.96);
          border: 1px solid rgba(212,160,23,0.28);
          border-radius: 28px;
          padding: 40px 28px 34px;
          display: flex; flex-direction: column; align-items: center; gap: 14px;
          box-shadow: 0 14px 80px rgba(0,0,0,0.80), 0 0 90px rgba(212,160,23,0.05);
          animation: slideUp .45s cubic-bezier(.22,.68,0,1.2) both;
        }
        @keyframes slideUp {
          from { transform: translateY(28px); opacity: 0; }
          to   { transform: none; opacity: 1; }
        }

        .logo {
          width: 58px; height: 58px; border-radius: 50%;
          background: radial-gradient(circle at 36% 36%, #fff5d0, #d4a017 42%, #7a5200 88%);
          display: flex; align-items: center; justify-content: center; font-size: 22px;
          box-shadow: 0 0 22px rgba(212,160,23,0.65), 0 0 50px rgba(212,160,23,0.28);
          animation: lp 3.2s ease-in-out infinite;
        }
        @keyframes lp {
          0%,100% { box-shadow: 0 0 14px rgba(212,160,23,0.65), 0 0 28px rgba(212,160,23,0.28); }
          50%      { box-shadow: 0 0 26px rgba(212,160,23,0.90), 0 0 52px rgba(212,160,23,0.45); }
        }

        .title {
          font-size: 28px; font-weight: 700; color: #d4a017;
          text-shadow: 0 0 28px rgba(212,160,23,0.50);
        }
        .sub {
          font-size: 13px; color: rgba(212,160,23,0.48); margin-top: -6px;
        }

        .form {
          width: 100%; display: flex; flex-direction: column; gap: 14px; margin-top: 6px;
        }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .label {
          font-size: 12.5px; color: rgba(212,160,23,0.65); text-align: right;
        }
        .input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(212,160,23,0.22);
          border-radius: 12px; padding: 12px 14px;
          color: #e8dab5; font-size: 14px;
          font-family: 'Vazirmatn', sans-serif;
          outline: none;
          transition: border-color .25s, box-shadow .25s;
        }
        .input:focus {
          border-color: rgba(212,160,23,0.55);
          box-shadow: 0 0 0 2px rgba(212,160,23,0.08);
        }
        .input::placeholder { color: rgba(212,160,23,0.22); }

        .err {
          font-size: 12.5px; color: rgba(255,120,120,0.85);
          text-align: center; padding: 8px 12px;
          background: rgba(255,60,60,0.07);
          border: 1px solid rgba(255,80,80,0.18);
          border-radius: 10px;
        }

        .btn {
          width: 100%; padding: 14px;
          background: #d4a017; color: #06080f;
          border: none; border-radius: 14px;
          font-size: 15px; font-weight: 700;
          font-family: 'Vazirmatn', sans-serif; cursor: pointer;
          box-shadow: 0 0 22px rgba(212,160,23,0.50);
          transition: background .2s, transform .1s;
          letter-spacing: .02em;
        }
        .btn:hover  { background: #e8b520; }
        .btn:active { transform: scale(.97); }
        .btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .link-btn {
          width: 100%; padding: 10px;
          background: transparent; color: rgba(212,160,23,0.50);
          border: 1px solid rgba(212,160,23,0.18);
          border-radius: 12px; font-size: 13px;
          font-family: 'Vazirmatn', sans-serif; cursor: pointer;
          transition: color .2s, border-color .2s;
        }
        .link-btn:hover {
          color: rgba(212,160,23,0.80);
          border-color: rgba(212,160,23,0.38);
        }

        /* Email-confirm state */
        .confirm-msg {
          display: flex; flex-direction: column; align-items: center;
          gap: 12px; padding: 10px 0; text-align: center;
        }
        .confirm-icon { font-size: 40px; }
        .confirm-msg p { font-size: 14px; color: rgba(232,223,200,0.82); line-height: 1.75; }
        .confirm-sub { font-size: 12px !important; color: rgba(212,160,23,0.45) !important; }
      `}</style>
    </>
  );
}
