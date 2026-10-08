import { NextResponse } from "next/server";
import { authClient, safeNext } from "@/lib/auth/server";

/** OAuth (Google) and PKCE magic-link redirects land here with ?code= */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (code) {
    const { error } = await (await authClient()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    console.error("[auth/callback]", error.message);
  }
  return NextResponse.redirect(new URL(`/signin?error=link&next=${encodeURIComponent(next)}`, url.origin));
}
