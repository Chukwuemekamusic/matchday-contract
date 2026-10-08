import "server-only";
import type { Profile } from "../auth/types";
import type { PickCounts } from "../picks";
import { fetchMatchBets } from "../subgraph";
import { db } from "./client";
import { recentPickers } from "./social";

export interface ActivityEntry {
  key: string;
  name: string;
  /** Seed for the generated avatar */
  seed: string;
  avatarUrl: string | null;
  href: string;
  prediction: 1 | 2 | 3;
  at: Date;
  /** Backed with ETH (amount never shown) */
  withEth: boolean;
}

/** Profiles of accounts that linked any of these wallets */
export async function profilesForWallets(addresses: string[]): Promise<Map<string, Profile>> {
  const map = new Map<string, Profile>();
  if (addresses.length === 0) return map;
  const { data, error } = await db()
    .from("wallets")
    .select("address, profiles!inner(id, username, display_name, avatar_url)")
    .in(
      "address",
      addresses.map((a) => a.toLowerCase()),
    );
  if (error) throw error;
  for (const row of (data ?? []) as unknown as { address: string; profiles: Profile }[]) map.set(row.address, row.profiles);
  return map;
}

export interface MatchActivity {
  /** Everyone, merged per person (free and ETH), per outcome */
  counts: PickCounts;
  /** Newest first */
  entries: ActivityEntry[];
}

/**
 * Everyone who picked a fixture: free picks plus on-chain bettors, merged per person.
 * On-chain bettors show as their linked profile or a short address.
 */
export async function matchActivity(fixtureId: number, matchId: number | null): Promise<MatchActivity> {
  const [pickers, bets] = await Promise.all([
    recentPickers(fixtureId, 1000),
    matchId ? fetchMatchBets(matchId).catch(() => []) : Promise.resolve([]),
  ]);
  const owners = await profilesForWallets(bets.map((b) => b.bettor));

  const byKey = new Map<string, ActivityEntry>();
  for (const p of pickers) {
    byKey.set(p.profile.id, {
      key: p.profile.id,
      name: p.profile.display_name,
      seed: p.profile.id,
      avatarUrl: p.profile.avatar_url,
      href: `/u/${p.profile.username}`,
      prediction: p.prediction,
      at: new Date(p.at),
      withEth: false,
    });
  }
  for (const b of bets) {
    const owner = owners.get(b.bettor.toLowerCase());
    const key = owner?.id ?? b.bettor.toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      // The ETH bet is the binding one when someone did both
      existing.withEth = true;
      existing.prediction = b.prediction;
      continue;
    }
    byKey.set(key, {
      key,
      name: owner?.display_name ?? `${b.bettor.slice(0, 6)}…${b.bettor.slice(-4)}`,
      seed: owner?.id ?? b.bettor,
      avatarUrl: owner?.avatar_url ?? null,
      href: owner ? `/u/${owner.username}` : `/u/${b.bettor}`,
      prediction: b.prediction,
      at: b.placedAt,
      withEth: true,
    });
  }

  const entries = [...byKey.values()].sort((a, b) => b.at.getTime() - a.at.getTime());
  const counts: PickCounts = { 1: 0, 2: 0, 3: 0 };
  for (const e of entries) counts[e.prediction]++;
  return { counts, entries };
}
