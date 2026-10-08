import type { PickWithFixture } from "./db/social";
import type { SettledPick } from "./profileStats";

export function toSettled(rows: PickWithFixture[]): SettledPick[] {
  return rows
    .filter((r) => r.result && r.settled_at)
    .map((r) => ({
      fixtureId: r.fixture_id,
      prediction: r.prediction,
      result: r.result!,
      points: r.points ?? 0,
      homeTeam: r.fixtures.home_short ?? r.fixtures.home_team,
      awayTeam: r.fixtures.away_short ?? r.fixtures.away_team,
      settledAt: r.settled_at!,
    }));
}
