"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useReadContract } from "wagmi";
import { LocalTime } from "@/components/LocalTime";
import { Crest } from "@/components/Team";
import { PoolBar } from "@/components/PoolBar";
import { useHydrated } from "@/hooks/useHydrated";
import { useProtocol } from "@/hooks/useProtocol";
import { matchDayBet } from "@/lib/contract/config";
import type { FixtureView } from "@/lib/db/types";
import { dayLabel, fixtureAcceptsBets, fixtureBucket, localDayKey, statusLabel, type FixtureBucket } from "@/lib/fixtures";
import { formatEth } from "@/lib/format";
import { Outcome, impliedMultiplier, type OnChainMatch } from "@/lib/match";

const TABS: { key: FixtureBucket; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "live", label: "Live & settling" },
  { key: "results", label: "Results" },
];

export function FixtureList({ fixtures, serverNow }: { fixtures: FixtureView[]; serverNow: number }) {
  // Start from the server's clock so the first client render matches, then tick
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const [tab, setTab] = useState<FixtureBucket>("upcoming");
  const [competition, setCompetition] = useState<string>("all");

  const competitions = useMemo(() => {
    const seen = new Map<string, string>();
    fixtures.forEach((f) => seen.set(f.competition_code, f.competition_name));
    return [...seen.entries()];
  }, [fixtures]);

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

  const hydrated = useHydrated();

  const visible = useMemo(() => {
    const list = fixtures.filter(
      (f) => fixtureBucket(f, now) === tab && (competition === "all" || f.competition_code === competition),
    );
    return tab === "results" ? list.reverse() : list;
  }, [fixtures, now, tab, competition]);

  // Day headings depend on the viewer's time zone, so they're only built after hydration
  const days = useMemo(() => {
    const groups: { key: string; label: string; fixtures: FixtureView[] }[] = [];
    if (!hydrated) return groups;
    for (const f of visible) {
      const kickoff = new Date(f.kickoff_at);
      const key = localDayKey(kickoff);
      if (groups.at(-1)?.key !== key) groups.push({ key, label: dayLabel(kickoff, new Date(now)), fixtures: [] });
      groups.at(-1)!.fixtures.push(f);
    }
    return groups;
  }, [visible, hydrated, now]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border bg-surface p-1 text-sm">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-pressed={tab === t.key}
              className={`rounded-md px-3 py-1.5 ${tab === t.key ? "bg-accent text-white" : "text-muted hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <select
          value={competition}
          onChange={(e) => setCompetition(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          aria-label="Competition"
        >
          <option value="all">All competitions</option>
          {competitions.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <EmptyState tab={tab} filtered={competition !== "all"} />
      ) : !hydrated ? (
        <ul className="space-y-2" aria-busy>
          {visible.slice(0, 6).map((f) => (
            <li key={f.id} className="h-[5.75rem] animate-pulse rounded-xl border border-border bg-surface" />
          ))}
        </ul>
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <section key={day.key} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{day.label}</h2>
              <ul className="space-y-2">
                {day.fixtures.map((f) => (
                  <FixtureRow
                    key={f.id}
                    fixture={f}
                    match={f.onchain_match_id ? byMatchId.get(f.onchain_match_id) : undefined}
                    feeBps={feeBps}
                    now={now}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ tab, filtered }: { tab: FixtureBucket; filtered: boolean }) {
  const text =
    tab === "upcoming"
      ? filtered
        ? "No fixtures for this competition in the next two weeks."
        : "No fixtures in the next two weeks — the leagues are probably on an international break. Check back soon."
      : tab === "live"
        ? "No matches in play or waiting for results right now."
        : "No results from the last two days.";
  return <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">{text}</p>;
}

function FixtureRow({
  fixture: f,
  match,
  feeBps,
  now,
}: {
  fixture: FixtureView;
  match?: OnChainMatch;
  feeBps: bigint;
  now: number;
}) {
  const open = fixtureAcceptsBets(f, now);
  const hasScore = f.home_score !== null && f.away_score !== null;
  const kickoff = new Date(f.kickoff_at);

  return (
    <li>
      <Link
        href={`/match/${f.id}`}
        className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-border bg-surface p-4 transition hover:border-accent sm:grid-cols-[5.5rem_1fr_13rem]"
      >
        <div className="hidden text-sm font-medium sm:block">
          <LocalTime date={kickoff} format="time" />
        </div>

        <div className="min-w-0 space-y-1.5">
          <div className="text-[11px] uppercase tracking-wide text-muted">
            {f.competition_name}
            <span className="sm:hidden">
              {" · "}
              <LocalTime date={kickoff} format="time" />
            </span>
          </div>
          {[
            { name: f.home_short ?? f.home_team, crest: f.home_crest, score: f.home_score },
            { name: f.away_short ?? f.away_team, crest: f.away_crest, score: f.away_score },
          ].map((t) => (
            <div key={t.name} className="flex items-center gap-2">
              <Crest src={t.crest} name={t.name} size={20} />
              <span className="truncate font-medium">{t.name}</span>
              {hasScore && <span className="ml-auto font-mono font-semibold sm:ml-2">{t.score}</span>}
            </div>
          ))}
        </div>

        <div className="space-y-2 text-right text-xs">
          {match && match.totalPool > 0n ? (
            <>
              <div className="flex justify-end gap-2 font-mono">
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
              <div className="text-muted">Pool {formatEth(match.totalPool)} ETH</div>
            </>
          ) : open ? (
            <span className="inline-block rounded-full bg-accent-soft px-2.5 py-1 font-medium text-accent-strong">
              No bets yet — be first
            </span>
          ) : (
            <span className="text-muted">{statusLabel(f.status)}</span>
          )}
        </div>
      </Link>
    </li>
  );
}
