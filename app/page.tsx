"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { Header }      from "@/components/Header";
import { StoriesBar }  from "@/components/StoriesBar";
import { PostFeed }    from "@/components/PostFeed";
import { BottomNav }   from "@/components/BottomNav";
import { ChatScreen }  from "@/components/ChatScreen";
import { LiveStreams } from "@/components/LiveStreams";
import type { Post }   from "@/lib/types";

/* ─── New Post Modal ──────────────────────────────── */
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function NewPostModal({
  userId, authorName, onClose, onCreated,
}: { userId: string; authorName: string; onClose: () => void; onCreated: (p: Post) => void; }) {
  const [text,         setText]         = useState("");
  const [sending,      setSending]      = useState(false);
  const [error,        setError]        = useState("");
  const [imageFile,    setImageFile]    = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const MAX = 500;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("فقط فایل‌های jpg، png و webp مجاز هستند");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("حجم عکس نباید بیشتر از ۵ مگابایت باشد");
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError("");
  };

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = useCallback(async () => {
    if (!text.trim() || sending) return;
    setSending(true); setError("");
    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        const supabase = getSupabaseBrowser();
        const ext  = imageFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("post-images")
          .upload(path, imageFile, { contentType: imageFile.type });
        if (uploadErr) { setError("خطا در آپلود عکس. دوباره امتحان کن."); return; }
        imageUrl = supabase.storage.from("post-images").getPublicUrl(path).data.publicUrl;
      }

      const res  = await fetch("/api/posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, content: text.trim(), imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(res.status === 422 ? "محتوای پست مناسب نیست. لطفاً ویرایش کن." : (data.error ?? "خطا در ارسال"));
        return;
      }
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      onCreated({ ...data.post, author_name: authorName, comment_count: 0, i_said_ameen: false });
      onClose();
    } finally { setSending(false); }
  }, [text, sending, imageFile, imagePreview, userId, authorName, onCreated, onClose]);

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <div className="modal-hdr">
          <span className="modal-title">پست جدید ✦</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {imagePreview && (
          <div className="modal-img-preview">
            <img src={imagePreview} alt="پیش‌نمایش" />
            <button className="modal-img-remove" onClick={removeImage} type="button">✕</button>
          </div>
        )}

        <textarea className="modal-ta" placeholder="افکار معنوی‌ات رو به اشتراک بذار..."
          value={text} maxLength={MAX} autoFocus onChange={e => setText(e.target.value)} />

        <div className="modal-footer">
          <div className="modal-footer-left">
            <input
              ref={fileRef} type="file"
              accept="image/jpeg,image/png,image/webp"
              className="modal-file-input"
              onChange={handleImageSelect}
            />
            <button
              className={`modal-photo-btn${imageFile ? " modal-photo-btn-on" : ""}`}
              onClick={() => fileRef.current?.click()}
              type="button" title="افزودن عکس"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </button>
            <span className={`char-count${text.length > MAX * 0.9 ? " char-warn" : ""}`}>{text.length}/{MAX}</span>
          </div>
          {error && <span className="modal-err">{error}</span>}
          <button className={`modal-submit${text.trim() && !sending ? " modal-submit-on" : ""}`}
            onClick={submit} disabled={!text.trim() || sending}>
            {sending ? (imageFile ? "در حال آپلود..." : "در حال ارسال...") : "انتشار"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main App ────────────────────────────────────── */
export default function App() {
  const [screen, setScreen] = useState<"home" | "chat">("home");

  /* auth */
  const [userId,     setUserId]     = useState<string | null>(null);
  const [authorName, setAuthorName] = useState("کاربر منیر");
  const [userName,   setUserName]   = useState("");

  /* feed */
  const [posts,       setPosts]       = useState<Post[]>([]);
  const [nextCursor,  setNextCursor]  = useState<string | null>(null);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showNew,     setShowNew]     = useState(false);

  /* consent / onboarding */
  const [showConsent,     setShowConsent]     = useState(false);
  const [consentExpanded, setConsentExpanded] = useState(false);
  const [showOnboarding,  setShowOnboarding]  = useState(false);
  const [onboardingName,  setOnboardingName]  = useState("");
  const [onboardingAge,   setOnboardingAge]   = useState("");

  const router      = useRouter();
  const feedInitRef = useRef(false);

  /* ── Consent / onboarding check ─────────────────── */
  useEffect(() => {
    if (!localStorage.getItem("monir_consent_given")) {
      setShowConsent(true);
    } else if (!localStorage.getItem("monir_onboarding_done")) {
      setShowOnboarding(true);
    } else {
      setUserName(localStorage.getItem("monir_user_name") || "");
    }
  }, []);

  /* ── Open-chat signal (from FAB or story tap) ────── */
  useEffect(() => {
    const handler = () => setScreen("chat");
    window.addEventListener("open-monir-chat", handler);
    return () => window.removeEventListener("open-monir-chat", handler);
  }, []);

  /* ── Pending open (FAB navigated from other page) ── */
  useEffect(() => {
    if (localStorage.getItem("monir_open_chat_pending") === "1") {
      localStorage.removeItem("monir_open_chat_pending");
      setScreen("chat");
    }
  }, []);

  /* ── Auth ────────────────────────────────────────── */
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        localStorage.setItem("munir_uid", uid);
        fetch(`/api/profile?userId=${encodeURIComponent(uid)}`)
          .then(r => r.json())
          .then(d => { if (d.name) setAuthorName(d.name); })
          .catch(() => {});
      }
    });
  }, []);

  /* ── Load feed ───────────────────────────────────── */
  const loadFeed = useCallback(async (cursor?: string) => {
    if (!cursor) setLoadingFeed(true); else setLoadingMore(true);
    try {
      const uid    = userId ?? "";
      const params = new URLSearchParams({ limit: "20" });
      if (cursor) params.set("cursor", cursor);
      if (uid)    params.set("userId", uid);
      const res  = await fetch(`/api/feed?${params}`);
      const data = await res.json();
      setPosts(p => cursor ? [...p, ...(data.posts ?? [])] : (data.posts ?? []));
      setNextCursor(data.nextCursor ?? null);
    } finally { setLoadingFeed(false); setLoadingMore(false); }
  }, [userId]);

  useEffect(() => {
    if (feedInitRef.current) return;
    feedInitRef.current = true;
    loadFeed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Consent handlers ────────────────────────────── */
  const handleConsent = useCallback(() => {
    const date = new Date().toISOString();
    localStorage.setItem("monir_consent_given", "true");
    localStorage.setItem("monir_consent_date", date);
    setShowConsent(false);
    if (!localStorage.getItem("monir_onboarding_done")) setShowOnboarding(true);
    else setUserName(localStorage.getItem("monir_user_name") || "");
  }, []);

  const completeOnboarding = useCallback(() => {
    const name = onboardingName.trim();
    const age  = onboardingAge.trim();
    if (name) localStorage.setItem("monir_user_name", name);
    if (age)  localStorage.setItem("monir_user_age",  age);
    localStorage.setItem("monir_onboarding_done", "true");
    setUserName(name);
    setShowOnboarding(false);
  }, [onboardingName, onboardingAge]);

  /* ── Render ──────────────────────────────────────── */
  return (
    <>
      <div className="bg" />

      <div className="app">

        {/* ══ HOME SCREEN ══ */}
        {screen === "home" && (
          <div className="screen home">
            <Header />
            <StoriesBar onOpenChat={() => setScreen("chat")} />
            <LiveStreams />
            <PostFeed
              posts={posts}
              userId={userId}
              loadingFeed={loadingFeed}
              loadingMore={loadingMore}
              nextCursor={nextCursor}
              onLoadMore={() => loadFeed(nextCursor ?? undefined)}
              onNewPost={() => userId ? setShowNew(true) : router.push("/login")}
            />
            <BottomNav
              onNewPost={() => userId ? setShowNew(true) : router.push("/login")}
            />
          </div>
        )}

        {/* ══ CHAT SCREEN ══ */}
        {screen === "chat" && (
          <ChatScreen
            onBack={() => setScreen("home")}
            userName={userName}
            onOpenPost={() => userId ? setShowNew(true) : router.push("/login")}
          />
        )}
      </div>

      {/* ── New post modal ── */}
      {showNew && userId && (
        <NewPostModal
          userId={userId} authorName={authorName}
          onClose={() => setShowNew(false)}
          onCreated={post => setPosts(p => [post, ...p])}
        />
      )}

      {/* ── Consent overlay ── */}
      {showConsent && (
        <div className="cn-overlay">
          <div className="cn-card">
            <div className="cn-logo"><span>✦</span></div>
            <h2 className="cn-title">منیر</h2>
            <p className="cn-text">منیر برای بهتر شدن تجربه‌ات، بعضی اطلاعات رو ذخیره می‌کنه</p>
            {consentExpanded && (
              <div className="cn-details">
                <p>اطلاعاتی که ذخیره می‌شه:</p>
                <ul>
                  <li>احساسات و موضوعات مکالمه</li>
                  <li>موقعیت تقریبی (کشور / شهر)</li>
                  <li>الگوهای رشد معنوی</li>
                </ul>
                <p className="cn-note">هیچ اطلاعات شخصی‌ای به کسی داده نمی‌شه</p>
              </div>
            )}
            <div className="cn-btns">
              <button className="cn-btn-accept" onClick={handleConsent}>قبول می‌کنم</button>
              <button className="cn-btn-more" onClick={() => setConsentExpanded(p => !p)}>
                {consentExpanded ? "بستن" : "بیشتر بدون"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Onboarding overlay ── */}
      {showOnboarding && (
        <div className="ob-overlay">
          <div className="ob-card">
            <div className="ob-logo"><span>✦</span></div>
            <h1 className="ob-title">منیر</h1>
            <p className="ob-sub">همراه معنوی تو<br /><span className="ob-sub-en">Your Spiritual Companion</span></p>
            <div className="ob-fields">
              <div className="ob-field">
                <label className="ob-label">اسم <span className="ob-label-en">/ Name</span> <span className="ob-opt">(اختیاری / optional)</span></label>
                <input className="ob-input" type="text" placeholder="اسمت چیه؟ / What's your name?"
                  value={onboardingName} onChange={e => setOnboardingName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && completeOnboarding()} autoComplete="off" />
              </div>
              <div className="ob-field">
                <label className="ob-label">سن <span className="ob-label-en">/ Age</span> <span className="ob-opt">(اختیاری / optional)</span></label>
                <input className="ob-input" type="number" placeholder="سنت چنده؟ / How old are you?"
                  value={onboardingAge} onChange={e => setOnboardingAge(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && completeOnboarding()} min="10" max="100" />
              </div>
            </div>
            <button className="ob-btn" onClick={completeOnboarding}>شروع کن &nbsp;/&nbsp; Start</button>
          </div>
        </div>
      )}

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #020a1a; overflow: hidden; }

        /* ── Galaxy background ── */
        .bg {
          position: fixed; inset: 0; z-index: 0;
          background-image: url('https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1080&q=85');
          background-size: cover; background-position: center;
        }
        .bg::after {
          content: ''; position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 50% 0%, rgba(212,160,23,0.06) 0%, transparent 60%),
            linear-gradient(180deg,
              rgba(2,8,22,0.70) 0%,
              rgba(3,9,22,0.58) 30%,
              rgba(4,6,18,0.72) 65%,
              rgba(3,4,12,0.97) 100%);
        }

        /* ── App shell ── */
        .app {
          position: relative; z-index: 1;
          height: 100dvh;
          font-family: 'Vazirmatn', sans-serif;
          direction: rtl; color: #e8dfc8;
          overflow: hidden;
        }
        .screen {
          position: absolute; inset: 0;
          display: flex; flex-direction: column;
        }

        /* ════════════════════════════════════════════
           HEADER
        ════════════════════════════════════════════ */
        .ig-hdr {
          display: flex; align-items: center; justify-content: space-between;
          padding: 15px 20px 13px; flex-shrink: 0;
          background: linear-gradient(180deg, rgba(2,7,22,0.96) 0%, rgba(3,9,24,0.88) 100%);
          backdrop-filter: blur(28px) saturate(180%);
          border-bottom: 1px solid rgba(212,160,23,0.10);
          box-shadow: 0 1px 0 rgba(212,160,23,0.06), 0 8px 40px rgba(0,0,0,0.50);
        }
        .ig-logo {
          font-size: 28px; font-weight: 800; letter-spacing: -0.02em;
          background: linear-gradient(135deg, #f5d060 0%, #d4a017 45%, #b8860b 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 0 18px rgba(212,160,23,0.55));
          line-height: 1;
          font-family: 'Vazirmatn', sans-serif;
        }
        .ibtn {
          width: 38px; height: 38px; border-radius: 50%; border: none;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(12px);
          color: rgba(212,160,23,0.75);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all .22s; position: relative;
        }
        .ibtn:hover {
          background: rgba(212,160,23,0.12);
          border-color: rgba(212,160,23,0.28);
          color: #d4a017;
        }
        .ndot {
          position: absolute; top: 8px; left: 8px;
          width: 8px; height: 8px; border-radius: 50%;
          background: #d4a017;
          box-shadow: 0 0 8px rgba(212,160,23,1), 0 0 16px rgba(212,160,23,0.50);
          border: 1.5px solid rgba(2,7,22,0.9);
        }

        /* ════════════════════════════════════════════
           STORIES BAR
        ════════════════════════════════════════════ */
        .stories-bar {
          display: flex; gap: 14px;
          padding: 14px 18px 12px;
          overflow-x: auto; flex-shrink: 0;
          background: rgba(2,7,22,0.60);
          border-bottom: 1px solid rgba(212,160,23,0.06);
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .stories-bar::-webkit-scrollbar { display: none; }

        .story {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          background: none; border: none; cursor: pointer; flex-shrink: 0;
          padding: 2px;
          transition: transform .2s;
        }
        .story:active { transform: scale(0.94); }

        .story-ring {
          border-radius: 50%;
          padding: 2.5px;
          background: rgba(212,160,23,0.20);
        }
        .story-ring-ai {
          background: conic-gradient(
            from 0deg,
            #d4a017 0%,
            #f5d060 20%,
            #ffe99a 35%,
            #d4a017 50%,
            #8b6008 70%,
            #d4a017 85%,
            #f5d060 100%
          );
          animation: ring-spin 3.5s linear infinite;
          box-shadow:
            0 0 14px rgba(212,160,23,0.55),
            0 0 32px rgba(212,160,23,0.25),
            0 0 60px rgba(212,160,23,0.10);
        }
        @keyframes ring-spin { to { transform: rotate(360deg); } }

        .story-av {
          width: 78px; height: 78px; border-radius: 50%;
          background: rgba(8,12,30,0.95);
          border: 2.5px solid #020a1a;
          display: flex; align-items: center; justify-content: center;
          font-size: 28px; font-weight: 700; color: #e8d5a0;
          transition: transform .2s;
        }
        .story-av-ai {
          background: radial-gradient(circle at 35% 32%, #fff8d6, #d4a017 44%, #7a5200 90%);
          color: #06080f;
        }
        .story:hover .story-av { transform: scale(1.04); }

        .story-name {
          font-size: 11.5px; font-weight: 500;
          color: rgba(232,215,160,0.70);
          white-space: nowrap;
          font-family: 'Vazirmatn', sans-serif;
          letter-spacing: 0.01em;
        }

        /* ════════════════════════════════════════════
           FEED
        ════════════════════════════════════════════ */
        .feed-scroll {
          flex: 1; overflow-y: auto; min-height: 0;
          padding: 14px 14px 8px;
          display: flex; flex-direction: column; gap: 12px;
        }
        .feed-scroll::-webkit-scrollbar { width: 2px; }
        .feed-scroll::-webkit-scrollbar-thumb {
          background: rgba(212,160,23,0.18); border-radius: 2px;
        }

        .center-msg {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 16px; padding: 60px 20px; text-align: center;
        }
        .empty-icon { font-size: 48px; opacity: 0.50; }
        .hint { font-size: 14px; color: rgba(212,160,23,0.48); }

        .spinner {
          width: 30px; height: 30px; border-radius: 50%;
          border: 2px solid rgba(212,160,23,0.16);
          border-top-color: #d4a017;
          animation: spin 0.85s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .btn-gold {
          padding: 13px 26px; border: none; border-radius: 16px;
          background: linear-gradient(135deg, #e8b520, #d4a017);
          color: #06080f;
          font-size: 14px; font-weight: 700;
          font-family: 'Vazirmatn', sans-serif; cursor: pointer;
          box-shadow: 0 4px 24px rgba(212,160,23,0.45), 0 0 40px rgba(212,160,23,0.15);
          transition: all .22s;
        }
        .btn-gold:hover {
          background: linear-gradient(135deg, #f5c830, #e8b520);
          box-shadow: 0 6px 30px rgba(212,160,23,0.60);
          transform: translateY(-1px);
        }

        /* ════════════════════════════════════════════
           POST CARDS
        ════════════════════════════════════════════ */
        .post-card {
          position: relative;
          background: rgba(7,11,27,0.86);
          border-radius: 18px; overflow: hidden;
          backdrop-filter: blur(22px) saturate(150%);
          box-shadow:
            0 0 0 1px rgba(212,160,23,0.13),
            0 6px 28px rgba(0,0,0,0.52),
            0 2px 6px rgba(0,0,0,0.30);
          animation: fadeUp .38s cubic-bezier(.22,.68,0,1.1) both;
          transition: box-shadow .25s, transform .25s;
        }
        .post-card::before {
          content: '';
          position: absolute; top: 0; left: 18px; right: 18px; height: 1px;
          background: linear-gradient(90deg,
            transparent 0%,
            rgba(212,160,23,0.45) 30%,
            rgba(245,208,96,0.60) 50%,
            rgba(212,160,23,0.45) 70%,
            transparent 100%);
        }
        .post-card:hover {
          transform: translateY(-2px);
          box-shadow:
            0 0 0 1px rgba(212,160,23,0.22),
            0 12px 40px rgba(0,0,0,0.60),
            0 4px 16px rgba(212,160,23,0.08);
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px) scale(0.99); }
          to   { opacity: 1; transform: none; }
        }

        .post-hdr {
          display: flex; align-items: center; gap: 12px;
          padding: 16px 18px 4px;
        }
        .post-av {
          width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
          background: radial-gradient(circle at 35% 32%, #fff8d6, #d4a017 44%, #7a5200 90%);
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; font-weight: 700; color: #06080f;
          box-shadow: 0 0 12px rgba(212,160,23,0.38), 0 0 0 2px rgba(212,160,23,0.16);
        }
        .post-meta { display: flex; flex-direction: column; gap: 2px; flex: 1; }
        .post-name { font-size: 14px; font-weight: 700; color: #e8d5a0; }
        .post-time { font-size: 11px; color: rgba(212,160,23,0.38); font-weight: 300; }
        .post-hdr-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: rgba(212,160,23,0.20);
          flex-shrink: 0;
        }

        .post-content {
          padding: 10px 18px 16px;
          font-size: 15px; line-height: 1.90;
          color: rgba(232,223,200,0.88);
          white-space: pre-wrap; word-break: break-word;
          font-weight: 300;
        }

        .post-actions {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 18px 16px;
          border-top: 1px solid rgba(212,160,23,0.06);
        }

        .ameen-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 8px 16px; border-radius: 22px;
          border: 1px solid rgba(212,160,23,0.20);
          background: rgba(212,160,23,0.05);
          color: rgba(212,160,23,0.60);
          font-family: 'Vazirmatn', sans-serif; font-size: 13px; font-weight: 500;
          cursor: pointer; transition: all .22s;
        }
        .ameen-btn:hover:not(.ameen-disabled) {
          background: rgba(212,160,23,0.12);
          border-color: rgba(212,160,23,0.42);
          color: #d4a017;
          transform: scale(1.03);
        }
        .ameen-btn.ameen-on {
          background: linear-gradient(135deg, rgba(212,160,23,0.22), rgba(212,160,23,0.12));
          border-color: rgba(212,160,23,0.55);
          color: #f5d060;
          box-shadow: 0 0 18px rgba(212,160,23,0.22), inset 0 0 12px rgba(212,160,23,0.06);
        }
        .ameen-btn.ameen-disabled { cursor: default; opacity: 0.48; }
        .ameen-btn.ameen-pop { animation: ameenPop .55s cubic-bezier(.22,.68,0,1.6) both; }
        @keyframes ameenPop {
          0%   { transform: scale(1); }
          38%  { transform: scale(1.26); }
          68%  { transform: scale(0.94); }
          100% { transform: scale(1); }
        }
        .ameen-icon  { font-size: 16px; line-height: 1; }
        .ameen-label { font-weight: 600; }
        .ameen-count {
          background: rgba(212,160,23,0.20); border-radius: 10px;
          padding: 1px 8px; font-size: 11.5px; font-weight: 700;
          color: rgba(212,160,23,0.90);
        }

        /* Post image */
        .post-img-wrap {
          overflow: hidden;
          max-height: 380px;
          background: rgba(0,0,0,0.18);
        }
        .post-img {
          width: 100%; max-height: 380px;
          object-fit: cover; display: block;
          transition: transform .35s ease;
        }
        .post-card:hover .post-img { transform: scale(1.02); }

        .cmt-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 14px; border-radius: 22px;
          border: 1px solid rgba(212,160,23,0.13);
          background: transparent;
          color: rgba(212,160,23,0.42);
          font-family: 'Vazirmatn', sans-serif; font-size: 12.5px; font-weight: 500;
          cursor: pointer; transition: all .22s;
        }
        .cmt-btn:hover, .cmt-btn.cmt-btn-on {
          background: rgba(212,160,23,0.08);
          border-color: rgba(212,160,23,0.28);
          color: rgba(212,160,23,0.80);
        }

        /* ── Comment section ── */
        .cmt-wrap {
          border-top: 1px solid rgba(212,160,23,0.07);
          padding: 14px 18px 16px;
          display: flex; flex-direction: column; gap: 11px;
          background: rgba(4,7,20,0.40);
        }
        .cmt-hint       { font-size: 12.5px; color: rgba(212,160,23,0.36); text-align: center; padding: 4px 0; }
        .cmt-hint-login { font-size: 12.5px; color: rgba(212,160,23,0.34); text-align: center; padding: 4px 0; }
        .cmt-err        { font-size: 12px; color: rgba(255,100,100,0.72); text-align: center; }

        .cmt-row {
          display: flex; align-items: flex-start; gap: 10px;
          animation: fadeUp .28s ease both;
        }
        .cmt-av {
          width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
          background: radial-gradient(circle at 35% 32%, #fff8d6, #d4a017 44%, #7a5200 90%);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: #06080f;
          box-shadow: 0 0 8px rgba(212,160,23,0.25);
        }
        .cmt-body { flex: 1; display: flex; flex-direction: column; gap: 3px; }
        .cmt-name-row { display: flex; align-items: center; gap: 8px; }
        .cmt-name { font-size: 12px; font-weight: 700; color: rgba(212,160,23,0.75); }
        .cmt-time { font-size: 10px; color: rgba(212,160,23,0.28); font-weight: 300; }
        .cmt-txt  { font-size: 13px; line-height: 1.72; color: rgba(232,223,200,0.78); word-break: break-word; }

        .cmt-input-row { display: flex; align-items: flex-end; gap: 8px; margin-top: 2px; }
        .cmt-ta {
          flex: 1;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(212,160,23,0.16); border-radius: 14px;
          padding: 9px 13px;
          color: #e8dab5; font-size: 13px; line-height: 1.55;
          font-family: 'Vazirmatn', sans-serif;
          direction: rtl; text-align: right; outline: none; resize: none;
          transition: border-color .22s, box-shadow .22s;
        }
        .cmt-ta:focus {
          border-color: rgba(212,160,23,0.40);
          box-shadow: 0 0 0 2px rgba(212,160,23,0.07);
        }
        .cmt-ta::placeholder { color: rgba(212,160,23,0.22); }

        .cmt-send {
          padding: 9px 14px; border: none; border-radius: 12px;
          background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.20);
          font-family: 'Vazirmatn', sans-serif; font-size: 12.5px; font-weight: 600;
          cursor: not-allowed; transition: all .22s; white-space: nowrap;
        }
        .cmt-send.cmt-send-on {
          background: linear-gradient(135deg, #e8b520, #d4a017);
          color: #06080f; cursor: pointer;
          box-shadow: 0 0 14px rgba(212,160,23,0.42);
        }
        .cmt-send.cmt-send-on:hover { background: linear-gradient(135deg, #f5c830, #e8b520); }

        /* ── Load more ── */
        .load-more {
          display: block; width: 100%; padding: 13px;
          background: rgba(212,160,23,0.05);
          border: 1px solid rgba(212,160,23,0.16);
          border-radius: 16px; color: rgba(212,160,23,0.60);
          font-family: 'Vazirmatn', sans-serif; font-size: 13.5px; font-weight: 500;
          cursor: pointer; transition: all .22s; text-align: center;
        }
        .load-more:hover {
          background: rgba(212,160,23,0.10);
          border-color: rgba(212,160,23,0.28);
          color: #d4a017;
          transform: translateY(-1px);
        }
        .load-more-spin { display: flex; justify-content: center; padding: 14px; }
        .spinner-sm {
          width: 22px; height: 22px; border-radius: 50%;
          border: 2px solid rgba(212,160,23,0.15);
          border-top-color: #d4a017;
          animation: spin 0.85s linear infinite;
        }

        /* ════════════════════════════════════════════
           BOTTOM NAV
        ════════════════════════════════════════════ */
        .ig-bnav {
          display: flex; align-items: center; justify-content: space-around;
          padding: 10px 4px 22px; flex-shrink: 0;
          background: linear-gradient(180deg, rgba(2,5,18,0.94) 0%, rgba(1,3,12,0.98) 100%);
          backdrop-filter: blur(30px) saturate(160%);
          border-top: 1px solid rgba(212,160,23,0.10);
          box-shadow: 0 -1px 0 rgba(212,160,23,0.05), 0 -8px 32px rgba(0,0,0,0.55);
        }
        .ni {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          border: none; background: none; cursor: pointer;
          color: rgba(212,160,23,0.28);
          font-family: 'Vazirmatn', sans-serif;
          font-size: 10px; font-weight: 400;
          padding: 4px 12px;
          transition: color .22s, transform .15s;
          min-width: 52px; position: relative;
        }
        .ni:hover { color: rgba(212,160,23,0.55); transform: translateY(-1px); }
        .ni:active { transform: scale(0.90); }

        .ni-on {
          color: #d4a017;
          filter: drop-shadow(0 0 6px rgba(212,160,23,0.45));
        }
        .ni-on svg { filter: drop-shadow(0 0 4px rgba(212,160,23,0.50)); }

        .ni-pip {
          position: absolute; top: -4px; left: 50%; transform: translateX(-50%);
          width: 18px; height: 2px; border-radius: 2px;
          background: linear-gradient(90deg, #d4a017, #f5d060);
          box-shadow: 0 0 8px rgba(212,160,23,0.70);
        }

        .ni-post {
          width: 46px; height: 46px;
          background: linear-gradient(135deg, rgba(212,160,23,0.18), rgba(212,160,23,0.10));
          border: 1.5px solid rgba(212,160,23,0.35);
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          color: #d4a017;
          padding: 0; min-width: 46px;
          transition: all .22s;
          box-shadow: inset 0 1px 0 rgba(245,208,96,0.12);
        }
        .ni-post:hover {
          background: linear-gradient(135deg, rgba(212,160,23,0.30), rgba(212,160,23,0.18));
          border-color: rgba(212,160,23,0.65);
          box-shadow: 0 0 20px rgba(212,160,23,0.35), inset 0 1px 0 rgba(245,208,96,0.20);
          transform: translateY(-2px);
        }
        .ni-post:active { transform: scale(0.90); }

        /* ════════════════════════════════════════════
           CHAT SCREEN
        ════════════════════════════════════════════ */
        .chdr {
          display: flex; align-items: center; justify-content: space-between;
          padding: 13px 18px; flex-shrink: 0;
          background: linear-gradient(180deg, rgba(2,7,22,0.96) 0%, rgba(3,9,24,0.88) 100%);
          backdrop-filter: blur(28px) saturate(180%);
          border-bottom: 1px solid rgba(212,160,23,0.10);
          box-shadow: 0 1px 0 rgba(212,160,23,0.05), 0 8px 40px rgba(0,0,0,0.50);
        }
        .chdr-mid { display: flex; align-items: center; gap: 12px; }
        .logo {
          width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
          background: radial-gradient(circle at 35% 32%, #fff8d6, #d4a017 44%, #7a5200 90%);
          display: flex; align-items: center; justify-content: center; font-size: 18px;
          box-shadow: 0 0 18px rgba(212,160,23,0.55), 0 0 36px rgba(212,160,23,0.22);
          animation: logo-pulse 3.5s ease-in-out infinite;
        }
        @keyframes logo-pulse {
          0%,100% { box-shadow: 0 0 18px rgba(212,160,23,0.55), 0 0 36px rgba(212,160,23,0.22); }
          50%      { box-shadow: 0 0 28px rgba(212,160,23,0.80), 0 0 56px rgba(212,160,23,0.38); }
        }
        .hname {
          background: linear-gradient(135deg, #f5d060, #d4a017);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
          font-weight: 800; font-size: 17px; line-height: 1;
        }
        .htag   { color: rgba(212,160,23,0.44); font-size: 11px; font-weight: 300; margin-top: 3px; }
        .hverse { color: rgba(150,185,255,0.30); font-size: 11px; font-weight: 300; letter-spacing: .06em; }

        .msgs {
          flex: 1; overflow-y: auto; min-height: 0;
          padding: 18px 14px; display: flex; flex-direction: column; gap: 13px;
        }
        .msgs::-webkit-scrollbar { width: 2px; }
        .msgs::-webkit-scrollbar-thumb { background: rgba(212,160,23,0.18); border-radius: 2px; }

        .row { display: flex; align-items: flex-end; gap: 9px; }
        .row-user      { flex-direction: row-reverse; }
        .row-assistant { flex-direction: row; }

        .av {
          width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
          background: radial-gradient(circle at 35% 32%, #fff8d6, #d4a017 44%, #7a5200 90%);
          display: flex; align-items: center; justify-content: center; font-size: 13px;
          box-shadow: 0 0 12px rgba(212,160,23,0.44);
          animation: logo-pulse 3.5s ease-in-out infinite;
        }

        .bubble {
          max-width: min(76%, 440px); padding: 12px 16px;
          font-size: 14.5px; line-height: 1.85; text-align: right;
          backdrop-filter: blur(18px);
          animation: pop .30s cubic-bezier(.22,.68,0,1.2) both;
          font-weight: 300;
        }
        @keyframes pop {
          from { opacity: 0; transform: translateY(10px) scale(.96); }
          to   { opacity: 1; transform: none; }
        }
        .bubble-user {
          border-radius: 20px 5px 20px 20px;
          background:
            linear-gradient(rgba(10,24,56,.84),rgba(10,24,56,.84)) padding-box,
            linear-gradient(135deg,rgba(110,165,255,.48),rgba(50,90,210,.18)) border-box;
          border: 1px solid transparent;
          color: #cdddf8;
          box-shadow: 0 4px 20px rgba(0,8,60,.38);
        }
        .bubble-assistant {
          border-radius: 5px 20px 20px 20px;
          background:
            linear-gradient(rgba(6,12,34,.88),rgba(6,12,34,.88)) padding-box,
            linear-gradient(135deg,rgba(212,160,23,.34),rgba(170,120,8,.12)) border-box;
          border: 1px solid transparent;
          color: #eddcaa;
          box-shadow: 0 4px 20px rgba(0,0,0,.44);
        }

        .bubble-dots { display: flex; gap: 7px; align-items: center; padding: 14px 18px; }
        .d {
          width: 7px; height: 7px; border-radius: 50%; background: #d4a017;
          box-shadow: 0 0 8px rgba(212,160,23,.60);
          animation: db 1.4s ease-in-out infinite;
        }
        @keyframes db {
          0%,60%,100% { transform: translateY(0); opacity: .36; }
          30%          { transform: translateY(-9px); opacity: 1; }
        }

        .bar {
          padding: 10px 14px 14px; flex-shrink: 0;
          background: linear-gradient(180deg, rgba(2,5,18,0.90) 0%, rgba(1,3,12,0.96) 100%);
          backdrop-filter: blur(24px);
          border-top: 1px solid rgba(212,160,23,.09);
          box-shadow: 0 -1px 0 rgba(212,160,23,0.05);
        }
        .ibox {
          display: flex; align-items: flex-end; gap: 10px;
          background: rgba(255,255,255,.034);
          border: 1px solid rgba(212,160,23,.18);
          border-radius: 22px; padding: 10px 14px;
          transition: border-color .25s, box-shadow .25s;
        }
        .ibox-on {
          border-color: rgba(212,160,23,.50);
          box-shadow: 0 0 0 3px rgba(212,160,23,.07), 0 0 30px rgba(212,160,23,.12);
        }
        .ta {
          flex: 1; background: transparent; border: none; outline: none;
          color: #e8dab5; font-size: 14px; line-height: 1.65;
          font-family: 'Vazirmatn', sans-serif;
          text-align: right; direction: rtl; resize: none;
          max-height: 200px; overflow-y: auto; font-weight: 300;
        }
        .ta::placeholder { color: rgba(212,160,23,.26); }

        .sbtn {
          width: 38px; height: 38px; border-radius: 50%; border: none; flex-shrink: 0;
          background: rgba(255,255,255,.05); color: rgba(255,255,255,.20);
          display: flex; align-items: center; justify-content: center;
          cursor: not-allowed; transition: all .22s;
        }
        .sbtn-on {
          background: linear-gradient(135deg, #e8b520, #d4a017);
          color: #06080f; cursor: pointer;
          box-shadow: 0 0 18px rgba(212,160,23,.58), 0 0 36px rgba(212,160,23,.20);
        }
        .sbtn-on:hover { background: linear-gradient(135deg, #f5c830, #e8b520); }
        .sbtn-on:active { transform: scale(.90); transition: transform .09s; }

        /* ── Feedback ── */
        .fb-row {
          display: flex; justify-content: center;
          padding: 4px 0 8px;
          animation: pop .38s cubic-bezier(.22,.68,0,1.2) both;
        }
        .fb-card {
          background: rgba(6,12,34,.92);
          border: 1px solid rgba(212,160,23,.26);
          border-radius: 20px; padding: 16px 22px;
          display: flex; flex-direction: column; align-items: center; gap: 14px;
          backdrop-filter: blur(20px);
          box-shadow: 0 6px 32px rgba(0,0,0,.50), 0 0 40px rgba(212,160,23,0.04);
          max-width: 320px; width: 100%;
        }
        .fb-q { font-size: 13.5px; color: rgba(232,223,200,.85); text-align: center; direction: rtl; font-weight: 400; margin: 0; }
        .fb-emojis { display: flex; gap: 10px; }
        .fb-em {
          font-size: 26px; background: none; border: none; cursor: pointer;
          padding: 5px 7px; border-radius: 12px; transition: transform .15s, background .15s;
        }
        .fb-em:hover  { transform: scale(1.30); background: rgba(212,160,23,.10); }
        .fb-em:active { transform: scale(.90); }
        .fb-done {
          text-align: center; font-size: 13px;
          color: rgba(212,160,23,.58); padding: 8px 0 4px;
          direction: rtl; animation: pop .30s both;
        }

        /* ════════════════════════════════════════════
           NEW POST MODAL
        ════════════════════════════════════════════ */
        .modal-overlay {
          position: fixed; inset: 0; z-index: 50;
          display: flex; align-items: flex-end; justify-content: center;
          background: rgba(1,4,14,0.82); backdrop-filter: blur(12px);
          animation: obFade .22s ease both;
        }
        @keyframes obFade { from { opacity: 0; } to { opacity: 1; } }

        .modal-card {
          width: min(560px, 100%); max-height: 90dvh;
          background: linear-gradient(180deg, rgba(5,9,24,0.98) 0%, rgba(4,7,20,0.99) 100%);
          border: 1px solid rgba(212,160,23,0.24); border-bottom: none;
          border-radius: 26px 26px 0 0;
          padding: 22px 22px 36px;
          display: flex; flex-direction: column; gap: 16px;
          box-shadow: 0 -8px 60px rgba(0,0,0,.75), 0 0 80px rgba(212,160,23,0.04);
          animation: slideUp .32s cubic-bezier(.22,.68,0,1.15) both;
        }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: none; } }

        .modal-hdr { display: flex; align-items: center; justify-content: space-between; }
        .modal-title {
          font-size: 16px; font-weight: 800;
          background: linear-gradient(135deg, #f5d060, #d4a017);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .modal-close {
          width: 32px; height: 32px; border-radius: 50%; border: none;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.08);
          color: rgba(212,160,23,0.50);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; cursor: pointer; transition: all .22s;
        }
        .modal-close:hover {
          background: rgba(212,160,23,0.12);
          border-color: rgba(212,160,23,0.28);
          color: #d4a017;
        }

        .modal-ta {
          width: 100%; min-height: 136px; max-height: 320px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(212,160,23,0.18); border-radius: 18px;
          padding: 15px 17px;
          color: #e8dab5; font-size: 15px; line-height: 1.78; font-weight: 300;
          font-family: 'Vazirmatn', sans-serif;
          direction: rtl; text-align: right; outline: none; resize: none;
          transition: border-color .25s, box-shadow .25s;
        }
        .modal-ta:focus {
          border-color: rgba(212,160,23,0.46);
          box-shadow: 0 0 0 3px rgba(212,160,23,0.07);
        }
        .modal-ta::placeholder { color: rgba(212,160,23,0.22); }

        /* Image preview inside modal */
        .modal-img-preview {
          position: relative; border-radius: 14px; overflow: hidden;
          max-height: 220px; background: rgba(0,0,0,0.25);
          border: 1px solid rgba(212,160,23,0.18);
        }
        .modal-img-preview img {
          width: 100%; max-height: 220px; object-fit: cover; display: block;
        }
        .modal-img-remove {
          position: absolute; top: 8px; right: 8px;
          width: 28px; height: 28px; border-radius: 50%;
          background: rgba(0,0,0,0.70); border: none; color: #fff;
          font-size: 11px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background .18s;
        }
        .modal-img-remove:hover { background: rgba(0,0,0,0.90); }

        .modal-file-input { display: none; }
        .modal-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
        .modal-footer-left { display: flex; align-items: center; gap: 10px; }
        .modal-photo-btn {
          width: 34px; height: 34px; border-radius: 10px;
          background: rgba(212,160,23,0.07);
          border: 1px solid rgba(212,160,23,0.20);
          color: rgba(212,160,23,0.58);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all .20s; flex-shrink: 0;
        }
        .modal-photo-btn:hover, .modal-photo-btn.modal-photo-btn-on {
          background: rgba(212,160,23,0.16);
          border-color: rgba(212,160,23,0.42);
          color: #d4a017;
        }
        .char-count { font-size: 11.5px; color: rgba(212,160,23,0.32); }
        .char-warn  { color: rgba(255,140,40,0.70); }
        .modal-err  { font-size: 12px; color: rgba(255,100,100,0.72); flex: 1; text-align: center; min-width: 0; }

        .modal-submit {
          padding: 11px 24px; border: none; border-radius: 14px;
          background: rgba(212,160,23,0.12); color: rgba(212,160,23,0.38);
          font-family: 'Vazirmatn', sans-serif; font-size: 14px; font-weight: 700;
          cursor: not-allowed; transition: all .22s;
        }
        .modal-submit.modal-submit-on {
          background: linear-gradient(135deg, #e8b520, #d4a017);
          color: #06080f; cursor: pointer;
          box-shadow: 0 0 22px rgba(212,160,23,0.50);
        }
        .modal-submit.modal-submit-on:hover {
          background: linear-gradient(135deg, #f5c830, #e8b520);
          box-shadow: 0 0 28px rgba(212,160,23,0.65);
          transform: translateY(-1px);
        }

        /* ════════════════════════════════════════════
           CONSENT OVERLAY
        ════════════════════════════════════════════ */
        .cn-overlay {
          position: fixed; inset: 0; z-index: 110;
          display: flex; align-items: center; justify-content: center;
          background: rgba(1,4,14,0.90); backdrop-filter: blur(16px);
          animation: obFade .38s ease both;
        }
        .cn-card {
          width: min(350px, 90vw);
          background: linear-gradient(160deg, rgba(5,9,24,0.98) 0%, rgba(4,7,20,0.99) 100%);
          border: 1px solid rgba(212,160,23,0.26); border-radius: 26px;
          padding: 38px 28px 32px;
          display: flex; flex-direction: column; align-items: center; gap: 18px;
          box-shadow:
            0 16px 80px rgba(0,0,0,0.85),
            0 0 0 1px rgba(212,160,23,0.06),
            0 0 100px rgba(212,160,23,0.04);
          animation: obSlide .48s cubic-bezier(.22,.68,0,1.2) both;
        }
        .cn-logo {
          width: 56px; height: 56px; border-radius: 50%;
          background: radial-gradient(circle at 35% 32%, #fff8d6, #d4a017 44%, #7a5200 90%);
          display: flex; align-items: center; justify-content: center; font-size: 22px;
          box-shadow: 0 0 24px rgba(212,160,23,0.65), 0 0 50px rgba(212,160,23,0.28);
          animation: logo-pulse 3.5s ease-in-out infinite;
        }
        .cn-title {
          font-size: 32px; font-weight: 800; margin: 0;
          background: linear-gradient(135deg, #f5d060, #d4a017);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 0 20px rgba(212,160,23,0.40));
        }
        .cn-text  { font-size: 14px; color: rgba(232,223,200,0.80); text-align: center; line-height: 1.82; direction: rtl; font-weight: 300; }
        .cn-details {
          width: 100%;
          background: rgba(212,160,23,0.04);
          border: 1px solid rgba(212,160,23,0.13); border-radius: 14px; padding: 15px 17px;
          animation: obFade .25s ease both;
        }
        .cn-details p  { font-size: 12.5px; color: rgba(212,160,23,0.68); margin-bottom: 9px; direction: rtl; text-align: right; }
        .cn-details ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .cn-details li {
          font-size: 12px; color: rgba(232,223,200,0.58);
          direction: rtl; text-align: right; padding-right: 14px; position: relative; font-weight: 300;
        }
        .cn-details li::before { content: "•"; color: rgba(212,160,23,0.48); position: absolute; right: 0; }
        .cn-note  { font-size: 11px !important; color: rgba(212,160,23,0.36) !important; margin-top: 11px !important; margin-bottom: 0 !important; }
        .cn-btns  { width: 100%; display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }

        .cn-btn-accept {
          width: 100%; padding: 14px;
          background: linear-gradient(135deg, #e8b520, #d4a017);
          color: #06080f; border: none; border-radius: 16px;
          font-size: 15px; font-weight: 700; font-family: 'Vazirmatn', sans-serif; cursor: pointer;
          box-shadow: 0 4px 24px rgba(212,160,23,0.52); transition: all .22s;
        }
        .cn-btn-accept:hover  {
          background: linear-gradient(135deg, #f5c830, #e8b520);
          box-shadow: 0 6px 30px rgba(212,160,23,0.65);
          transform: translateY(-1px);
        }
        .cn-btn-accept:active { transform: scale(.97); }

        .cn-btn-more {
          width: 100%; padding: 11px;
          background: transparent; color: rgba(212,160,23,0.48);
          border: 1px solid rgba(212,160,23,0.16); border-radius: 13px;
          font-size: 13px; font-family: 'Vazirmatn', sans-serif; cursor: pointer;
          transition: all .22s;
        }
        .cn-btn-more:hover {
          color: rgba(212,160,23,0.78);
          border-color: rgba(212,160,23,0.36);
          background: rgba(212,160,23,0.04);
        }

        /* ════════════════════════════════════════════
           ONBOARDING OVERLAY
        ════════════════════════════════════════════ */
        .ob-overlay {
          position: fixed; inset: 0; z-index: 100;
          display: flex; align-items: center; justify-content: center;
          background: rgba(1,4,14,0.84); backdrop-filter: blur(12px);
          animation: obFade .38s ease both;
        }
        @keyframes obFade  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes obSlide { from { transform: translateY(30px); opacity:0; } to { transform: none; opacity:1; } }

        .ob-card {
          width: min(370px, 92vw);
          background: linear-gradient(160deg, rgba(5,9,24,0.98) 0%, rgba(4,7,20,0.99) 100%);
          border: 1px solid rgba(212,160,23,0.26); border-radius: 28px;
          padding: 40px 30px 36px;
          display: flex; flex-direction: column; align-items: center; gap: 16px;
          box-shadow:
            0 16px 80px rgba(0,0,0,0.80),
            0 0 0 1px rgba(212,160,23,0.06),
            0 0 100px rgba(212,160,23,0.04);
          animation: obSlide .48s cubic-bezier(.22,.68,0,1.2) both;
        }
        .ob-logo {
          width: 62px; height: 62px; border-radius: 50%;
          background: radial-gradient(circle at 35% 32%, #fff8d6, #d4a017 44%, #7a5200 90%);
          display: flex; align-items: center; justify-content: center; font-size: 24px;
          box-shadow: 0 0 24px rgba(212,160,23,0.68), 0 0 55px rgba(212,160,23,0.30);
          animation: logo-pulse 3.5s ease-in-out infinite;
        }
        .ob-title {
          font-size: 48px; font-weight: 800; margin: 0;
          background: linear-gradient(135deg, #f5d060 0%, #d4a017 50%, #b8860b 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 0 28px rgba(212,160,23,0.45));
        }
        .ob-sub    { font-size: 13px; color: rgba(212,160,23,0.48); text-align: center; line-height: 1.72; font-weight: 300; }
        .ob-sub-en { font-size: 11px; color: rgba(212,160,23,0.30); }
        .ob-fields { width: 100%; display: flex; flex-direction: column; gap: 16px; margin-top: 6px; }
        .ob-field  { display: flex; flex-direction: column; gap: 7px; }
        .ob-label    { font-size: 12.5px; color: rgba(212,160,23,0.62); text-align: right; direction: rtl; }
        .ob-label-en { color: rgba(212,160,23,0.38); }
        .ob-opt      { font-size: 11px; color: rgba(212,160,23,0.28); }

        .ob-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(212,160,23,0.20); border-radius: 14px;
          padding: 13px 15px;
          color: #e8dab5; font-size: 14px; font-weight: 300;
          font-family: 'Vazirmatn', sans-serif;
          text-align: right; direction: rtl; outline: none;
          transition: border-color .25s, box-shadow .25s;
        }
        .ob-input:focus {
          border-color: rgba(212,160,23,0.50);
          box-shadow: 0 0 0 3px rgba(212,160,23,0.08);
        }
        .ob-input::placeholder { color: rgba(212,160,23,0.20); }
        .ob-input[type=number]::-webkit-inner-spin-button { opacity: 0.3; }

        .ob-btn {
          width: 100%; margin-top: 10px; padding: 15px;
          background: linear-gradient(135deg, #e8b520, #d4a017);
          color: #06080f; border: none; border-radius: 16px;
          font-size: 15px; font-weight: 700; font-family: 'Vazirmatn', sans-serif; cursor: pointer;
          box-shadow: 0 4px 24px rgba(212,160,23,0.52); transition: all .22s;
          letter-spacing: .02em;
        }
        .ob-btn:hover  {
          background: linear-gradient(135deg, #f5c830, #e8b520);
          box-shadow: 0 6px 30px rgba(212,160,23,0.65);
          transform: translateY(-1px);
        }
        .ob-btn:active { transform: scale(.97); }

        @media (max-width: 480px) {
          .ig-logo { font-size: 24px; }
          .story-av { width: 70px; height: 70px; }
          .post-content { font-size: 14.5px; }
        }

        /* ════════════════════════════════════════════
           LIVE STREAMS SECTION
        ════════════════════════════════════════════ */
        .live-section {
          flex-shrink: 0;
          padding: 14px 0 10px;
          background: rgba(2,7,22,0.55);
          border-bottom: 1px solid rgba(212,160,23,0.06);
        }
        .live-title {
          display: flex; align-items: center; gap: 8px;
          padding: 0 18px 11px;
          font-size: 12.5px; font-weight: 600;
          color: rgba(212,160,23,0.65);
          direction: rtl;
        }
        .live-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
          background: #e53e3e;
          box-shadow: 0 0 8px rgba(229,62,62,0.80);
          animation: live-blink 1.4s ease-in-out infinite;
        }
        @keyframes live-blink {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.30; }
        }
        .live-row {
          display: flex; gap: 12px;
          padding: 0 18px 4px;
          overflow-x: auto; scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .live-row::-webkit-scrollbar { display: none; }

        .live-card {
          flex-shrink: 0; width: 232px;
          border-radius: 16px; overflow: hidden;
          background: rgba(7,11,27,0.90);
          border: 1px solid rgba(212,160,23,0.16);
          box-shadow: 0 4px 20px rgba(0,0,0,0.50);
          transition: box-shadow .25s, transform .25s;
        }
        .live-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.60), 0 0 0 1px rgba(212,160,23,0.26);
        }

        .live-thumb {
          position: relative; width: 100%; aspect-ratio: 16/9;
          border: none; padding: 0; cursor: pointer; display: block;
          background: rgba(0,0,0,0.50); overflow: hidden;
        }
        .live-thumb-img {
          width: 100%; height: 100%; object-fit: cover; display: block;
          transition: transform .35s ease;
        }
        .live-thumb:hover .live-thumb-img { transform: scale(1.04); }
        .live-play {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.28); color: #fff;
          transition: background .22s;
        }
        .live-thumb:hover .live-play { background: rgba(0,0,0,0.44); }
        .live-play svg { filter: drop-shadow(0 0 8px rgba(255,255,255,0.55)); }
        .live-badge {
          position: absolute; top: 8px; left: 8px;
          background: #e53e3e; color: #fff;
          font-size: 10px; font-weight: 700;
          padding: 2px 8px; border-radius: 6px;
          box-shadow: 0 0 10px rgba(229,62,62,0.55);
          letter-spacing: 0.03em;
        }
        .live-iframe {
          width: 100%; aspect-ratio: 16/9;
          border: none; display: block;
        }
        .live-card-info {
          padding: 10px 13px 12px; direction: rtl;
        }
        .live-card-name {
          font-size: 13px; font-weight: 700;
          color: rgba(232,215,160,0.88); margin-bottom: 3px;
        }
        .live-card-loc {
          font-size: 11px; color: rgba(212,160,23,0.46); font-weight: 300;
        }

        /* ── Quran recitation toggle ── */
        .qrn-btn { flex-shrink: 0; }
        .qrn-on {
          background: rgba(212,160,23,0.18) !important;
          border-color: rgba(212,160,23,0.48) !important;
          color: #d4a017 !important;
          box-shadow: 0 0 14px rgba(212,160,23,0.40), 0 0 30px rgba(212,160,23,0.14) !important;
        }
        .qrn-on svg { animation: qrn-wave 2s ease-in-out infinite; }
        @keyframes qrn-wave {
          0%, 100% { opacity: 0.65; transform: scale(1); }
          50%       { opacity: 1;    transform: scale(1.12); }
        }
      `}</style>
    </>
  );
}
