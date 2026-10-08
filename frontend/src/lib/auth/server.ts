import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { db } from "../db/client";
import { authEnv } from "../env";
import type { Profile } from "./types";

/** Supabase client bound to the request's auth cookies (anon/publishable key) */
export async function authClient() {
  const store = await cookies();
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = authEnv();
  return createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component, which can't set cookies; proxy.ts refreshes sessions
        }
      },
    },
  });
}

/** Signed-in user id, verified from the session JWT, or null */
export async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await (await authClient()).auth.getClaims();
    return (data?.claims.sub as string | undefined) ?? null;
  } catch {
    return null; // auth not configured
  }
}

export async function currentProfile(): Promise<Profile | null> {
  const id = await currentUserId();
  if (!id) return null;
  const { data } = await db().from("profiles").select("id, username, display_name, avatar_url").eq("id", id).maybeSingle();
  return (data as Profile | null) ?? null;
}

/** Origin of the current request (for OAuth / magic link redirects) */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Only allow same-site relative redirects after sign-in */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
