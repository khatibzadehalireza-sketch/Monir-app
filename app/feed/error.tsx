"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FeedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("[feed/error]", error.message);
  }, [error]);

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;600&display=swap" rel="stylesheet" />
      <div style={{
        minHeight: "100dvh",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: "18px", padding: "32px 24px",
        background: "#020a1a",
        fontFamily: "Vazirmatn, sans-serif",
        direction: "rtl", textAlign: "center",
        color: "rgba(232,223,200,0.80)",
      }}>
        <div style={{ fontSize: "40px", opacity: 0.7 }}>✦</div>
        <p style={{ color: "rgba(212,160,23,0.65)", fontSize: "15px", lineHeight: 1.8 }}>
          خطایی در بارگذاری فید رخ داد
        </p>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={reset} style={btnStyle}>تلاش مجدد</button>
          <button onClick={() => router.push("/")} style={{ ...btnStyle, background: "transparent" }}>بازگشت به خانه</button>
        </div>
      </div>
    </>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "10px 22px",
  borderRadius: "20px",
  border: "1px solid rgba(212,160,23,0.32)",
  background: "rgba(212,160,23,0.10)",
  color: "rgba(212,160,23,0.80)",
  fontFamily: "Vazirmatn, sans-serif",
  fontSize: "13px",
  cursor: "pointer",
};
