import "server-only";
import type { Profile } from "../auth/types";
import type { PickCounts } from "../picks";
import { toSettled } from "../profileView";
import { getFixture } from "./queries";
import { getPick, pickCounts, picksOf, profileByUsername, type PickRow } from "./social";
import type { FixtureView } from "./types";

export interface PickCard {
  fixture: FixtureView;
  profile: Profile;
  pick: PickRow;
  counts: PickCounts;
  record: { won: number; decided: number };
}

/** Everything a shared pick card shows; null when the person hasn't picked that match */
export async function loadPickCard(fixtureId: number, username: string): Promise<PickCard | null> {
  if (!Number.isInteger(fixtureId) || fixtureId <= 0) return null;
  const [fixture, profile] = await Promise.all([getFixture(fixtureId), profileByUsername(username)]);
  if (!fixture || !profile) return null;
  const pick = await getPick(profile.id, fixtureId);
  if (!pick) return null;
  const [counts, history] = await Promise.all([pickCounts([fixtureId]), picksOf(profile.id, { settledOnly: true })]);
  const decided = toSettled(history).filter((p) => p.result !== "void");
  return {
    fixture,
    profile,
    pick,
    counts: counts.get(fixtureId) ?? { 1: 0, 2: 0, 3: 0 },
    record: { won: decided.filter((p) => p.result === "won").length, decided: decided.length },
  };
}

export function pickedTeam(card: Pick<PickCard, "fixture" | "pick">): string {
  const f = card.fixture;
  if (card.pick.prediction === 2) return "a draw";
  return card.pick.prediction === 1 ? (f.home_short ?? f.home_team) : (f.away_short ?? f.away_team);
}
