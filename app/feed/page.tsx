"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

/* ─── Types ───────────────────────────────────────── */
interface Post {
  id: string;
  user_id: string;
  author_name: string;
  content: string;
  created_at: string;
  ameen_count: number;
  comment_count: number;
  i_said_ameen: boolean;
}

interface Comment {
  id: string;
  user_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

/* ─── Helpers ─────────────────────────────────────── */
function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return "همین الان";
  if (diff < 3600) return `${Math.floor(diff / 60)} دقیقه پیش`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ساعت پیش`;
  return `${Math.floor(diff / 86400)} روز پیش`;
}

/* ─── Comment Section ─────────────────────────────── */
function CommentSection({
  postId,
  userId,
  initialCount,
  onCountChange,
}: {
  postId: string;
  userId: string | null;
  initialCount: number;
  onCountChange: (delta: number) => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loaded, setLoaded]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [text, setText]         = useState("");
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState("");

  const load = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/posts/${postId}/comments`);
      const data = await res.json();
      setComments(data.comments ?? []);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [postId, loaded]);

  useEffect(() => { load(); }, [load]);

  const submit = useCallback(async () => {
    if (!text.trim() || sending || !userId) return;
    setSending(true);
    setError("");
    try {
      const res  = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, content: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "خطا"); return; }
      setComments(p => [...p, data.comment]);
      onCountChange(1);
      setText("");
    } finally {
      setSending(false);
    }
  }, [text, sending, userId, postId, onCountChange]);

  return (
    <div className="cmt-wrap">
      {loading && <p className="cmt-hint">در حال بارگذاری...</p>}

      {loaded && comments.length === 0 && (
        <p className="cmt-hint">اولین نظر رو بنویس 🌙</p>
      )}

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
            value={text}
            maxLength={300}
            rows={1}
            onChange={e => {
              setText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
          />
          <button
            className={`cmt-send${text.trim() && !sending ? " cmt-send-on" : ""}`}
            onClick={submit}
            disabled={!text.trim() || sending}
          >
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
function PostCard({
  post: initial,
  userId,
}: {
  post: Post;
  userId: string | null;
}) {
  const [post, setPost]             = useState(initial);
  const [ameenAnim, setAmeenAnim]   = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(initial.comment_count);

  const handleAmeen = useCallback(async () => {
    if (!userId) return;
    // Optimistic update
    const was = post.i_said_ameen;
    setPost(p => ({
      ...p,
      i_said_ameen: !was,
      ameen_count:  was ? Math.max(0, p.ameen_count - 1) : p.ameen_count + 1,
    }));
    if (!was) {
      setAmeenAnim(true);
      setTimeout(() => setAmeenAnim(false), 600);
    }
    try {
      const res  = await fetch(`/api/posts/${post.id}/ameen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (res.ok) {
        setPost(p => ({
          ...p,
          ameen_count:  data.ameen_count,
          i_said_ameen: data.i_said_ameen,
        }));
      } else {
        // Revert on failure
        setPost(p => ({ ...p, i_said_ameen: was, ameen_count: was ? p.ameen_count + 1 : Math.max(0, p.ameen_count - 1) }));
      }
    } catch {
      setPost(p => ({ ...p, i_said_ameen: was }));
    }
  }, [userId, post]);

  return (
    <article className="post-card">
      {/* Author row */}
      <div className="post-hdr">
        <div className="post-av">{post.author_name.charAt(0) || "م"}</div>
        <div className="post-meta">
          <span className="post-name">{post.author_name}</span>
          <span className="post-time">{timeAgo(post.created_at)}</span>
        </div>
      </div>

      {/* Content */}
      <p className="post-content">{post.content}</p>

      {/* Actions */}
      <div className="post-actions">
        <button
          className={`ameen-btn${post.i_said_ameen ? " ameen-on" : ""}${ameenAnim ? " ameen-pop" : ""}${!userId ? " ameen-disabled" : ""}`}
          onClick={handleAmeen}
          title={userId ? undefined : "برای آمین گفتن وارد شو"}
        >
          <span className="ameen-icon">🤲</span>
          <span className="ameen-label">آمین</span>
          {post.ameen_count > 0 && (
            <span className="ameen-count">{post.ameen_count}</span>
          )}
        </button>

        <button
          className={`cmt-btn${showComments ? " cmt-btn-on" : ""}`}
          onClick={() => setShowComments(p => !p)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>{commentCount > 0 ? commentCount : "نظر"}</span>
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <CommentSection
          postId={post.id}
          userId={userId}
          initialCount={commentCount}
          onCountChange={d => setCommentCount(c => c + d)}
        />
      )}
    </article>
  );
}

/* ─── New Post Modal ──────────────────────────────── */
function NewPostModal({
  userId,
  authorName,
  onClose,
  onCreated,
}: {
  userId: string;
  authorName: string;
  onClose: () => void;
  onCreated: (post: Post) => void;
}) {
  const [text, setText]       = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError]     = useState("");
  const MAX = 500;

  const submit = useCallback(async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const res  = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, content: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          res.status === 422
            ? "محتوای پست مناسب نیست. لطفاً ویرایش کن."
            : (data.error ?? "خطا در ارسال")
        );
        return;
      }
      onCreated({
        ...data.post,
        author_name:   authorName,
        comment_count: 0,
        i_said_ameen:  false,
      });
      onClose();
    } finally {
      setSending(false);
    }
  }, [text, sending, userId, authorName, onCreated, onClose]);

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card">
        <div className="modal-hdr">
          <span className="modal-title">پست جدید ✦</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <textarea
          className="modal-ta"
          placeholder="افکار معنوی‌ات رو به اشتراک بذار..."
          value={text}
          maxLength={MAX}
          autoFocus
          onChange={e => setText(e.target.value)}
        />

        <div className="modal-footer">
          <span className={`char-count${text.length > MAX * 0.9 ? " char-warn" : ""}`}>
            {text.length}/{MAX}
          </span>
          {error && <span className="modal-err">{error}</span>}
          <button
            className={`modal-submit${text.trim() && !sending ? " modal-submit-on" : ""}`}
            onClick={submit}
            disabled={!text.trim() || sending}
          >
            {sending ? "در حال ارسال..." : "انتشار"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Feed Page ───────────────────────────────────── */
export default function FeedPage() {
  const router = useRouter();

  const [userId, setUserId]           = useState<string | null>(null);
  const [authorName, setAuthorName]   = useState("کاربر منیر");
  const [posts, setPosts]             = useState<Post[]>([]);
  const [nextCursor, setNextCursor]   = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const initRef = useRef(false);

  // Resolve auth
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        localStorage.setItem("munir_uid", uid);
        // Fetch display name
        fetch(`/api/profile?userId=${encodeURIComponent(uid)}`)
          .then(r => r.json())
          .then(d => { if (d.name) setAuthorName(d.name); })
          .catch(() => {});
      }
    });
  }, []);

  // Initial load
  const loadFeed = useCallback(async (cursor?: string) => {
    if (!cursor) setLoading(true); else setLoadingMore(true);
    try {
      const uid    = userId ?? "";
      const params = new URLSearchParams({ limit: "20" });
      if (cursor) params.set("cursor", cursor);
      if (uid)    params.set("userId", uid);

      const res  = await fetch(`/api/feed?${params}`);
      const data = await res.json();

      setPosts(p => cursor ? [...p, ...(data.posts ?? [])] : (data.posts ?? []));
      setNextCursor(data.nextCursor ?? null);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userId]);

  useEffect(() => {
    // Load once userId is resolved (even if null — public feed)
    if (initRef.current) return;
    initRef.current = true;
    loadFeed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreated = useCallback((post: Post) => {
    setPosts(p => [post, ...p]);
  }, []);

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700&display=swap"
        rel="stylesheet"
      />
      <div className="bg" />

      <div className="app">
        {/* Header */}
        <header className="fhdr">
          <button className="ibtn" onClick={() => router.push("/")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </button>

          <div className="fhdr-mid">
            <div className="logo"><span>✦</span></div>
            <div>
              <div className="fhdr-title">فضای اجتماعی</div>
              <div className="fhdr-sub">دعا و تأمل مشترک</div>
            </div>
          </div>

          {userId ? (
            <button className="new-btn" onClick={() => setShowNew(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          ) : (
            <button className="login-chip" onClick={() => router.push("/login")}>ورود</button>
          )}
        </header>

        {/* Feed */}
        <div className="scroll">
          {loading && (
            <div className="center-msg">
              <div className="spinner" />
              <p className="hint">در حال بارگذاری...</p>
            </div>
          )}

          {!loading && posts.length === 0 && (
            <div className="center-msg">
              <div className="empty-icon">🌙</div>
              <p className="hint">هنوز پستی نیست. اولین نفر باش!</p>
              {userId && (
                <button className="btn-gold" onClick={() => setShowNew(true)}>
                  اولین پست رو بنویس ✦
                </button>
              )}
            </div>
          )}

          {posts.map(p => (
            <PostCard key={p.id} post={p} userId={userId} />
          ))}

          {nextCursor && !loadingMore && (
            <button className="load-more" onClick={() => loadFeed(nextCursor)}>
              پست‌های بیشتر
            </button>
          )}

          {loadingMore && (
            <div className="load-more-spin">
              <div className="spinner-sm" />
            </div>
          )}

          <div style={{ height: 32 }} />
        </div>

        {/* FAB for logged-in users */}
        {userId && !showNew && (
          <button className="fab" onClick={() => setShowNew(true)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        )}
      </div>

      {/* New post modal */}
      {showNew && userId && (
        <NewPostModal
          userId={userId}
          authorName={authorName}
          onClose={() => setShowNew(false)}
          onCreated={handleCreated}
        />
      )}

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
            rgba(4,10,24,0.22) 25%,
            rgba(10,6,2,0.35) 60%,
            rgba(4,2,0,0.94) 100%);
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
        .fhdr {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; flex-shrink: 0;
          background: rgba(2,8,26,0.82);
          backdrop-filter: blur(22px) saturate(170%);
          border-bottom: 1px solid rgba(212,160,23,0.14);
          box-shadow: 0 8px 40px rgba(0,0,0,0.45);
        }
        .fhdr-mid { display: flex; align-items: center; gap: 11px; }
        .logo {
          width: 42px; height: 42px; border-radius: 50%;
          background: radial-gradient(circle at 36% 36%, #fff5d0, #d4a017 42%, #7a5200 88%);
          display: flex; align-items: center; justify-content: center; font-size: 18px;
          animation: lp 3.2s ease-in-out infinite;
        }
        @keyframes lp {
          0%,100% { box-shadow: 0 0 14px rgba(212,160,23,0.55), 0 0 28px rgba(212,160,23,0.28); }
          50%      { box-shadow: 0 0 26px rgba(212,160,23,0.85), 0 0 52px rgba(212,160,23,0.45); }
        }
        .fhdr-title { color: #d4a017; font-weight: 700; font-size: 17px; }
        .fhdr-sub   { color: rgba(212,160,23,0.46); font-size: 11px; font-weight: 300; margin-top: 1px; }
        .ibtn {
          width: 40px; height: 40px; border-radius: 50%; border: none;
          background: rgba(255,255,255,0.09); backdrop-filter: blur(14px);
          color: rgba(212,160,23,0.80);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background .2s;
        }
        .ibtn:hover { background: rgba(255,255,255,0.14); }
        .new-btn {
          width: 40px; height: 40px; border-radius: 50%; border: none;
          background: rgba(212,160,23,0.18); backdrop-filter: blur(14px);
          color: #d4a017;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all .2s;
        }
        .new-btn:hover { background: rgba(212,160,23,0.30); }
        .login-chip {
          padding: 7px 16px; border: 1px solid rgba(212,160,23,0.35);
          border-radius: 20px; background: transparent;
          color: rgba(212,160,23,0.75); font-size: 13px;
          font-family: 'Vazirmatn', sans-serif; cursor: pointer;
          transition: all .2s;
        }
        .login-chip:hover { background: rgba(212,160,23,0.10); color: #d4a017; }

        /* ── SCROLL ── */
        .scroll {
          flex: 1; overflow-y: auto; min-height: 0;
          padding: 16px 14px 80px;
          display: flex; flex-direction: column; gap: 14px;
        }
        .scroll::-webkit-scrollbar { width: 3px; }
        .scroll::-webkit-scrollbar-thumb { background: rgba(212,160,23,0.20); border-radius: 2px; }

        /* ── CENTER ── */
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

        /* ── POST CARD ── */
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
          padding: 0 16px 14px;
          border-top: 1px solid rgba(212,160,23,0.07);
          padding-top: 11px;
        }

        /* آمین button */
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
          border-color: rgba(212,160,23,0.45);
          color: #d4a017;
        }
        .ameen-btn.ameen-on {
          background: rgba(212,160,23,0.18);
          border-color: rgba(212,160,23,0.55);
          color: #d4a017;
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

        /* Comment toggle button */
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

        /* ── COMMENT SECTION ── */
        .cmt-wrap {
          border-top: 1px solid rgba(212,160,23,0.08);
          padding: 12px 16px 14px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .cmt-hint {
          font-size: 12.5px; color: rgba(212,160,23,0.38);
          text-align: center; padding: 4px 0;
        }
        .cmt-hint-login {
          font-size: 12.5px; color: rgba(212,160,23,0.35);
          text-align: center; padding: 4px 0;
        }
        .cmt-err { font-size: 12px; color: rgba(255,100,100,0.75); text-align: center; }
        .cmt-row {
          display: flex; align-items: flex-start; gap: 9px;
          animation: fadeUp .25s ease both;
        }
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
          border: 1px solid rgba(212,160,23,0.18);
          border-radius: 12px; padding: 9px 12px;
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

        /* ── LOAD MORE ── */
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

        /* ── FAB ── */
        .fab {
          position: fixed; bottom: 28px; left: 22px; z-index: 20;
          width: 54px; height: 54px; border-radius: 50%; border: none;
          background: #d4a017; color: #06080f;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 22px rgba(212,160,23,0.55), 0 0 40px rgba(212,160,23,0.25);
          transition: transform .18s, box-shadow .18s;
          animation: fabIn .4s cubic-bezier(.22,.68,0,1.4) both;
        }
        @keyframes fabIn {
          from { transform: scale(0); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        .fab:hover  { transform: scale(1.08); box-shadow: 0 6px 30px rgba(212,160,23,0.70); }
        .fab:active { transform: scale(0.93); }

        /* ── MODAL ── */
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
          border: 1px solid rgba(212,160,23,0.25);
          border-bottom: none;
          border-radius: 24px 24px 0 0;
          padding: 20px 20px 32px;
          display: flex; flex-direction: column; gap: 14px;
          box-shadow: 0 -8px 50px rgba(0,0,0,0.70);
          animation: slideUp .3s cubic-bezier(.22,.68,0,1.15) both;
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: none; }
        }
        .modal-hdr {
          display: flex; align-items: center; justify-content: space-between;
        }
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
          border: 1px solid rgba(212,160,23,0.20);
          border-radius: 16px; padding: 14px 16px;
          color: #e8dab5; font-size: 15px; line-height: 1.75;
          font-family: 'Vazirmatn', sans-serif;
          direction: rtl; text-align: right; outline: none; resize: none;
          transition: border-color .25s;
        }
        .modal-ta:focus { border-color: rgba(212,160,23,0.50); }
        .modal-ta::placeholder { color: rgba(212,160,23,0.25); }
        .modal-footer {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
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
      `}</style>
    </>
  );
}
