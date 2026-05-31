"use client";

import { Header }        from "@/components/Header";
import { MonirOrb }      from "@/components/MonirOrb";
import { PostFeed }      from "@/components/PostFeed";
import { BottomNav }     from "@/components/BottomNav";
import type { Tab }      from "@/components/BottomNav";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { Post }     from "@/lib/types";

const MOSQUES = [
  { emoji: "🕌", name: "مسجد الحرام", city: "مکه مکرمه" },
  { emoji: "🕌", name: "مسجد النبی",  city: "مدینه منوره" },
] as const;

interface Props {
  activeTab:   Tab;
  onTab:       (tab: Tab) => void;
  userId:      string | null;
  posts:       Post[];
  nextCursor:  string | null;
  loadingFeed: boolean;
  loadingMore: boolean;
  onLoadMore:  () => void;
  onNewPost:   () => void;
  onOpenChat:  () => void;
}

export function HomeScreen({
  activeTab, onTab,
  userId,
  posts, nextCursor, loadingFeed, loadingMore,
  onLoadMore, onNewPost, onOpenChat,
}: Props) {
  return (
    <div className="screen home">
      <ErrorBoundary silent>
        <Header />
      </ErrorBoundary>

      <MonirOrb onClick={onOpenChat} />

      <div className="mosque-section">
        <div className="mosque-pair">
          {MOSQUES.map((m, i) => (
            <button key={i} className="mosque-card">
              <span className="mosque-icon">{m.emoji}</span>
              <span className="mosque-name">{m.name}</span>
              <span className="mosque-city">{m.city}</span>
            </button>
          ))}
        </div>
      </div>

      {(loadingFeed || posts.length > 0) && (
        <ErrorBoundary fallback={
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", color: "rgba(212,160,23,0.50)", fontSize: "13px", fontFamily: "Vazirmatn, sans-serif", direction: "rtl" }}>
            <span style={{ fontSize: "26px" }}>⚠</span>
            <span>خطا در بارگذاری پست‌ها</span>
          </div>
        }>
          <PostFeed
            posts={posts}
            userId={userId}
            loadingFeed={loadingFeed}
            loadingMore={loadingMore}
            nextCursor={nextCursor}
            onLoadMore={onLoadMore}
            onNewPost={onNewPost}
          />
        </ErrorBoundary>
      )}

      <ErrorBoundary silent>
        <BottomNav activeTab={activeTab} onTab={onTab} />
      </ErrorBoundary>
    </div>
  );
}
