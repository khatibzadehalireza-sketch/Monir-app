"use client";

import { PostCard } from "./PostCard";
import type { Post } from "@/lib/types";

interface Props {
  posts: Post[];
  userId: string | null;
  loadingFeed: boolean;
  loadingMore: boolean;
  nextCursor: string | null;
  onLoadMore: () => void;
  onNewPost: () => void;
}

export function PostFeed({ posts, userId, loadingFeed, loadingMore, nextCursor, onLoadMore, onNewPost }: Props) {
  return (
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
            <button className="btn-gold" onClick={onNewPost}>اولین پست رو بنویس ✦</button>
          )}
        </div>
      )}
      {posts.map(p => <PostCard key={p.id} post={p} userId={userId} />)}
      {nextCursor && !loadingMore && (
        <button className="load-more" onClick={onLoadMore}>پست‌های بیشتر</button>
      )}
      {loadingMore && (
        <div className="load-more-spin"><div className="spinner-sm" /></div>
      )}
      <div style={{ height: 16 }} />
    </div>
  );
}
