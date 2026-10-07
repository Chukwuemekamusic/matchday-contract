"use client";

import { useEffect, useState } from "react";
import { useHydrated } from "@/hooks/useHydrated";

const DISMISS_KEY = "matchday:install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Small, dismissible "add to home screen" card on phones (Android prompt or iOS instructions) */
export function InstallPrompt() {
  const hydrated = useHydrated();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // show our own button instead of the browser mini-infobar
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!hydrated || dismissed || readDismissed() || isStandalone()) return null;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!installEvent && !isIOS) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // storage unavailable (private mode): dismissal lasts for this visit only
    }
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    setInstallEvent(null);
    if (outcome === "dismissed") dismiss();
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-30 flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-sm shadow-lg sm:hidden">
      <div className="flex-1">
        <div className="font-semibold">Get the MatchDay app</div>
        <div className="text-xs text-muted">
          {installEvent ? "Add it to your home screen for one-tap access." : "Tap Share, then “Add to Home Screen”."}
        </div>
      </div>
      {installEvent && (
        <button onClick={install} className="rounded-lg bg-accent px-3 py-2 font-semibold text-white">
          Install
        </button>
      )}
      <button onClick={dismiss} aria-label="Dismiss" className="rounded-md px-2 py-1 text-muted hover:text-foreground">
        ✕
      </button>
    </div>
  );
}
