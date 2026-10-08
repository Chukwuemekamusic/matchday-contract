"use client";

import { useActionState } from "react";
import { signInWithEmail, type EmailState } from "./actions";

export function EmailSignIn({ next }: { next: string }) {
  const [state, action, pending] = useActionState<EmailState, FormData>(signInWithEmail, { status: "idle" });

  if (state.status === "sent") return <p className="rounded-lg bg-accent-soft p-3 text-sm text-accent-strong">{state.message}</p>;

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="next" value={next} />
      <input
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:border-accent"
        aria-label="Email address"
      />
      <button
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-white hover:bg-accent-strong disabled:opacity-60"
      >
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
      {state.status === "error" && <p className="text-xs text-danger">{state.message}</p>}
    </form>
  );
}
