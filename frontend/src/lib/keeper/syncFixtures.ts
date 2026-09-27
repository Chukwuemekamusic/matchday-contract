import "server-only";
import { db } from "../db/client";
import type { FixtureRow } from "../db/types";
import { fetchMatchesBetween, type ApiMatch } from "../football/api";
import { regulationScore } from "../football/result";

export function toFixtureRow(m: ApiMatch): Omit<FixtureRow, "updated_at"> {
  const score = regulationScore(m.score);
  return {
    id: m.id,
    competition_code: m.competition.code,
    competition_name: m.competition.name,
    competition_emblem: m.competition.emblem,
    home_team: m.homeTeam.name ?? "TBD",
    home_short: m.homeTeam.shortName,
    home_crest: m.homeTeam.crest,
    away_team: m.awayTeam.name ?? "TBD",
    away_short: m.awayTeam.shortName,
    away_crest: m.awayTeam.crest,
    kickoff_at: m.utcDate,
    status: m.status,
    home_score: score?.home ?? null,
    away_score: score?.away ?? null,
  };
}

export async function upsertFixtures(matches: ApiMatch[]): Promise<number> {
  const now = new Date().toISOString();
  const rows = matches.map((m) => ({ ...toFixtureRow(m), updated_at: now }));
  if (rows.length === 0) return 0;
  const { error } = await db().from("fixtures").upsert(rows, { onConflict: "id" });
  if (error) throw error;
  return rows.length;
}

/** Pull fixtures from yesterday to a week ahead (football-data free tier allows 10 days per call) */
export async function syncFixtures() {
  const from = new Date(Date.now() - 86400_000);
  const to = new Date(Date.now() + 7 * 86400_000);
  const matches = await fetchMatchesBetween(from, to);
  return { fetched: matches.length, upserted: await upsertFixtures(matches) };
}
