"use client";

import { useState, useEffect, useCallback } from "react";
import type { Post, Comment } from "@/lib/types";

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)    return "همین الان";
  if (diff < 3600)  return `${Math.floor(diff / 60)} دقیقه پیش`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ساعت پیش`;
  return `${Math.floor(diff / 86400)} روز پیش`;
}

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

export function PostCard({ post: initial, userId }: { post: Post; userId: string | null; }) {
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
        <CommentSection
          postId={post.id} userId={userId}
          initialCount={commentCount}
          onCountChange={d => setCommentCount(c => c + d)}
        />
      )}
    </article>
  );
}
