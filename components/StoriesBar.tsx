"use client";

import { ChatButton } from "./ChatButton";

const STORIES = [
  { id: "ai", name: "منیر", isAI: true },
];

interface Props {
  onOpenChat: () => void;
}

export function StoriesBar({ onOpenChat }: Props) {
  return (
    <div className="stories-bar">
      {STORIES.map(s => (
        <ChatButton
          key={s.id}
          name={s.name}
          isAI={s.isAI}
          onClick={() => { if (s.isAI) onOpenChat(); }}
        />
      ))}
    </div>
  );
}
