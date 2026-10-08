"use client";

import { useEffect, useRef } from "react";

/** Telegram's official login widget; it redirects to /auth/telegram with signed user data */
export function TelegramLogin({ bot, next }: { bot: string; next: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", bot);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "8");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-auth-url", `${window.location.origin}/auth/telegram?next=${encodeURIComponent(next)}`);
    container.appendChild(script);
    return () => {
      container.innerHTML = "";
    };
  }, [bot, next]);

  return <div ref={ref} className="min-h-10" />;
}
