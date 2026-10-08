"use client";

import { useState } from "react";

/** Native share sheet on phones; WhatsApp / Telegram / X / copy-link menu elsewhere */
export function ShareButton({ url, text, label = "Share" }: { url: string; text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ text, url });
        return;
      } catch {
        // cancelled, or unsupported payload: fall back to the menu
      }
    }
    setOpen((o) => !o);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked; the link is still visible in the menu
    }
  }

  const msg = encodeURIComponent(`${text} ${url}`);
  const targets = [
    { name: "WhatsApp", href: `https://wa.me/?text=${msg}` },
    { name: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
    { name: "X", href: `https://x.com/intent/post?text=${msg}` },
  ];

  return (
    <div className="relative inline-block">
      <button
        onClick={share}
        className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-accent"
        aria-expanded={open}
      >
        {label}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-48 rounded-xl border border-border bg-surface p-1 shadow-lg">
          {targets.map((t) => (
            <a
              key={t.name}
              href={t.href}
              target="_blank"
              rel="noreferrer"
              className="block rounded-md px-3 py-2 text-sm hover:bg-surface-muted"
              onClick={() => setOpen(false)}
            >
              {t.name}
            </a>
          ))}
          <button onClick={copy} className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-muted">
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>
      )}
    </div>
  );
}
