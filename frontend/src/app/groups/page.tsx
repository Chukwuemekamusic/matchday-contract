import type { Metadata } from "next";
import Link from "next/link";
import { currentUserId } from "@/lib/auth/server";
import { groupsOf } from "@/lib/db/groups";
import { joinGroup } from "./actions";
import { CreateGroupForm } from "./CreateGroupForm";

export const metadata: Metadata = { title: "Groups — MatchDay" };

export default async function GroupsPage() {
  const userId = await currentUserId();

  if (!userId) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Groups</h1>
        <p className="text-muted">
          Start a group for your friends, office, campus or supporters&apos; club. Everyone makes free picks and your group
          gets its own weekly table.
        </p>
        <Link
          href="/signin?next=/groups"
          className="inline-block rounded-lg bg-accent px-5 py-3 font-semibold text-white hover:bg-accent-strong"
        >
          Sign in to start a group
        </Link>
      </div>
    );
  }

  const groups = await groupsOf(userId);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Groups</h1>
        <p className="text-sm text-muted">Your own table with the people you actually want to beat.</p>
      </div>

      {groups.length > 0 && (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {groups.map((g) => (
            <li key={g.id}>
              <Link href={`/groups/${g.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft font-bold text-accent-strong">
                  {g.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{g.name}</div>
                  <div className="text-xs text-muted">
                    {g.members} {g.members === 1 ? "member" : "members"}
                    {g.owner_id === userId && " · you created it"}
                  </div>
                </div>
                <span className="text-muted" aria-hidden>
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Start a group</h2>
        <CreateGroupForm />
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Have an invite code?</h2>
        <form action={joinGroup} className="flex gap-2">
          <input
            name="code"
            required
            maxLength={8}
            placeholder="8-character code"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 font-mono uppercase outline-none focus:border-accent"
            aria-label="Invite code"
          />
          <button className="rounded-lg border border-border px-4 py-2.5 font-medium hover:border-accent">Join</button>
        </form>
      </section>
    </div>
  );
}
