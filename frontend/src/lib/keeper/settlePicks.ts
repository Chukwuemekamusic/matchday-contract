import "server-only";
import { db } from "../db/client";
import type { FixtureRow } from "../db/types";
import { fetchMatchesByIds, type ApiMatch } from "../football/api";
import { settlementFor, type ApiMatchForSettlement } from "../football/result";
import { pointsForWinner, type PickCounts } from "../picks";
import { upsertFixtures } from "./syncFixtures";

/** Matches are normally over ~2 h after kickoff */
const SETTLE_AFTER_MS = 2 * 3600_000;
/** Cap API lookups per run (football-data free tier: 10 requests/minute) */
const MAX_API_LOOKUPS = 40;

const DONE = new Set(["FINISHED", "POSTPONED", "CANCELLED", "AWARDED"]);

/** Turn a stored fixture row into the shape the settlement rules expect */
function fromRow(f: FixtureRow): ApiMatchForSettlement {
  return {
    status: f.status,
    utcDate: f.kickoff_at,
    score: { duration: "REGULAR", fullTime: { home: f.home_score, away: f.away_score } },
  };
}

/**
 * Score free picks on finished fixtures (3 points, +2 when under a third called it) and void
 * them on postponed/cancelled ones. Independent of on-chain matches: most free picks are on
 * fixtures nobody has bet ETH on.
 */
export async function settlePicks() {
  const summary = { fixtures: 0, settled: 0, voided: 0, waiting: 0 };

  const { data: open, error } = await db().from("picks").select("fixture_id").is("settled_at", null);
  if (error) throw error;
  const fixtureIds = [...new Set((open ?? []).map((r) => r.fixture_id as number))];
  if (fixtureIds.length === 0) return summary;

  const { data: rows, error: fixturesError } = await db().from("fixtures").select("*").in("id", fixtureIds);
  if (fixturesError) throw fixturesError;
  const cutoff = Date.now() - SETTLE_AFTER_MS;
  const due = (rows as FixtureRow[]).filter((f) => DONE.has(f.status) || new Date(f.kickoff_at).getTime() < cutoff);

  // Use the stored result when it's final; otherwise ask the API (and store what it says)
  const storedIsFinal = (f: FixtureRow) =>
    DONE.has(f.status) && (f.status !== "FINISHED" || (f.home_score !== null && f.away_score !== null));
  const needApi = due.filter((f) => !storedIsFinal(f));
  let api = new Map<number, ApiMatch>();
  if (needApi.length) {
    const fetched = await fetchMatchesByIds(needApi.slice(0, MAX_API_LOOKUPS).map((f) => f.id));
    await upsertFixtures(fetched);
    api = new Map(fetched.map((m) => [m.id, m]));
  }

  const now = new Date();
  const settledAt = now.toISOString();
  for (const f of due) {
    const source = api.get(f.id) ?? fromRow(f);
    // Free picks lock at the current kickoff, so a rescheduled match simply moves with it
    const decision = settlementFor(source, now, new Date(source.utcDate));
    if (decision.action === "wait") {
      summary.waiting++;
      continue;
    }
    summary.fixtures++;

    if (decision.action === "cancel") {
      const { count } = await db()
        .from("picks")
        .update({ result: "void", points: 0, settled_at: settledAt }, { count: "exact" })
        .eq("fixture_id", f.id)
        .is("settled_at", null);
      summary.voided += count ?? 0;
      continue;
    }

    const outcome = decision.outcome as 1 | 2 | 3;
    const { data: picks } = await db().from("picks").select("prediction").eq("fixture_id", f.id);
    const counts: PickCounts = { 1: 0, 2: 0, 3: 0 };
    for (const p of picks ?? []) counts[p.prediction as 1 | 2 | 3]++;

    const won = await db()
      .from("picks")
      .update({ result: "won", points: pointsForWinner(counts, outcome), settled_at: settledAt }, { count: "exact" })
      .eq("fixture_id", f.id)
      .eq("prediction", outcome)
      .is("settled_at", null);
    const lost = await db()
      .from("picks")
      .update({ result: "lost", points: 0, settled_at: settledAt }, { count: "exact" })
      .eq("fixture_id", f.id)
      .neq("prediction", outcome)
      .is("settled_at", null);
    if (won.error) throw won.error;
    if (lost.error) throw lost.error;
    summary.settled += (won.count ?? 0) + (lost.count ?? 0);
  }
  return summary;
}
