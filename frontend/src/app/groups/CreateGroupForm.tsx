"use client";

import { useActionState } from "react";
import { createGroup, type GroupFormState } from "./actions";

export function CreateGroupForm() {
  const [state, action, pending] = useActionState<GroupFormState, FormData>(createGroup, {});
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row">
      <input
        name="name"
        required
        minLength={2}
        maxLength={40}
        placeholder="e.g. The Lagos Office, Uni 5-a-side"
        className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:border-accent"
        aria-label="Group name"
      />
      <button
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2.5 font-semibold text-white hover:bg-accent-strong disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create group"}
      </button>
      {state.error && <p className="text-xs text-danger sm:basis-full">{state.error}</p>}
    </form>
  );
}
