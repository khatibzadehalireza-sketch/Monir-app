"use client";

import { useRouter, usePathname } from "next/navigation";

export function MonirChatFAB() {
  const router   = useRouter();
  const pathname = usePathname();

  const open = () => {
    if (pathname === "/") {
      window.dispatchEvent(new CustomEvent("open-monir-chat"));
    } else {
      localStorage.setItem("monir_open_chat_pending", "1");
      router.push("/");
    }
  };

  /* orb on home page is the primary entry point — no duplicate FAB there */
  if (pathname === "/") return null;

  return (
    <>
      <button className="mcf" onClick={open} aria-label="چت با منیر">
        <span className="mcf-star">✦</span>
      </button>
      <style>{`
        .mcf {
          position: fixed;
          bottom: 84px;
          right: 18px;
          z-index: 300;
          width: 54px; height: 54px;
          border-radius: 50%; border: none;
          background: radial-gradient(circle at 36% 36%, #fff5d0, #d4a017 42%, #7a5200 88%);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          box-shadow:
            0 0 18px rgba(212,160,23,0.75),
            0 0 42px rgba(212,160,23,0.38),
            0 4px 20px rgba(0,0,0,0.55);
          animation: mcfIn .45s cubic-bezier(.22,.68,0,1.4) both,
                     mcfPulse 2.8s 0.5s ease-in-out infinite;
          transition: transform .18s;
        }
        .mcf:hover  { transform: scale(1.10); }
        .mcf:active { transform: scale(0.91); }
        .mcf-star { font-size: 22px; color: #06080f; line-height: 1; }
        @keyframes mcfIn {
          from { transform: scale(0); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        @keyframes mcfPulse {
          0%,100% { box-shadow: 0 0 18px rgba(212,160,23,0.75), 0 0 42px rgba(212,160,23,0.38), 0 4px 20px rgba(0,0,0,0.55); }
          50%      { box-shadow: 0 0 30px rgba(212,160,23,0.95), 0 0 65px rgba(212,160,23,0.58), 0 4px 26px rgba(0,0,0,0.55); }
        }
      `}</style>
    </>
  );
}
