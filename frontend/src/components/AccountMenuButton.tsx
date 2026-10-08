"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/signin/actions";
import { Avatar } from "@/components/Avatar";
import type { Profile } from "@/lib/auth/types";

export function AccountMenuButton({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const item = "block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-muted";
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center rounded-full ring-accent focus-visible:ring-2"
      >
        <Avatar name={profile.display_name} seed={profile.id} src={profile.avatar_url} size={36} />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-52 rounded-xl border border-border bg-surface p-1 shadow-lg">
          <div className="px-3 py-2">
            <div className="truncate text-sm font-semibold">{profile.display_name}</div>
            <div className="truncate text-xs text-muted">@{profile.username}</div>
          </div>
          <Link href={`/u/${profile.username}`} className={item} onClick={() => setOpen(false)}>
            My profile
          </Link>
          <Link href="/groups" className={item} onClick={() => setOpen(false)}>
            My groups
          </Link>
          <Link href="/settings" className={item} onClick={() => setOpen(false)}>
            Settings
          </Link>
          <form action={signOut}>
            <button className={`${item} text-danger`}>Sign out</button>
          </form>
        </div>
      )}
    </div>
  );
}
