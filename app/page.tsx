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

/* ─── Stories ─────────────────────────────────────── */
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
            <div className="cmt-name-row">
              <span className="cmt-name">{c.author_name}</span>
              <span className="cmt-time">{timeAgo(c.created_at)}</span>
            </div>
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
        <div className="post-hdr-dot" />
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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

        {/* ══ HOME SCREEN ══ */}
        {screen === "home" && (
          <div className="screen home">

            {/* Header */}
            <header className="ig-hdr">
              <span className="ig-logo">منیر</span>
              <button className="ibtn nbtn" aria-label="اعلان‌ها">
                <svg width="19" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
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
                  <div className={`story-ring${s.isAI ? " story-ring-ai" : ""}`}>
                    <div className={`story-av${s.isAI ? " story-av-ai" : ""}`}>
                      <span>{s.isAI ? "✦" : s.name.charAt(0)}</span>
                    </div>
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

            {/* Bottom tab bar */}
            <nav className="ig-bnav">
              <button className="ni ni-on">
                <span className="ni-pip" />
                <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                </svg>
                <span>خانه</span>
              </button>

              <button className="ni">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <span>جستجو</span>
              </button>

              <button className="ni ni-post" onClick={() => userId ? setShowNew(true) : router.push("/login")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>

              <button className="ni" onClick={() => router.push("/prayer")}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span>نماز</span>
              </button>

              <button className="ni" onClick={() => router.push("/profile")}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

        /* Ring wrapper — spinning gradient for AI */
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

        /* Active pip indicator */
        .ni-pip {
          position: absolute; top: -4px; left: 50%; transform: translateX(-50%);
          width: 18px; height: 2px; border-radius: 2px;
          background: linear-gradient(90deg, #d4a017, #f5d060);
          box-shadow: 0 0 8px rgba(212,160,23,0.70);
        }

        /* Post (+) button */
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

        .modal-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .char-count { font-size: 11.5px; color: rgba(212,160,23,0.32); }
        .char-warn  { color: rgba(255,140,40,0.70); }
        .modal-err  { font-size: 12.5px; color: rgba(255,100,100,0.72); flex: 1; text-align: center; }

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
      `}</style>
    </>
  );
}
