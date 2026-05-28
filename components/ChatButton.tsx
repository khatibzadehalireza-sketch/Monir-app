"use client";

interface Props {
  name: string;
  isAI: boolean;
  onClick: () => void;
}

export function ChatButton({ name, isAI, onClick }: Props) {
  return (
    <button className="story" onClick={onClick}>
      <div className={`story-ring${isAI ? " story-ring-ai" : ""}`}>
        <div className={`story-av${isAI ? " story-av-ai" : ""}`}>
          <span>{isAI ? "✦" : name.charAt(0)}</span>
        </div>
      </div>
      <span className="story-name">{name}</span>
    </button>
  );
}
