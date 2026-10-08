"use client";

import { useActionState } from "react";
import type { Profile } from "@/lib/auth/types";
import { updateProfile, type ProfileState } from "./actions";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, { status: "idle" });
  const input = "w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent";

  return (
    <form action={action} className="space-y-3">
      <label className="block space-y-1 text-sm">
        <span className="text-muted">Display name</span>
        <input name="display_name" defaultValue={profile.display_name} maxLength={30} required className={input} />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-muted">Username</span>
        <div className="flex items-center rounded-lg border border-border bg-background pl-3 focus-within:border-accent">
          <span className="text-muted">@</span>
          <input
            name="username"
            defaultValue={profile.username}
            pattern="[a-zA-Z0-9_]{3,20}"
            required
            className="w-full bg-transparent px-1 py-2 outline-none"
          />
        </div>
      </label>
      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 font-semibold text-white hover:bg-accent-strong disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {state.status !== "idle" && (
          <span className={`text-sm ${state.status === "error" ? "text-danger" : "text-accent-strong"}`}>{state.message}</span>
        )}
      </div>
    </form>
  );
}
