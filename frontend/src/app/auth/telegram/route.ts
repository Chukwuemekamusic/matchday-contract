import { NextResponse } from "next/server";
import { authClient, safeNext } from "@/lib/auth/server";
import { telegramEmail, verifyTelegramLogin } from "@/lib/auth/telegram";
import { db } from "@/lib/db/client";
import { authEnv } from "@/lib/env";

/**
 * Telegram Login Widget redirect (data-auth-url). Supabase has no Telegram provider, so after
 * verifying Telegram's signature we mint a one-time magic link for a synthetic email tied to
 * the Telegram id and redeem it immediately, which sets the normal Supabase session cookies.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/signin?error=${reason}&next=${encodeURIComponent(next)}`, url.origin));

  const { TELEGRAM_BOT_TOKEN } = authEnv();
  if (!TELEGRAM_BOT_TOKEN) return fail("telegram");

  const login = verifyTelegramLogin(Object.fromEntries(url.searchParams), TELEGRAM_BOT_TOKEN);
  if (!login) return fail("telegram");

  const fullName = [login.first_name, login.last_name].filter(Boolean).join(" ");
  const { data, error } = await db().auth.admin.generateLink({
    type: "magiclink",
    email: telegramEmail(login.id),
    options: {
      // Only used when the account is first created (copied into the profile by a trigger)
      data: {
        full_name: fullName || login.username,
        avatar_url: login.photo_url,
        telegram_id: login.id,
        telegram_username: login.username,
        provider: "telegram",
      },
    },
  });
  if (error || !data.properties?.hashed_token) {
    console.error("[auth/telegram] generateLink", error?.message);
    return fail("telegram");
  }

  const { error: verifyError } = await (await authClient()).auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError) {
    console.error("[auth/telegram] verifyOtp", verifyError.message);
    return fail("telegram");
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
