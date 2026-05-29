"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  /** Custom fallback UI. When omitted a minimal themed message is shown. */
  fallback?: ReactNode;
  /** Render nothing on error instead of any UI (for non-essential sections). */
  silent?: boolean;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      "[ErrorBoundary]",
      error.message,
      info.componentStack?.split("\n")[1]?.trim() ?? "",
    );
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.silent) return null;
    return (
      this.props.fallback ?? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "24px 16px",
            color: "rgba(212,160,23,0.50)",
            fontSize: "13px",
            fontFamily: "Vazirmatn, sans-serif",
            direction: "rtl",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "22px", opacity: 0.7 }}>⚠</span>
          <span>این بخش در دسترس نیست</span>
        </div>
      )
    );
  }
}
