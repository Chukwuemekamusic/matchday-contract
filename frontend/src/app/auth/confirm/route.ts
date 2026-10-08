import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { authClient, safeNext } from "@/lib/auth/server";

/** Email links using the token-hash template ({{ .TokenHash }}) land here */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = (url.searchParams.get("type") ?? "magiclink") as EmailOtpType;
  const next = safeNext(url.searchParams.get("next"));
  if (tokenHash) {
    const { error } = await (await authClient()).auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    console.error("[auth/confirm]", error.message);
  }
  return NextResponse.redirect(new URL(`/signin?error=link&next=${encodeURIComponent(next)}`, url.origin));
}
