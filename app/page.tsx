"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

/* ─── Types ───────────────────────────────────────── */
interface Post {
  id: string; user_id: string; author_name: string;
  content: string; created_at: string;
  ameen_count: number; comment_count: number; i_said_ameen: boolean;
}
interface Comment {
  id: string; user_id: string; author_name: string;
  content: string; created_at: string;
}
interface Message { role: "user" | "assistant"; content: string; id: string; }

/* ─── Stories (static avatars) ────────────────────── */
const STORIES = [
  { id: "ai", name: "منیر", isAI: true },
];

/* ─── Helpers ─────────────────────────────────────── */
function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return "همین الان";
  if (diff < 3600)  return `${Math.floor(diff / 60)} دقیقه پیش`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ساعت پیش`;
  return `${Math.floor(diff / 86400)} روز پیش`;
}

/* ─── Comment Section ─────────────────────────────── */
function CommentSection({
  postId, userId, initialCount, onCountChange,
}: { postId: string; userId: string | null; initialCount: number; onCountChange: (d: number) => void; }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loaded,   setLoaded]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [text,     setText]     = useState("");
  const [sending,  setSending]  = useState(false);
  const [error,    setError]    = useState("");

  const load = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/posts/${postId}/comments`);
      const data = await res.json();
      setComments(data.comments ?? []);
      setLoaded(true);
    } finally { setLoading(false); }
  }, [postId, loaded]);

  useEffect(() => { load(); }, [load]);

  const submit = useCallback(async () => {
    if (!text.trim() || sending || !userId) return;
    setSending(true); setError("");
    try {
      const res  = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, content: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "خطا"); return; }
      setComments(p => [...p, data.comment]);
      onCountChange(1); setText("");
    } finally { setSending(false); }
  }, [text, sending, userId, postId, onCountChange]);

  return (
    <div className="cmt-wrap">
      {loading && <p className="cmt-hint">در حال بارگذاری...</p>}
      {loaded && comments.length === 0 && <p className="cmt-hint">اولین نظر رو بنویس 🌙</p>}
      {comments.map(c => (
        <div key={c.id} className="cmt-row">
          <div className="cmt-av">{c.author_name.charAt(0) || "م"}</div>
          <div className="cmt-body">
            <span className="cmt-name">{c.author_name}</span>
            <span className="cmt-time">{timeAgo(c.created_at)}</span>
            <p className="cmt-txt">{c.content}</p>
          </div>
        </div>
      ))}
      {userId ? (
        <div className="cmt-input-row">
          <textarea
            className="cmt-ta"
            placeholder="نظرت رو بنویس..."
            value={text} maxLength={300} rows={1}
            onChange={e => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          />
          <button className={`cmt-send${text.trim() && !sending ? " cmt-send-on" : ""}`} onClick={submit} disabled={!text.trim() || sending}>
            {sending ? "..." : "ارسال"}
          </button>
        </div>
      ) : (
        <p className="cmt-hint-login">برای نظر دادن وارد شو 🔐</p>
      )}
      {error && <p className="cmt-err">{error}</p>}
    </div>
  );
}

/* ─── Post Card ───────────────────────────────────── */
function PostCard({ post: initial, userId }: { post: Post; userId: string | null; }) {
  const [post,         setPost]         = useState(initial);
  const [ameenAnim,    setAmeenAnim]    = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(initial.comment_count);

  const handleAmeen = useCallback(async () => {
    if (!userId) return;
    const was = post.i_said_ameen;
    setPost(p => ({ ...p, i_said_ameen: !was, ameen_count: was ? Math.max(0, p.ameen_count - 1) : p.ameen_count + 1 }));
    if (!was) { setAmeenAnim(true); setTimeout(() => setAmeenAnim(false), 600); }
    try {
      const res  = await fetch(`/api/posts/${post.id}/ameen`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (res.ok) setPost(p => ({ ...p, ameen_count: data.ameen_count, i_said_ameen: data.i_said_ameen }));
      else        setPost(p => ({ ...p, i_said_ameen: was, ameen_count: was ? p.ameen_count + 1 : Math.max(0, p.ameen_count - 1) }));
    } catch { setPost(p => ({ ...p, i_said_ameen: was })); }
  }, [userId, post]);

  return (
    <article className="post-card">
      <div className="post-hdr">
        <div className="post-av">{post.author_name.charAt(0) || "م"}</div>
        <div className="post-meta">
          <span className="post-name">{post.author_name}</span>
          <span className="post-time">{timeAgo(post.created_at)}</span>
        </div>
      </div>
      <p className="post-content">{post.content}</p>
      <div className="post-actions">
        <button
          className={`ameen-btn${post.i_said_ameen ? " ameen-on" : ""}${ameenAnim ? " ameen-pop" : ""}${!userId ? " ameen-disabled" : ""}`}
          onClick={handleAmeen}
          title={userId ? undefined : "برای آمین گفتن وارد شو"}
        >
          <span className="ameen-icon">🤲</span>
          <span className="ameen-label">آمین</span>
          {post.ameen_count > 0 && <span className="ameen-count">{post.ameen_count}</span>}
        </button>
        <button className={`cmt-btn${showComments ? " cmt-btn-on" : ""}`} onClick={() => setShowComments(p => !p)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>{commentCount > 0 ? commentCount : "نظر"}</span>
        </button>
      </div>
      {showComments && (
        <CommentSection postId={post.id} userId={userId} initialCount={commentCount} onCountChange={d => setCommentCount(c => c + d)} />
      )}
    </article>
  );
}

/* ─── New Post Modal ──────────────────────────────── */
function NewPostModal({
  userId, authorName, onClose, onCreated,
}: { userId: string; authorName: string; onClose: () => void; onCreated: (p: Post) => void; }) {
  const [text,    setText]    = useState("");
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState("");
  const MAX = 500;

  const submit = useCallback(async () => {
    if (!text.trim() || sending) return;
    setSending(true); setError("");
    try {
      const res  = await fetch("/api/posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, content: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(res.status === 422 ? "محتوای پست مناسب نیست. لطفاً ویرایش کن." : (data.error ?? "خطا در ارسال"));
        return;
      }
      onCreated({ ...data.post, author_name: authorName, comment_count: 0, i_said_ameen: false });
      onClose();
    } finally { setSending(false); }
  }, [text, sending, userId, authorName, onCreated, onClose]);

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <div className="modal-hdr">
          <span className="modal-title">پست جدید ✦</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <textarea className="modal-ta" placeholder="افکار معنوی‌ات رو به اشتراک بذار..."
          value={text} maxLength={MAX} autoFocus onChange={e => setText(e.target.value)} />
        <div className="modal-footer">
          <span className={`char-count${text.length > MAX * 0.9 ? " char-warn" : ""}`}>{text.length}/{MAX}</span>
          {error && <span className="modal-err">{error}</span>}
          <button className={`modal-submit${text.trim() && !sending ? " modal-submit-on" : ""}`}
            onClick={submit} disabled={!text.trim() || sending}>
            {sending ? "در حال ارسال..." : "انتشار"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Constants ───────────────────────────────────── */
const OPENING = "اینجام و دوست دارم بشنوم 🌙";

/* ─── Main App ────────────────────────────────────── */
export default function App() {
  const [screen, setScreen] = useState<"home" | "chat">("home");

  /* chat */
  const [messages,          setMessages]          = useState<Message[]>([]);
  const [input,             setInput]             = useState("");
  const [isLoading,         setIsLoading]         = useState(false);
  const [focused,           setFocused]           = useState(false);
  const [showFeedback,      setShowFeedback]      = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

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
  const [showConsent,      setShowConsent]      = useState(false);
  const [consentExpanded,  setConsentExpanded]  = useState(false);
  const [showOnboarding,   setShowOnboarding]   = useState(false);
  const [onboardingName,   setOnboardingName]   = useState("");
  const [onboardingAge,    setOnboardingAge]    = useState("");

  const router       = useRouter();
  const endRef       = useRef<HTMLDivElement>(null);
  const taRef        = useRef<HTMLTextAreaElement>(null);
  const sessionStart = useRef(new Date().toISOString());
  const msgCount     = useRef(0);
  const feedbackShownRef = useRef(false);
  const feedInitRef  = useRef(false);

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

  /* ── Chat opening message ────────────────────────── */
  useEffect(() => {
    if (screen === "chat" && messages.length === 0)
      setTimeout(() => setMessages([{ role: "assistant", content: OPENING, id: "0" }]), 600);
  }, [screen]);

  /* ── Scroll to bottom in chat ────────────────────── */
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);

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

  /* ── Chat handlers ───────────────────────────────── */
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
    setIsLoading(true);
    msgCount.current++;
    try {
      const res  = await fetch("/api/chat", {
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
  }, [input, isLoading, messages, userName]);

  const onKey = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }, [send]);

  /* ── Render ──────────────────────────────────────── */
  return (
    <>
      <div className="bg" />

      <div className="app">

        {/* ══ HOME SCREEN (Instagram-style) ══ */}
        {screen === "home" && (
          <div className="screen home">

            {/* Header — logo right, bell left (RTL) */}
            <header className="ig-hdr">
              <span className="ig-logo">منیر</span>
              <button className="ibtn nbtn" aria-label="اعلان‌ها">
                <svg width="20" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                <span className="ndot" />
              </button>
            </header>

            {/* Stories bar */}
            <div className="stories-bar">
              {STORIES.map(s => (
                <button
                  key={s.id}
                  className="story"
                  onClick={() => s.isAI && setScreen("chat")}
                >
                  <div className={`story-av${s.isAI ? " story-av-ai" : ""}`}>
                    <span>{s.isAI ? "✦" : s.name.charAt(0)}</span>
                  </div>
                  <span className="story-name">{s.name}</span>
                </button>
              ))}
            </div>

            {/* Feed */}
            <div className="feed-scroll">
              {loadingFeed && (
                <div className="center-msg">
                  <div className="spinner" />
                  <p className="hint">در حال بارگذاری...</p>
                </div>
              )}
              {!loadingFeed && posts.length === 0 && (
                <div className="center-msg">
                  <div className="empty-icon">🌙</div>
                  <p className="hint">هنوز پستی نیست. اولین نفر باش!</p>
                  {userId && (
                    <button className="btn-gold" onClick={() => setShowNew(true)}>اولین پست رو بنویس ✦</button>
                  )}
                </div>
              )}
              {posts.map(p => <PostCard key={p.id} post={p} userId={userId} />)}
              {nextCursor && !loadingMore && (
                <button className="load-more" onClick={() => loadFeed(nextCursor)}>پست‌های بیشتر</button>
              )}
              {loadingMore && (
                <div className="load-more-spin"><div className="spinner-sm" /></div>
              )}
              <div style={{ height: 16 }} />
            </div>

            {/* Bottom tab bar: Home | Search | Post+ | Prayer | Profile */}
            <nav className="ig-bnav">
              {/* HOME — active */}
              <button className="ni ni-on">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                </svg>
                <span>خانه</span>
              </button>

              {/* SEARCH */}
              <button className="ni">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <span>جستجو</span>
              </button>

              {/* POST (+) */}
              <button className="ni ni-post" onClick={() => userId ? setShowNew(true) : router.push("/login")}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>

              {/* PRAYER */}
              <button className="ni" onClick={() => router.push("/prayer")}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span>نماز</span>
              </button>

              {/* PROFILE */}
              <button className="ni" onClick={() => router.push("/profile")}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <span>پروفایل</span>
              </button>
            </nav>
          </div>
        )}

        {/* ══ CHAT SCREEN ══ */}
        {screen === "chat" && (
          <div className="screen chat">
            <header className="chdr">
              <button className="ibtn" onClick={() => setScreen("home")}>
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
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
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
        html, body { height: 100%; background: #020d1f; overflow: hidden; }

        /* ── Galaxy background ── */
        .bg {
          position: fixed; inset: 0; z-index: 0;
          background-image: url('https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1080&q=85');
          background-size: cover; background-position: center;
        }
        .bg::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(180deg,
            rgba(2,8,22,0.62) 0%,
            rgba(4,10,24,0.55) 25%,
            rgba(5,3,1,0.68) 70%,
            rgba(4,2,0,0.95) 100%);
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

        /* ────────────────────────────────────────────
           INSTAGRAM-STYLE HOME SCREEN
        ─────────────────────────────────────────── */

        /* Header */
        .ig-hdr {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 18px 12px; flex-shrink: 0;
          background: rgba(2,8,26,0.88);
          backdrop-filter: blur(24px) saturate(160%);
          border-bottom: 1px solid rgba(212,160,23,0.12);
          box-shadow: 0 4px 30px rgba(0,0,0,0.40);
        }
        .ig-logo {
          font-size: 26px; font-weight: 700; color: #d4a017;
          text-shadow: 0 0 22px rgba(212,160,23,0.60), 0 0 50px rgba(212,160,23,0.25);
          letter-spacing: -0.01em; line-height: 1;
          font-family: 'Vazirmatn', sans-serif;
        }
        .ibtn {
          width: 40px; height: 40px; border-radius: 50%; border: none;
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(14px);
          color: rgba(212,160,23,0.82);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background .2s; position: relative;
        }
        .ibtn:hover { background: rgba(255,255,255,0.14); }
        .nbtn { position: relative; }
        .ndot {
          position: absolute; top: 9px; left: 9px;
          width: 7px; height: 7px; border-radius: 50%;
          background: #d4a017;
          box-shadow: 0 0 6px rgba(212,160,23,0.90);
        }

        /* Stories */
        .stories-bar {
          display: flex; gap: 12px;
          padding: 12px 16px 10px;
          overflow-x: auto; flex-shrink: 0;
          background: rgba(2,8,26,0.55);
          border-bottom: 1px solid rgba(212,160,23,0.07);
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .stories-bar::-webkit-scrollbar { display: none; }
        .story {
          display: flex; flex-direction: column; align-items: center; gap: 5px;
          background: none; border: none; cursor: pointer; flex-shrink: 0;
          padding: 2px;
        }
        .story-av {
          width: 60px; height: 60px; border-radius: 50%;
          border: 2px solid rgba(212,160,23,0.35);
          background: rgba(8,12,30,0.90);
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; font-weight: 700; color: #e8d5a0;
          transition: border-color .2s, box-shadow .2s;
        }
        .story-av-ai {
          background: radial-gradient(circle at 36% 36%, #fff5d0, #d4a017 42%, #7a5200 88%);
          border-color: #d4a017;
          color: #06080f;
          animation: lp 3.2s ease-in-out infinite;
        }
        .story:hover .story-av {
          border-color: rgba(212,160,23,0.80);
          box-shadow: 0 0 14px rgba(212,160,23,0.40);
        }
        .story-name {
          font-size: 11px; color: rgba(212,160,23,0.60);
          white-space: nowrap; font-family: 'Vazirmatn', sans-serif;
        }
        @keyframes lp {
          0%,100% { box-shadow: 0 0 14px rgba(212,160,23,0.55), 0 0 28px rgba(212,160,23,0.28); }
          50%      { box-shadow: 0 0 26px rgba(212,160,23,0.85), 0 0 52px rgba(212,160,23,0.45); }
        }

        /* Feed scroll area */
        .feed-scroll {
          flex: 1; overflow-y: auto; min-height: 0;
          padding: 12px 14px 8px;
          display: flex; flex-direction: column; gap: 14px;
        }
        .feed-scroll::-webkit-scrollbar { width: 3px; }
        .feed-scroll::-webkit-scrollbar-thumb { background: rgba(212,160,23,0.20); border-radius: 2px; }

        /* Center empty / loading state */
        .center-msg {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 14px; padding: 60px 20px; text-align: center;
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
        .btn-gold {
          padding: 12px 22px; border: none; border-radius: 14px;
          background: #d4a017; color: #06080f;
          font-size: 14px; font-weight: 700;
          font-family: 'Vazirmatn', sans-serif; cursor: pointer;
          box-shadow: 0 0 20px rgba(212,160,23,0.45); transition: background .2s;
        }
        .btn-gold:hover { background: #e8b520; }

        /* Bottom tab bar */
        .ig-bnav {
          display: flex; align-items: center; justify-content: space-around;
          padding: 8px 4px 20px; flex-shrink: 0;
          background: rgba(2,4,16,0.96);
          backdrop-filter: blur(28px) saturate(150%);
          border-top: 1px solid rgba(212,160,23,0.13);
          box-shadow: 0 -4px 28px rgba(0,0,0,0.50);
        }
        .ni {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          border: none; background: none; cursor: pointer;
          color: rgba(212,160,23,0.32);
          font-family: 'Vazirmatn', sans-serif;
          font-size: 10px; font-weight: 300;
          padding: 4px 10px; transition: color .2s; min-width: 48px;
        }
        .ni:hover { color: rgba(212,160,23,0.62); }
        .ni-on { color: #d4a017; }
        .ni-on svg { filter: drop-shadow(0 0 5px rgba(212,160,23,0.55)); }

        /* Post (+) tab — square with gold border */
        .ni-post {
          width: 44px; height: 44px;
          background: rgba(212,160,23,0.12);
          border: 1.5px solid rgba(212,160,23,0.38);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          color: #d4a017;
          padding: 0; min-width: 44px;
          transition: all .2s;
        }
        .ni-post:hover {
          background: rgba(212,160,23,0.24);
          border-color: rgba(212,160,23,0.70);
          box-shadow: 0 0 16px rgba(212,160,23,0.30);
        }

        /* ────────────────────────────────────────────
           POST CARDS (shared with /feed)
        ─────────────────────────────────────────── */
        .post-card {
          background: rgba(8,12,28,0.84);
          border: 1px solid rgba(212,160,23,0.15);
          border-radius: 20px; overflow: hidden;
          backdrop-filter: blur(18px);
          box-shadow: 0 4px 28px rgba(0,0,0,0.45);
          animation: fadeUp .35s ease both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: none; }
        }
        .post-hdr {
          display: flex; align-items: center; gap: 11px;
          padding: 14px 16px 0;
        }
        .post-av {
          width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
          background: radial-gradient(circle at 36% 36%, #fff5d0, #d4a017 42%, #7a5200 88%);
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; font-weight: 700; color: #06080f;
          box-shadow: 0 0 10px rgba(212,160,23,0.35);
        }
        .post-meta { display: flex; flex-direction: column; gap: 2px; }
        .post-name { font-size: 13.5px; font-weight: 600; color: #e8d5a0; }
        .post-time { font-size: 11px; color: rgba(212,160,23,0.40); }
        .post-content {
          padding: 12px 16px 14px;
          font-size: 14.5px; line-height: 1.85;
          color: rgba(232,223,200,0.90);
          white-space: pre-wrap; word-break: break-word;
        }
        .post-actions {
          display: flex; align-items: center; gap: 10px;
          padding: 11px 16px 14px;
          border-top: 1px solid rgba(212,160,23,0.07);
        }
        .ameen-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 14px; border: 1px solid rgba(212,160,23,0.22);
          border-radius: 20px;
          background: rgba(212,160,23,0.06);
          color: rgba(212,160,23,0.65);
          font-family: 'Vazirmatn', sans-serif; font-size: 13px;
          cursor: pointer; transition: all .2s;
        }
        .ameen-btn:hover:not(.ameen-disabled) {
          background: rgba(212,160,23,0.14);
          border-color: rgba(212,160,23,0.45); color: #d4a017;
        }
        .ameen-btn.ameen-on {
          background: rgba(212,160,23,0.18);
          border-color: rgba(212,160,23,0.55); color: #d4a017;
          box-shadow: 0 0 14px rgba(212,160,23,0.22);
        }
        .ameen-btn.ameen-disabled { cursor: default; opacity: 0.55; }
        .ameen-btn.ameen-pop { animation: ameenPop .5s cubic-bezier(.22,.68,0,1.5) both; }
        @keyframes ameenPop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.22); }
          70%  { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        .ameen-icon  { font-size: 16px; }
        .ameen-label { font-weight: 500; }
        .ameen-count {
          background: rgba(212,160,23,0.18); border-radius: 10px;
          padding: 1px 7px; font-size: 12px; font-weight: 600;
        }
        .cmt-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 13px; border: 1px solid rgba(212,160,23,0.14);
          border-radius: 20px; background: transparent;
          color: rgba(212,160,23,0.45);
          font-family: 'Vazirmatn', sans-serif; font-size: 12.5px;
          cursor: pointer; transition: all .2s;
        }
        .cmt-btn:hover, .cmt-btn.cmt-btn-on {
          background: rgba(212,160,23,0.08);
          border-color: rgba(212,160,23,0.30);
          color: rgba(212,160,23,0.80);
        }

        /* Comment section */
        .cmt-wrap {
          border-top: 1px solid rgba(212,160,23,0.08);
          padding: 12px 16px 14px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .cmt-hint       { font-size: 12.5px; color: rgba(212,160,23,0.38); text-align: center; padding: 4px 0; }
        .cmt-hint-login { font-size: 12.5px; color: rgba(212,160,23,0.35); text-align: center; padding: 4px 0; }
        .cmt-err        { font-size: 12px; color: rgba(255,100,100,0.75); text-align: center; }
        .cmt-row        { display: flex; align-items: flex-start; gap: 9px; animation: fadeUp .25s ease both; }
        .cmt-av {
          width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
          background: radial-gradient(circle at 36% 36%, #fff5d0, #d4a017 42%, #7a5200 88%);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; color: #06080f;
          box-shadow: 0 0 6px rgba(212,160,23,0.28);
        }
        .cmt-body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .cmt-name { font-size: 12px; font-weight: 600; color: rgba(212,160,23,0.72); }
        .cmt-time { font-size: 10.5px; color: rgba(212,160,23,0.30); margin-right: 6px; }
        .cmt-txt  { font-size: 13px; line-height: 1.7; color: rgba(232,223,200,0.80); word-break: break-word; }
        .cmt-input-row { display: flex; align-items: flex-end; gap: 8px; margin-top: 2px; }
        .cmt-ta {
          flex: 1; background: rgba(255,255,255,0.04);
          border: 1px solid rgba(212,160,23,0.18); border-radius: 12px; padding: 9px 12px;
          color: #e8dab5; font-size: 13px; line-height: 1.55;
          font-family: 'Vazirmatn', sans-serif;
          direction: rtl; text-align: right; outline: none; resize: none;
          transition: border-color .2s;
        }
        .cmt-ta:focus { border-color: rgba(212,160,23,0.42); }
        .cmt-ta::placeholder { color: rgba(212,160,23,0.25); }
        .cmt-send {
          padding: 8px 13px; border: none; border-radius: 10px;
          background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.22);
          font-family: 'Vazirmatn', sans-serif; font-size: 12.5px;
          cursor: not-allowed; transition: all .2s; white-space: nowrap;
        }
        .cmt-send.cmt-send-on {
          background: #d4a017; color: #06080f; cursor: pointer;
          box-shadow: 0 0 12px rgba(212,160,23,0.40);
        }
        .cmt-send.cmt-send-on:hover { background: #e8b520; }

        /* Load more */
        .load-more {
          display: block; width: 100%; padding: 12px;
          background: rgba(212,160,23,0.06);
          border: 1px solid rgba(212,160,23,0.18);
          border-radius: 14px; color: rgba(212,160,23,0.65);
          font-family: 'Vazirmatn', sans-serif; font-size: 13.5px;
          cursor: pointer; transition: all .2s; text-align: center;
        }
        .load-more:hover { background: rgba(212,160,23,0.12); color: #d4a017; }
        .load-more-spin { display: flex; justify-content: center; padding: 12px; }
        .spinner-sm {
          width: 22px; height: 22px; border-radius: 50%;
          border: 2px solid rgba(212,160,23,0.18);
          border-top-color: rgba(212,160,23,0.60);
          animation: spin 0.9s linear infinite;
        }

        /* ────────────────────────────────────────────
           CHAT SCREEN
        ─────────────────────────────────────────── */
        .chdr {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; flex-shrink: 0;
          background: rgba(2,8,26,0.82);
          backdrop-filter: blur(22px) saturate(170%);
          border-bottom: 1px solid rgba(212,160,23,0.14);
          box-shadow: 0 8px 40px rgba(0,0,0,0.45);
        }
        .chdr-mid { display: flex; align-items: center; gap: 11px; }
        .logo {
          width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
          background: radial-gradient(circle at 36% 36%, #fff5d0, #d4a017 42%, #7a5200 88%);
          display: flex; align-items: center; justify-content: center; font-size: 18px;
          animation: lp 3.2s ease-in-out infinite;
        }
        .hname  { color: #d4a017; font-weight: 700; font-size: 17px; }
        .htag   { color: rgba(212,160,23,0.46); font-size: 11px; font-weight: 300; margin-top: 1px; }
        .hverse { color: rgba(150,185,255,0.34); font-size: 11px; font-weight: 300; letter-spacing: .05em; }

        .msgs {
          flex: 1; overflow-y: auto; min-height: 0;
          padding: 16px 13px; display: flex; flex-direction: column; gap: 12px;
        }
        .msgs::-webkit-scrollbar { width: 3px; }
        .msgs::-webkit-scrollbar-thumb { background: rgba(212,160,23,0.20); border-radius: 2px; }

        .row { display: flex; align-items: flex-end; gap: 8px; }
        .row-user      { flex-direction: row-reverse; }
        .row-assistant { flex-direction: row; }
        .av {
          width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
          background: radial-gradient(circle at 36% 36%, #fff5d0, #d4a017 42%, #7a5200 88%);
          display: flex; align-items: center; justify-content: center; font-size: 12px;
          box-shadow: 0 0 10px rgba(212,160,23,0.40);
          animation: lp 3.2s ease-in-out infinite;
        }
        .bubble {
          max-width: min(74%, 420px); padding: 11px 15px;
          font-size: 14px; line-height: 1.82; text-align: right;
          backdrop-filter: blur(16px);
          animation: pop .28s cubic-bezier(.22,.68,0,1.2) both;
        }
        @keyframes pop {
          from { opacity: 0; transform: translateY(8px) scale(.97); }
          to   { opacity: 1; transform: none; }
        }
        .bubble-user {
          border-radius: 20px 4px 20px 20px; border: 1px solid transparent;
          background: linear-gradient(rgba(10,26,58,.80),rgba(10,26,58,.80)) padding-box,
                      linear-gradient(135deg,rgba(110,165,255,.50),rgba(50,90,210,.18)) border-box;
          color: #cdddf8; box-shadow: 0 4px 24px rgba(0,8,60,.35);
        }
        .bubble-assistant {
          border-radius: 4px 20px 20px 20px; border: 1px solid transparent;
          background: linear-gradient(rgba(7,14,36,.84),rgba(7,14,36,.84)) padding-box,
                      linear-gradient(135deg,rgba(212,160,23,.36),rgba(170,120,8,.13)) border-box;
          color: #eddcaa; box-shadow: 0 4px 24px rgba(0,0,0,.40);
        }
        .bubble-dots { display: flex; gap: 6px; align-items: center; padding: 13px 17px; }
        .d {
          width: 7px; height: 7px; border-radius: 50%; background: #d4a017;
          box-shadow: 0 0 7px rgba(212,160,23,.55);
          animation: db 1.4s ease-in-out infinite;
        }
        @keyframes db {
          0%,60%,100% { transform: translateY(0); opacity: .4; }
          30%          { transform: translateY(-8px); opacity: 1; }
        }

        .bar {
          padding: 10px 13px; flex-shrink: 0;
          background: rgba(2,5,18,.92); backdrop-filter: blur(22px);
          border-top: 1px solid rgba(212,160,23,.10);
        }
        .ibox {
          display: flex; align-items: flex-end; gap: 10px;
          background: rgba(255,255,255,.033);
          border: 1px solid rgba(212,160,23,.20);
          border-radius: 18px; padding: 9px 12px;
          transition: border-color .25s, box-shadow .25s;
        }
        .ibox-on {
          border-color: rgba(212,160,23,.55);
          box-shadow: 0 0 0 2px rgba(212,160,23,.08), 0 0 28px rgba(212,160,23,.13);
        }
        .ta {
          flex: 1; background: transparent; border: none; outline: none;
          color: #e8dab5; font-size: 14px; line-height: 1.65;
          font-family: 'Vazirmatn', sans-serif;
          text-align: right; direction: rtl; resize: none; max-height: 200px; overflow-y: auto;
        }
        .ta::placeholder { color: rgba(212,160,23,.28); }
        .sbtn {
          width: 36px; height: 36px; border-radius: 12px; border: none; flex-shrink: 0;
          background: rgba(255,255,255,.05); color: rgba(255,255,255,.22);
          display: flex; align-items: center; justify-content: center;
          cursor: not-allowed; transition: all .22s;
        }
        .sbtn-on { background: #d4a017; color: #06080f; cursor: pointer; box-shadow: 0 0 16px rgba(212,160,23,.55); }
        .sbtn-on:hover { background: #e8b520; }
        .sbtn-on:active { transform: scale(.92); transition: transform .09s; }

        /* Feedback */
        .fb-row {
          display: flex; justify-content: center;
          padding: 4px 0 8px;
          animation: pop .35s cubic-bezier(.22,.68,0,1.2) both;
        }
        .fb-card {
          background: rgba(7,14,36,.90);
          border: 1px solid rgba(212,160,23,.28);
          border-radius: 18px; padding: 14px 20px;
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          backdrop-filter: blur(16px);
          box-shadow: 0 4px 28px rgba(0,0,0,.45);
          max-width: 320px; width: 100%;
        }
        .fb-q { font-size: 13.5px; color: rgba(232,223,200,.85); text-align: center; direction: rtl; font-weight: 400; margin: 0; }
        .fb-emojis { display: flex; gap: 10px; }
        .fb-em {
          font-size: 26px; background: none; border: none; cursor: pointer;
          padding: 4px 6px; border-radius: 10px; transition: transform .15s, background .15s;
        }
        .fb-em:hover  { transform: scale(1.28); background: rgba(212,160,23,.10); }
        .fb-em:active { transform: scale(.92); }
        .fb-done {
          text-align: center; font-size: 13px;
          color: rgba(212,160,23,.60); padding: 8px 0 4px;
          direction: rtl; animation: pop .28s both;
        }

        /* ────────────────────────────────────────────
           NEW POST MODAL
        ─────────────────────────────────────────── */
        .modal-overlay {
          position: fixed; inset: 0; z-index: 50;
          display: flex; align-items: flex-end; justify-content: center;
          background: rgba(2,6,18,0.80); backdrop-filter: blur(10px);
          animation: obFade .2s ease both;
        }
        @keyframes obFade { from { opacity: 0; } to { opacity: 1; } }
        .modal-card {
          width: min(560px, 100%); max-height: 90dvh;
          background: rgba(6,10,26,0.97);
          border: 1px solid rgba(212,160,23,0.25); border-bottom: none;
          border-radius: 24px 24px 0 0;
          padding: 20px 20px 32px;
          display: flex; flex-direction: column; gap: 14px;
          box-shadow: 0 -8px 50px rgba(0,0,0,0.70);
          animation: slideUp .3s cubic-bezier(.22,.68,0,1.15) both;
        }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: none; } }
        .modal-hdr { display: flex; align-items: center; justify-content: space-between; }
        .modal-title { font-size: 16px; font-weight: 700; color: #d4a017; }
        .modal-close {
          width: 32px; height: 32px; border-radius: 50%; border: none;
          background: rgba(255,255,255,0.07); color: rgba(212,160,23,0.55);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; cursor: pointer; transition: all .2s;
        }
        .modal-close:hover { background: rgba(255,255,255,0.12); color: #d4a017; }
        .modal-ta {
          width: 100%; min-height: 130px; max-height: 320px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(212,160,23,0.20); border-radius: 16px; padding: 14px 16px;
          color: #e8dab5; font-size: 15px; line-height: 1.75;
          font-family: 'Vazirmatn', sans-serif;
          direction: rtl; text-align: right; outline: none; resize: none;
          transition: border-color .25s;
        }
        .modal-ta:focus { border-color: rgba(212,160,23,0.50); }
        .modal-ta::placeholder { color: rgba(212,160,23,0.25); }
        .modal-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .char-count { font-size: 12px; color: rgba(212,160,23,0.35); }
        .char-warn  { color: rgba(255,140,40,0.70); }
        .modal-err  { font-size: 12.5px; color: rgba(255,100,100,0.75); flex: 1; text-align: center; }
        .modal-submit {
          padding: 10px 22px; border: none; border-radius: 12px;
          background: rgba(212,160,23,0.15); color: rgba(212,160,23,0.40);
          font-family: 'Vazirmatn', sans-serif; font-size: 14px; font-weight: 600;
          cursor: not-allowed; transition: all .2s;
        }
        .modal-submit.modal-submit-on {
          background: #d4a017; color: #06080f; cursor: pointer;
          box-shadow: 0 0 18px rgba(212,160,23,0.45);
        }
        .modal-submit.modal-submit-on:hover { background: #e8b520; }

        /* ────────────────────────────────────────────
           CONSENT OVERLAY
        ─────────────────────────────────────────── */
        .cn-overlay {
          position: fixed; inset: 0; z-index: 110;
          display: flex; align-items: center; justify-content: center;
          background: rgba(2,6,18,0.88); backdrop-filter: blur(14px);
          animation: obFade .35s ease both;
        }
        .cn-card {
          width: min(340px, 90vw);
          background: rgba(5,9,24,0.97);
          border: 1px solid rgba(212,160,23,0.28); border-radius: 24px;
          padding: 36px 26px 30px;
          display: flex; flex-direction: column; align-items: center; gap: 16px;
          box-shadow: 0 12px 70px rgba(0,0,0,0.82), 0 0 80px rgba(212,160,23,0.05);
          animation: obSlide .45s cubic-bezier(.22,.68,0,1.2) both;
        }
        .cn-logo {
          width: 52px; height: 52px; border-radius: 50%;
          background: radial-gradient(circle at 36% 36%, #fff5d0, #d4a017 42%, #7a5200 88%);
          display: flex; align-items: center; justify-content: center; font-size: 20px;
          box-shadow: 0 0 20px rgba(212,160,23,0.62), 0 0 44px rgba(212,160,23,0.26);
          animation: lp 3.2s ease-in-out infinite;
        }
        .cn-title { font-size: 30px; font-weight: 700; color: #d4a017; text-shadow: 0 0 28px rgba(212,160,23,0.50); margin: 0; }
        .cn-text  { font-size: 14px; color: rgba(232,223,200,0.82); text-align: center; line-height: 1.80; direction: rtl; }
        .cn-details {
          width: 100%;
          background: rgba(212,160,23,0.05);
          border: 1px solid rgba(212,160,23,0.15); border-radius: 12px; padding: 14px 16px;
          animation: obFade .25s ease both;
        }
        .cn-details p  { font-size: 12.5px; color: rgba(212,160,23,0.70); margin-bottom: 8px; direction: rtl; text-align: right; }
        .cn-details ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 7px; }
        .cn-details li { font-size: 12px; color: rgba(232,223,200,0.60); direction: rtl; text-align: right; padding-right: 12px; position: relative; }
        .cn-details li::before { content: "•"; color: rgba(212,160,23,0.50); position: absolute; right: 0; }
        .cn-note  { font-size: 11px !important; color: rgba(212,160,23,0.38) !important; margin-top: 10px !important; margin-bottom: 0 !important; }
        .cn-btns  { width: 100%; display: flex; flex-direction: column; gap: 10px; margin-top: 4px; }
        .cn-btn-accept {
          width: 100%; padding: 14px;
          background: #d4a017; color: #06080f; border: none; border-radius: 14px;
          font-size: 15px; font-weight: 700; font-family: 'Vazirmatn', sans-serif; cursor: pointer;
          box-shadow: 0 0 22px rgba(212,160,23,0.50); transition: background .2s, transform .1s;
        }
        .cn-btn-accept:hover  { background: #e8b520; }
        .cn-btn-accept:active { transform: scale(.97); }
        .cn-btn-more {
          width: 100%; padding: 10px;
          background: transparent; color: rgba(212,160,23,0.50);
          border: 1px solid rgba(212,160,23,0.18); border-radius: 12px;
          font-size: 13px; font-family: 'Vazirmatn', sans-serif; cursor: pointer;
          transition: color .2s, border-color .2s;
        }
        .cn-btn-more:hover { color: rgba(212,160,23,0.80); border-color: rgba(212,160,23,0.38); }

        /* ────────────────────────────────────────────
           ONBOARDING OVERLAY
        ─────────────────────────────────────────── */
        .ob-overlay {
          position: fixed; inset: 0; z-index: 100;
          display: flex; align-items: center; justify-content: center;
          background: rgba(2,6,18,0.80); backdrop-filter: blur(10px);
          animation: obFade .35s ease both;
        }
        @keyframes obFade  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes obSlide { from { transform: translateY(28px); opacity:0; } to { transform: none; opacity:1; } }
        .ob-card {
          width: min(360px, 92vw);
          background: rgba(6,10,26,0.95);
          border: 1px solid rgba(212,160,23,0.28); border-radius: 26px;
          padding: 38px 28px 34px;
          display: flex; flex-direction: column; align-items: center; gap: 14px;
          box-shadow: 0 12px 70px rgba(0,0,0,0.75), 0 0 80px rgba(212,160,23,0.06);
          animation: obSlide .45s cubic-bezier(.22,.68,0,1.2) both;
        }
        .ob-logo {
          width: 58px; height: 58px; border-radius: 50%;
          background: radial-gradient(circle at 36% 36%, #fff5d0, #d4a017 42%, #7a5200 88%);
          display: flex; align-items: center; justify-content: center; font-size: 22px;
          box-shadow: 0 0 22px rgba(212,160,23,0.65), 0 0 50px rgba(212,160,23,0.28);
          animation: lp 3.2s ease-in-out infinite;
        }
        .ob-title { font-size: 46px; font-weight: 700; color: #d4a017; text-shadow: 0 0 34px rgba(212,160,23,0.55); margin: 0; }
        .ob-sub   { font-size: 13px; color: rgba(212,160,23,0.50); text-align: center; line-height: 1.7; }
        .ob-sub-en { font-size: 11px; color: rgba(212,160,23,0.32); }
        .ob-fields { width: 100%; display: flex; flex-direction: column; gap: 14px; margin-top: 4px; }
        .ob-field  { display: flex; flex-direction: column; gap: 6px; }
        .ob-label    { font-size: 12.5px; color: rgba(212,160,23,0.65); text-align: right; direction: rtl; }
        .ob-label-en { color: rgba(212,160,23,0.40); }
        .ob-opt      { font-size: 11px; color: rgba(212,160,23,0.30); }
        .ob-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(212,160,23,0.22); border-radius: 12px; padding: 12px 14px;
          color: #e8dab5; font-size: 14px; font-family: 'Vazirmatn', sans-serif;
          text-align: right; direction: rtl; outline: none;
          transition: border-color .25s, box-shadow .25s;
        }
        .ob-input:focus {
          border-color: rgba(212,160,23,0.55);
          box-shadow: 0 0 0 2px rgba(212,160,23,0.08);
        }
        .ob-input::placeholder { color: rgba(212,160,23,0.22); }
        .ob-input[type=number]::-webkit-inner-spin-button { opacity: 0.3; }
        .ob-btn {
          width: 100%; margin-top: 8px; padding: 14px;
          background: #d4a017; color: #06080f; border: none; border-radius: 14px;
          font-size: 15px; font-weight: 600; font-family: 'Vazirmatn', sans-serif; cursor: pointer;
          box-shadow: 0 0 22px rgba(212,160,23,0.50); transition: background .2s, transform .1s;
          letter-spacing: .02em;
        }
        .ob-btn:hover  { background: #e8b520; }
        .ob-btn:active { transform: scale(.97); }

        @media (max-width: 480px) {
          .ig-logo { font-size: 23px; }
          .story-av { width: 54px; height: 54px; }
        }
      `}</style>
    </>
  );
}
