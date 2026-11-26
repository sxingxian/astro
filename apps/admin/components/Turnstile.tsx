"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
  if (existing) return new Promise((r) => existing.addEventListener("load", () => r(), { once: true }));
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Turnstile failed to load"));
    document.head.appendChild(s);
  });
}

interface Props {
  mode: "on" | "off";
  siteKey: string;
  action: string;
  onToken: (token: string) => void;
}

/** Cloudflare Turnstile. With mode "off" (local development and tests only) it renders nothing. */
export function Turnstile({ mode, siteKey, action, onToken }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mode === "off" || !ref.current) return;
    let id: string | undefined;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        id = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          action,
          theme: "dark",
          callback: (t: string) => onToken(t),
          "expired-callback": () => onToken(""),
          "error-callback": () => onToken("")
        });
      })
      .catch(() => onToken(""));
    return () => {
      cancelled = true;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [mode, siteKey, action, onToken]);
  if (mode === "off") return null;
  return <div ref={ref} className="min-h-[65px]" />;
}
