"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  id: string;
}

const OPENING_MESSAGE = "چی تورو به اینجا کشونده فرزندم... چه می‌خواهی؟";

export default function MunirChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTimeout(() => {
      setMessages([{ role: "assistant", content: OPENING_MESSAGE, id: "opening" }]);
    }, 800);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = { role: "user", content: text, id: Date.now().toString() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const apiMessages = [...messages, userMessage].map((m) => ({ role: m.role, content: m.content }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          message: text,
          userId: (() => {
            let id = localStorage.getItem('munir_user_id');
            if (!id) {
              id = 'user_' + Math.random().toString(36).substring(2);
              localStorage.setItem('munir_user_id', id);
            }
            return id;
          })()
        }),
      });
      const data = await response.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply, id: Date.now().toString() }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "فرزندم... ارتباط قطع شد.", id: Date.now().toString() }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#06080f", fontFamily: "Vazirmatn, sans-serif", direction: "rtl" }}>
      <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;700&display=swap" rel="stylesheet" />
      
      <header style={{ padding: "16px 20px", borderBottom: "1px solid #1a2332", background: "#0d1117", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #f0d090, #d4a017 40%, #8b6914 80%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", boxShadow: "0 0 20px rgba(212,160,23,0.4)" }}>✦</div>
          <div>
            <div style={{ color: "#d4a017", fontWeight: "700", fontSize: "18px" }}>منیر</div>
            <div style={{ color: "#d4a01788", fontSize: "12px" }}>همراه معنوی</div>
          </div>
        </div>
        <div style={{ color: "#d4a01766", fontSize: "13px" }}>أَفَلَا تَتَفَکَّرُونَ</div>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-start" : "flex-end", alignItems: "flex-end", gap: "10px" }}>
            {msg.role === "assistant" && (
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #f0d090, #d4a017 40%, #8b6914 80%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: 0, boxShadow: "0 0 12px rgba(212,160,23,0.3)" }}>✦</div>
            )}
            <div style={{ maxWidth: "75%", padding: "12px 16px", borderRadius: msg.role === "user" ? "18px 18px 18px 4px" : "18px 18px 4px 18px", background: msg.role === "user" ? "#1f2d3d" : "#1a2332", border: msg.role === "user" ? "1px solid #2a3f5a" : "1px solid #d4a01733", color: msg.role === "user" ? "#c8d8e8" : "#e8d5a3", fontSize: "14px", lineHeight: "1.7", textAlign: "right" }}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #f0d090, #d4a017 40%, #8b6914 80%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>✦</div>
            <div style={{ padding: "12px 16px", borderRadius: "18px 18px 4px 18px", background: "#1a2332", border: "1px solid #d4a01733", display: "flex", gap: "6px", alignItems: "center" }}>
              {[0,1,2].map(i => <span key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#d4a017", display: "inline-block", animation: `bounce 1.4s ${i*0.2}s ease-in-out infinite` }} />)}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: "16px", borderTop: "1px solid #1a2332", background: "#0d1117" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", background: "#111827", border: "1px solid #d4a01733", borderRadius: "16px", padding: "12px 16px" }}>
          <button onClick={sendMessage} disabled={!input.trim() || isLoading} style={{ width: "36px", height: "36px", borderRadius: "10px", background: input.trim() && !isLoading ? "#d4a017" : "#1a2332", border: "none", cursor: input.trim() && !isLoading ? "pointer" : "not-allowed", color: input.trim() && !isLoading ? "#06080f" : "#555", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            ➤
          </button>
          <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="هر چه در دل داری بگو..." rows={1} style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#e8d5a3", fontSize: "14px", lineHeight: "1.6", textAlign: "right", direction: "rtl", fontFamily: "Vazirmatn, sans-serif", resize: "none" }} />
        </div>
        <p style={{ textAlign: "center", color: "#d4a01744", fontSize: "11px", marginTop: "8px" }}>Enter برای ارسال</p>
      </div>

      <style>{`@keyframes bounce { 0%,60%,100%{transform:translateY(0);opacity:0.4} 30%{transform:translateY(-6px);opacity:1} }`}</style>
    </div>
  );
}
