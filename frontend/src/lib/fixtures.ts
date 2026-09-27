import type { FixtureView } from "./db/types";

export type FixtureBucket = "upcoming" | "live" | "results";

const LIVE_STATUSES = new Set(["IN_PLAY", "PAUSED", "LIVE", "EXTRA_TIME", "PENALTY_SHOOTOUT", "SUSPENDED"]);
const DONE_STATUSES = new Set(["FINISHED", "AWARDED", "POSTPONED", "CANCELLED"]);

/** Which tab a fixture belongs in */
export function fixtureBucket(f: Pick<FixtureView, "status" | "kickoff_at">, nowMs: number): FixtureBucket {
  if (DONE_STATUSES.has(f.status)) return "results";
  if (LIVE_STATUSES.has(f.status) || new Date(f.kickoff_at).getTime() <= nowMs) return "live";
  return "upcoming";
}

/** Bets close at kickoff; the server refuses to create matches with less than 3 minutes to go */
export function fixtureAcceptsBets(f: Pick<FixtureView, "status" | "kickoff_at">, nowMs: number): boolean {
  return (f.status === "SCHEDULED" || f.status === "TIMED") && new Date(f.kickoff_at).getTime() - nowMs > 3 * 60_000;
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    SCHEDULED: "Scheduled",
    TIMED: "Scheduled",
    IN_PLAY: "Live",
    LIVE: "Live",
    PAUSED: "Half-time",
    EXTRA_TIME: "Extra time",
    PENALTY_SHOOTOUT: "Penalties",
    FINISHED: "Full time",
    SUSPENDED: "Suspended",
    POSTPONED: "Postponed",
    CANCELLED: "Cancelled",
    AWARDED: "Awarded",
  };
  return labels[status] ?? status;
}

/** Request time for dynamic server components (rendered once per request, so reading the clock is intended) */
export function requestTime(): number {
  return Date.now();
}
