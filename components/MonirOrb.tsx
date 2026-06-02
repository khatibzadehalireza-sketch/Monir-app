"use client";

interface Props {
  onClick: () => void;
}

export function MonirOrb({ onClick }: Props) {
  return (
    <div className="orb-hero">
<button
        className="monir-orb"
        onClick={onClick}
        aria-label="باز کردن منیر"
      >
        <div className="monir-orb-core">✦</div>
      </button>
    </div>
  );
}
