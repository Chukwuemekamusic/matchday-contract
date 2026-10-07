"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useReadContract } from "wagmi";
import { LocalTime } from "@/components/LocalTime";
import { PoolBar } from "@/components/PoolBar";
import { Crest } from "@/components/Team";
import { useHydrated } from "@/hooks/useHydrated";
import { useProtocol } from "@/hooks/useProtocol";
import { matchDayBet } from "@/lib/contract/config";
import type { FixtureView } from "@/lib/db/types";
import { dayLabel, fixtureState, localDayKey, statusLabel, type FixtureState } from "@/lib/fixtures";
import { formatEth } from "@/lib/format";
import { MatchStatus, Outcome, impliedMultiplier, type OnChainMatch } from "@/lib/match";
import { defaultRoundKey, roundDates, roundName, roundOf, roundsFor } from "@/lib/rounds";

const COLLAPSED_KEY = "matchday:collapsed-competitions";

function loadCollapsed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

interface Props {
  fixtures: FixtureView[];
  serverNow: number;
  /** From the URL (?round=YYYY-MM-DD&c=PL) */
  initialRound?: string;
  initialCompetition?: string;
}

export function FixtureList({ fixtures, serverNow, initialRound, initialCompetition }: Props) {
  // Start from the server's clock so the first client render matches, then tick
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  // Rounds and days depend on the viewer's time zone, so they're only computed after hydration
  const hydrated = useHydrated();

  const kickoffs = useMemo(() => fixtures.map((f) => new Date(f.kickoff_at)), [fixtures]);
  const rounds = useMemo(() => (hydrated ? roundsFor(kickoffs) : []), [hydrated, kickoffs]);
  const defaultRound = useMemo(() => (hydrated ? defaultRoundKey(kickoffs, new Date(now)) : null), [hydrated, kickoffs, now]);

  const [chosenRound, setChosenRound] = useState<string | undefined>(initialRound);
  const roundKey = rounds.some((r) => r.key === chosenRound) ? chosenRound! : defaultRound;
  const [competition, setCompetition] = useState(initialCompetition ?? "all");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => (typeof window === "undefined" ? new Set() : loadCollapsed()));

  // Keep the selection in the URL so back/forward and shared links work (no server round-trip)
  function select(next: { round?: string | null; competition?: string }) {
    const round = next.round === undefined ? roundKey : next.round;
    const comp = next.competition ?? competition;
    if (next.round !== undefined) setChosenRound(round ?? undefined);
    if (next.competition !== undefined) setCompetition(comp);
    const params = new URLSearchParams();
    if (round && round !== defaultRound) params.set("round", round);
    if (comp !== "all") params.set("c", comp);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }

  function toggleCompetition(code: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
      } catch {
        // storage unavailable: the preference lasts for this visit only
      }
      return next;
    });
  }

  const matchIds = useMemo(
    () => fixtures.filter((f) => f.onchain_match_id !== null).map((f) => BigInt(f.onchain_match_id!)),
    [fixtures],
  );
  const { data: onChain } = useReadContract({
    ...matchDayBet,
    functionName: "getMatches",
    args: [matchIds],
    query: { enabled: matchIds.length > 0, refetchInterval: 30_000 },
  });
  const byMatchId = useMemo(() => {
    const map = new Map<number, OnChainMatch>();
    onChain?.forEach((m) => map.set(Number(m.matchId), m));
    return map;
  }, [onChain]);
  const { feeBps } = useProtocol();

  const inRound = useMemo(
    () =>
      roundKey
        ? fixtures
            .filter((f) => roundOf(new Date(f.kickoff_at)).key === roundKey)
            .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
        : [],
    [fixtures, roundKey],
  );
  const competitions = useMemo(() => {
    const seen = new Map<string, string>();
    fixtures.forEach((f) => seen.set(f.competition_code, f.competition_name));
    return [...seen.entries()];
  }, [fixtures]);
  const availableCodes = useMemo(() => new Set(inRound.map((f) => f.competition_code)), [inRound]);
  // If the chosen competition has no fixtures in this round, display falls back to "all" —
  // the stored selection is preserved so switching back to a round that has it re-activates the filter.
  const effectiveCompetition = competition === "all" || availableCodes.has(competition) ? competition : "all";

  // Day → competition → fixtures, in kickoff order
  const days = useMemo(() => {
    const out: { key: string; label: string; groups: { code: string; name: string; fixtures: FixtureView[] }[] }[] = [];
    for (const f of inRound) {
      if (effectiveCompetition !== "all" && f.competition_code !== effectiveCompetition) continue;
      const kickoff = new Date(f.kickoff_at);
      const key = localDayKey(kickoff);
      let day = out.find((d) => d.key === key);
      if (!day) out.push((day = { key, label: dayLabel(kickoff, new Date(now)), groups: [] }));
      let group = day.groups.find((g) => g.code === f.competition_code);
      if (!group) day.groups.push((group = { code: f.competition_code, name: f.competition_name, fixtures: [] }));
      group.fixtures.push(f);
    }
    return out;
  }, [inRound, effectiveCompetition, now]);

  if (!hydrated) {
    return (
      <div className="space-y-3" aria-busy>
        <div className="h-14 animate-pulse rounded-xl bg-surface" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-surface" />
        ))}
      </div>
    );
  }

  if (rounds.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
        No fixtures in the next two weeks — the leagues are probably on an international break. Check back soon.
      </p>
    );
  }

  const nowDate = new Date(now);

  return (
    <div className="space-y-5">
      <nav aria-label="Rounds" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {rounds.map((r) => {
          const count = fixtures.filter((f) => roundOf(new Date(f.kickoff_at)).key === r.key).length;
          const active = r.key === roundKey;
          return (
            <button
              key={r.key}
              onClick={() => select({ round: r.key })}
              aria-pressed={active}
              className={`shrink-0 rounded-xl border px-4 py-2 text-left ${
                active ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-accent"
              }`}
            >
              <div className={`text-sm font-semibold ${active ? "text-accent-strong" : ""}`}>
                {roundName(r, nowDate) ?? (r.kind === "weekend" ? "Weekend" : "Midweek")}
              </div>
              <div className="whitespace-nowrap text-xs text-muted">
                {roundDates(r)} · {count} {count === 1 ? "match" : "matches"}
              </div>
            </button>
          );
        })}
      </nav>

      {competitions.length > 1 && (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 text-sm">
          {[["all", "All"] as const, ...competitions].map(([code, name]) => {
            const unavailable = code !== "all" && !availableCodes.has(code);
            const active = effectiveCompetition === code;
            return (
              <button
                key={code}
                onClick={() => select({ competition: code })}
                aria-pressed={active}
                disabled={unavailable}
                title={unavailable ? "No matches in this round" : undefined}
                className={`shrink-0 rounded-full px-3 py-1 ${
                  active
                    ? "bg-foreground text-background"
                    : unavailable
                      ? "cursor-not-allowed bg-surface-muted/50 text-muted/50"
                      : "bg-surface-muted text-muted hover:text-foreground"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}

      {days.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
          No matches for this competition in this round.{" "}
          <button className="underline" onClick={() => select({ competition: "all" })}>
            Show all
          </button>
        </p>
      ) : (
        days.map((day) => (
          <section key={day.key} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{day.label}</h2>
            {day.groups.map((g) => {
              const isCollapsed = collapsed.has(g.code);
              return (
                <div key={g.code} className="overflow-hidden rounded-xl border border-border bg-surface">
                  <button
                    onClick={() => toggleCompetition(g.code)}
                    aria-expanded={!isCollapsed}
                    className="flex w-full items-center gap-2 bg-surface-muted/60 px-4 py-2 text-left text-sm font-medium"
                  >
                    {g.name}
                    <span className="text-xs font-normal text-muted">{g.fixtures.length}</span>
                    <span className={`ml-auto text-muted transition-transform ${isCollapsed ? "-rotate-90" : ""}`} aria-hidden>
                      ▾
                    </span>
                  </button>
                  {!isCollapsed && (
                    <ul className="divide-y divide-border">
                      {g.fixtures.map((f) => (
                        <FixtureRow
                          key={f.id}
                          fixture={f}
                          state={fixtureState(f, now)}
                          match={f.onchain_match_id ? byMatchId.get(f.onchain_match_id) : undefined}
                          feeBps={feeBps}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}

function StateMarker({ state, fixture }: { state: FixtureState; fixture: FixtureView }) {
  switch (state) {
    case "open":
    case "closing":
      return <LocalTime date={fixture.kickoff_at} format="time" />;
    case "live":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-danger">
          <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
          {fixture.status === "PAUSED" ? "HT" : fixture.status === "SUSPENDED" ? "SUSP" : "LIVE"}
        </span>
      );
    case "finished":
    case "ended":
      return <span className="text-xs font-semibold text-muted">FT</span>;
    case "postponed":
      return <span className="text-xs font-semibold text-warning">PP</span>;
    case "cancelled":
      return <span className="text-xs font-semibold text-muted">—</span>;
  }
}

function FixtureRow({
  fixture: f,
  state,
  match,
  feeBps,
}: {
  fixture: FixtureView;
  state: FixtureState;
  match?: OnChainMatch;
  feeBps: bigint;
}) {
  const showScore = state === "finished" && f.home_score !== null && f.away_score !== null;
  const pool = match?.totalPool ?? 0n;
  const bets = match ? Number(match.homeBetCount + match.drawBetCount + match.awayBetCount) : 0;
  const activity = pool > 0n ? `${bets} ${bets === 1 ? "bet" : "bets"} · ${formatEth(pool)} ETH` : null;

  let status: ReactNode;
  if (state === "open") {
    status =
      match && pool > 0n ? (
        <div className="space-y-1.5">
          <div className="flex justify-end gap-1.5 font-mono text-xs">
            {[Outcome.HOME, Outcome.DRAW, Outcome.AWAY].map((side, i) => {
              const x = impliedMultiplier(match, side, feeBps);
              return (
                <span key={side} className="rounded bg-surface-muted px-1.5 py-0.5" title="Current payout multiplier">
                  {["1", "X", "2"][i]} {x ? `${x.toFixed(2)}×` : "—"}
                </span>
              );
            })}
          </div>
          <PoolBar pools={match} />
          <div className="text-xs text-muted">{activity}</div>
        </div>
      ) : (
        <span className="inline-block rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-strong">
          Be the first to bet
        </span>
      );
  } else if (state === "postponed" || state === "cancelled") {
    status = (
      <span className="text-xs text-muted">
        {statusLabel(f.status)}
        {activity && " · stakes refundable"}
      </span>
    );
  } else {
    const settled =
      match?.status === MatchStatus.RESOLVED ? "Settled" : match?.status === MatchStatus.CANCELLED ? "Refunded" : null;
    const label =
      state === "finished" || state === "ended" ? (activity ? (settled ?? "Settling…") : "No bets") : "Betting closed";
    status = (
      <div className="text-xs">
        <div className="text-muted">{label}</div>
        {activity && <div className="font-medium text-foreground">{activity}</div>}
      </div>
    );
  }

  return (
    <li>
      <Link
        href={`/match/${f.id}`}
        className="grid grid-cols-[4.5rem_1fr] items-center gap-x-3 gap-y-2 px-4 py-3 transition hover:bg-surface-muted sm:grid-cols-[4.5rem_1fr_15rem]"
      >
        <div className="whitespace-nowrap text-sm font-medium">
          <StateMarker state={state} fixture={f} />
        </div>
        <div className="min-w-0 space-y-1">
          {[
            { name: f.home_short ?? f.home_team, crest: f.home_crest, score: f.home_score },
            { name: f.away_short ?? f.away_team, crest: f.away_crest, score: f.away_score },
          ].map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <Crest src={t.crest} name={t.name} size={18} />
              <span className="truncate">{t.name}</span>
              {showScore && <span className="ml-auto font-mono font-semibold sm:ml-3">{t.score}</span>}
            </div>
          ))}
        </div>
        <div className="col-start-2 sm:col-start-auto sm:text-right">{status}</div>
      </Link>
    </li>
  );
}
