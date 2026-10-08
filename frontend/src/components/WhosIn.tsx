import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import type { MatchActivity } from "@/lib/db/activity";
import { pickLabel, SIDES } from "@/lib/match";
import { timeAgo } from "@/lib/timeAgo";

/** Who picked what — people and sides only; stake amounts are never shown */
export function WhosIn({ activity, home, away, now }: { activity: MatchActivity; home: string; away: string; now: Date }) {
  const { entries, counts } = activity;
  if (entries.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">
        Nobody has picked this match yet. Be the first — and share it with your friends.
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Who&apos;s in</h2>
      <div className="grid grid-cols-3 gap-2">
        {SIDES.map((side) => {
          const people = entries.filter((e) => e.prediction === side);
          return (
            <div key={side} className="space-y-2 rounded-xl bg-surface-muted p-3">
              <div className="truncate text-xs text-muted">{pickLabel(side, home, away)}</div>
              <div className="font-mono text-lg font-semibold">{counts[side]}</div>
              <div className="flex -space-x-2">
                {people.slice(0, 5).map((p) => (
                  <span key={p.key} className="rounded-full ring-2 ring-surface-muted" title={p.name}>
                    <Avatar name={p.name} seed={p.seed} src={p.avatarUrl} size={24} />
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <ul className="divide-y divide-border">
        {entries.slice(0, 10).map((e) => (
          <li key={e.key} className="flex items-center gap-3 py-2 text-sm">
            <Avatar name={e.name} seed={e.seed} src={e.avatarUrl} size={28} />
            <div className="min-w-0 flex-1">
              <Link href={e.href} className="font-medium hover:underline">
                {e.name}
              </Link>{" "}
              <span className="text-muted">picked</span> <span className="font-medium">{pickLabel(e.prediction, home, away)}</span>
              {e.withEth && (
                <span className="ml-2 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent-strong">
                  ETH
                </span>
              )}
            </div>
            <span className="shrink-0 text-xs text-muted">{timeAgo(e.at, now)}</span>
          </li>
        ))}
      </ul>
      {entries.length > 10 && <p className="text-xs text-muted">and {entries.length - 10} more</p>}
    </section>
  );
}
