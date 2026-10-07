import "server-only";
import { db } from "./client";
import type { FixtureRow, FixtureView, OnChainMatchRow } from "./types";

/** Latest non-failed on-chain match per fixture (live ones first, then settled history) */
async function matchIdsFor(fixtureIds: number[]): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (fixtureIds.length === 0) return map;

  const { data, error } = await db()
    .from("onchain_matches")
    .select("fixture_id, match_id, state, created_at")
    .in("fixture_id", fixtureIds)
    .not("match_id", "is", null)
    .order("created_at", { ascending: true });
  if (error) throw error;

  for (const row of data as Pick<OnChainMatchRow, "fixture_id" | "match_id" | "state">[]) {
    map.set(row.fixture_id, row.match_id!); // later rows win
  }
  return map;
}

function withMatchIds(rows: FixtureRow[], ids: Map<number, number>): FixtureView[] {
  return rows.map((f) => ({ ...f, onchain_match_id: ids.get(f.id) ?? null }));
}

/** Fixtures from `hoursBack` ago (covers last weekend and midweek) up to `daysAhead` days out, by kickoff */
export async function listFixtures(hoursBack = 9 * 24, daysAhead = 15): Promise<FixtureView[]> {
  const from = new Date(Date.now() - hoursBack * 3600_000).toISOString();
  const to = new Date(Date.now() + daysAhead * 86400_000).toISOString();

  const { data, error } = await db()
    .from("fixtures")
    .select("*")
    .gte("kickoff_at", from)
    .lte("kickoff_at", to)
    .order("kickoff_at", { ascending: true })
    .limit(500);
  if (error) throw error;

  const rows = data as FixtureRow[];
  return withMatchIds(rows, await matchIdsFor(rows.map((r) => r.id)));
}

export async function getFixture(id: number): Promise<FixtureView | null> {
  const { data, error } = await db().from("fixtures").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return withMatchIds([data as FixtureRow], await matchIdsFor([id]))[0];
}

/** Fixture id for an on-chain match id, if the app created it */
export async function fixtureIdForMatch(matchId: number): Promise<number | null> {
  const { data, error } = await db()
    .from("onchain_matches")
    .select("fixture_id")
    .eq("match_id", matchId)
    .maybeSingle();
  if (error) throw error;
  return (data?.fixture_id as number | undefined) ?? null;
}
