"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShareButton } from "@/components/ShareButton";
import { pickLabel, SIDES, type Side } from "@/lib/match";
import { pickShares, totalPicks, type PickCounts } from "@/lib/picks";

export interface MyPick {
  prediction: Side;
  result: "won" | "lost" | "void" | null;
  points: number | null;
}

interface Props {
  fixtureId: number;
  home: string;
  away: string;
  counts: PickCounts;
  myPick: MyPick | null;
  /** Username of the signed-in user, null when signed out */
  username: string | null;
  /** Picks lock at kickoff */
  locked: boolean;
  shareUrl: string | null;
}

export function FreePick({ fixtureId, home, away, counts, myPick, username, locked, shareUrl }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<Side | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shares = pickShares(counts);
  const total = totalPicks(counts);

  async function pick(side: Side) {
    setError(null);
    setPending(side);
    try {
      const res = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtureId, prediction: side }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not save your pick");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your pick");
    } finally {
      setPending(null);
    }
  }

  const signInHref = `/signin?next=${encodeURIComponent(`/match/${fixtureId}`)}`;

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">Your pick</h2>
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-strong">Free</span>
        <span className="ml-auto text-xs text-muted">
          {total} {total === 1 ? "fan has" : "fans have"} picked
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {SIDES.map((side) => {
          const mine = myPick?.prediction === side;
          const content = (
            <>
              <span className="block truncate text-sm font-semibold">{pickLabel(side, home, away)}</span>
              <span className="mt-1 block text-xs text-muted">{total ? `${shares[side]}%` : "—"}</span>
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${shares[side]}%` }} />
              </span>
            </>
          );
          const cls = `rounded-xl border p-3 text-center transition ${
            mine ? "border-accent bg-accent-soft" : "border-border hover:border-accent"
          } ${locked ? "cursor-default" : ""}`;
          if (!username && !locked) {
            return (
              <Link key={side} href={signInHref} className={cls}>
                {content}
              </Link>
            );
          }
          return (
            <button
              key={side}
              disabled={locked || pending !== null || mine}
              onClick={() => pick(side)}
              aria-pressed={mine}
              className={`${cls} disabled:opacity-100 ${pending === side ? "animate-pulse" : ""}`}
            >
              {content}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <p className="flex-1 text-muted">
          {!username && !locked && (
            <>
              <Link href={signInHref} className="font-medium text-accent-strong underline">
                Sign in
              </Link>{" "}
              to make a free pick — no wallet needed.
            </>
          )}
          {username && !locked && !myPick && "Tap an outcome. You can change your pick until kickoff."}
          {myPick && !locked && `You picked ${pickLabel(myPick.prediction, home, away)}. You can change it until kickoff.`}
          {locked && !myPick && "Picks closed at kickoff."}
          {locked && myPick && myPick.result === null && "Picks are locked. Good luck!"}
          {myPick?.result === "won" && (
            <span className="font-semibold text-accent-strong">
              You called it: +{myPick.points} points{(myPick.points ?? 0) > 3 ? " (including the called-it bonus)" : ""}
            </span>
          )}
          {myPick?.result === "lost" && "Not this time — no points."}
          {myPick?.result === "void" && "This match was called off, so picks were voided."}
        </p>
        {myPick && shareUrl && (
          <ShareButton
            url={shareUrl}
            text={`I'm backing ${pickLabel(myPick.prediction, home, away)} in ${home} vs ${away}. Think I'm wrong? Make your pick on MatchDay:`}
            label="Share my pick"
          />
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </section>
  );
}
