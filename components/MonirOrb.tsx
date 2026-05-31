"use client";

interface Props {
  onClick: () => void;
}

export function MonirOrb({ onClick }: Props) {
  return (
    <div className="orb-hero">
      <div className="allah-calli" aria-hidden="true">ٱللَّٰه</div>
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
