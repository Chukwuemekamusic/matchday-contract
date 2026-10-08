import "server-only";
import type { Profile } from "../auth/types";
import type { PickCounts } from "../picks";
import { db } from "./client";

export interface PickRow {
  user_id: string;
  fixture_id: number;
  prediction: 1 | 2 | 3;
  created_at: string;
  updated_at: string;
  result: "won" | "lost" | "void" | null;
  points: number | null;
  settled_at: string | null;
}

export interface PointsRow {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  points: number;
  played: number;
  won: number;
}

const emptyCounts = (): PickCounts => ({ 1: 0, 2: 0, 3: 0 });

export async function pickCounts(fixtureIds: number[]): Promise<Map<number, PickCounts>> {
  const map = new Map<number, PickCounts>();
  if (fixtureIds.length === 0) return map;
  const { data, error } = await db().rpc("fixture_pick_counts", { fixture_ids: fixtureIds });
  if (error) throw error;
  for (const row of (data ?? []) as { fixture_id: number; prediction: 1 | 2 | 3; picks: number }[]) {
    const counts = map.get(row.fixture_id) ?? emptyCounts();
    counts[row.prediction] = Number(row.picks);
    map.set(row.fixture_id, counts);
  }
  return map;
}

export async function getPick(userId: string, fixtureId: number): Promise<PickRow | null> {
  const { data, error } = await db().from("picks").select("*").eq("user_id", userId).eq("fixture_id", fixtureId).maybeSingle();
  if (error) throw error;
  return data as PickRow | null;
}

export interface RecentPicker {
  profile: Profile;
  prediction: 1 | 2 | 3;
  at: string;
}

/** Most recent free picks on a fixture, with who made them (amounts never involved) */
export async function recentPickers(fixtureId: number, limit = 12): Promise<RecentPicker[]> {
  const { data, error } = await db()
    .from("picks")
    .select("prediction, updated_at, profiles!inner(id, username, display_name, avatar_url)")
    .eq("fixture_id", fixtureId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as { prediction: 1 | 2 | 3; updated_at: string; profiles: Profile }[]).map((r) => ({
    profile: r.profiles,
    prediction: r.prediction,
    at: r.updated_at,
  }));
}

export async function pointsTable(opts: { since?: Date; groupId?: string; limit?: number } = {}): Promise<PointsRow[]> {
  const { data, error } = await db().rpc("points_table", {
    since: opts.since?.toISOString() ?? null,
    member_of: opts.groupId ?? null,
    max_rows: opts.limit ?? 100,
  });
  if (error) throw error;
  return ((data ?? []) as PointsRow[]).map((r) => ({
    ...r,
    points: Number(r.points),
    played: Number(r.played),
    won: Number(r.won),
  }));
}

export async function profileByUsername(username: string): Promise<(Profile & { created_at: string }) | null> {
  const { data, error } = await db()
    .from("profiles")
    .select("id, username, display_name, avatar_url, created_at")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data as (Profile & { created_at: string }) | null;
}

export async function walletsOf(userId: string): Promise<string[]> {
  const { data, error } = await db().from("wallets").select("address").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((w) => w.address as string);
}

export interface PickWithFixture extends PickRow {
  fixtures: {
    home_team: string;
    away_team: string;
    home_short: string | null;
    away_short: string | null;
    kickoff_at: string;
    competition_name: string;
    home_score: number | null;
    away_score: number | null;
  };
}

const PICK_WITH_FIXTURE =
  "*, fixtures!inner(home_team, away_team, home_short, away_short, kickoff_at, competition_name, home_score, away_score)";

/** A user's most recently made picks with their fixtures, returned newest kickoff first */
export async function picksOf(userId: string, opts: { settledOnly?: boolean; limit?: number } = {}): Promise<PickWithFixture[]> {
  let q = db().from("picks").select(PICK_WITH_FIXTURE).eq("user_id", userId);
  if (opts.settledOnly) q = q.not("settled_at", "is", null);
  const { data, error } = await q.order("updated_at", { ascending: false }).limit(opts.limit ?? 1000);
  if (error) throw error;
  return ((data ?? []) as PickWithFixture[]).sort(
    (a, b) => new Date(b.fixtures.kickoff_at).getTime() - new Date(a.fixtures.kickoff_at).getTime(),
  );
}
