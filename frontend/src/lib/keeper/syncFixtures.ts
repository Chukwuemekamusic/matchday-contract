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

const DAY_MS = 86400_000;

/**
 * Pull fixtures from yesterday to two weeks ahead. football-data's free tier allows at most
 * 10 days per request, so the window is fetched in two chunks.
 */
export async function syncFixtures() {
  const day = (offset: number) => new Date(Date.now() + offset * DAY_MS);
  const chunks = await Promise.all([fetchMatchesBetween(day(-1), day(8)), fetchMatchesBetween(day(9), day(14))]);
  const matches = chunks.flat();
  return { fetched: matches.length, upserted: await upsertFixtures(matches) };
}
