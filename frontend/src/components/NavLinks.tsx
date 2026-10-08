"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Matches", match: (p: string) => p === "/" || p.startsWith("/match") || p.startsWith("/m/") },
  { href: "/me", label: "My bets", match: (p: string) => p.startsWith("/me") },
  { href: "/groups", label: "Groups", match: (p: string) => p.startsWith("/groups") || p.startsWith("/join") },
  { href: "/leaderboard", label: "Leaderboard", match: (p: string) => p.startsWith("/leaderboard") },
  // On phones this lives in the footer to keep the nav on one line
  { href: "/how-it-works", label: "How it works", match: (p: string) => p.startsWith("/how-it-works"), desktopOnly: true },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="-mx-2 flex w-full items-center gap-1 overflow-x-auto text-sm sm:mx-0 sm:w-auto">
      {LINKS.map(({ href, label, match, desktopOnly }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`${desktopOnly ? "hidden sm:block " : ""}whitespace-nowrap rounded-md px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              active ? "bg-surface-muted font-medium text-foreground" : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
