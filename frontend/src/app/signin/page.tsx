import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUserId, safeNext } from "@/lib/auth/server";
import { EmailSignIn } from "./EmailSignIn";
import { TelegramLogin } from "./TelegramLogin";
import { signInWithGoogle } from "./actions";

export const metadata: Metadata = { title: "Sign in — MatchDay" };

const ERRORS: Record<string, string> = {
  link: "That sign-in link has expired or was already used. Try again.",
  google: "Google sign-in isn't available right now.",
  telegram: "Telegram sign-in failed. Try again.",
};

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  if (await currentUserId()) redirect(next);
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const telegramBot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

  return (
    <div className="mx-auto max-w-sm space-y-6 py-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Join MatchDay</h1>
        <p className="text-sm text-muted">Make free picks, climb the tables and challenge your friends. No wallet needed.</p>
      </div>

      {error && <p className="rounded-lg border border-danger/40 p-3 text-sm text-danger">{error}</p>}

      <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        {telegramBot && (
          <div className="flex justify-center">
            <TelegramLogin bot={telegramBot} next={next} />
          </div>
        )}
        <form action={signInWithGoogle}>
          <input type="hidden" name="next" value={next} />
          <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 font-medium hover:border-accent">
            <span aria-hidden className="font-bold">
              G
            </span>
            Continue with Google
          </button>
        </form>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>
        <EmailSignIn next={next} />
      </div>
      <p className="text-center text-xs text-muted">
        Free picks never involve money. You can connect a wallet later to back picks with ETH. 18+ only.
      </p>
    </div>
  );
}
