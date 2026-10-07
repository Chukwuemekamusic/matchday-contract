import type { FixtureView } from "./db/types";

export type FixtureState =
  | "open" // taking bets
  | "closing" // kicks off within 3 minutes; no longer taking bets
  | "live" // in play (or just kicked off)
  | "ended" // should be over but the final score hasn't synced yet
  | "finished"
  | "postponed"
  | "cancelled";

const LIVE_STATUSES = new Set(["IN_PLAY", "PAUSED", "LIVE", "EXTRA_TIME", "PENALTY_SHOOTOUT", "SUSPENDED"]);
/** A match is assumed over this long after kickoff even if the status hasn't synced */
const MATCH_LENGTH_MS = 2.5 * 3600_000;

export function fixtureState(f: Pick<FixtureView, "status" | "kickoff_at">, nowMs: number): FixtureState {
  if (f.status === "FINISHED") return "finished";
  if (f.status === "POSTPONED") return "postponed";
  if (f.status === "CANCELLED" || f.status === "AWARDED") return "cancelled";
  const sinceKickoff = nowMs - new Date(f.kickoff_at).getTime();
  if (LIVE_STATUSES.has(f.status)) return "live";
  if (sinceKickoff >= 0) return sinceKickoff < MATCH_LENGTH_MS ? "live" : "ended";
  return fixtureAcceptsBets(f, nowMs) ? "open" : "closing";
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

/** Local calendar-day key (YYYY-MM-DD in the viewer's time zone) used to group fixtures */
export function localDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** "Today", "Tomorrow", "Yesterday" or e.g. "Sat 18 Oct" */
export function dayLabel(date: Date, now: Date): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(date) - startOfDay(now)) / 86400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
