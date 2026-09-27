import { Outcome } from "../match";

/** The parts of a football-data.org v4 match that settlement depends on */
export interface ApiScore {
  duration?: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT" | string;
  fullTime?: { home: number | null; away: number | null };
  regularTime?: { home: number | null; away: number | null } | null;
}

export interface ApiMatchForSettlement {
  status: string;
  utcDate: string;
  score: ApiScore;
}

/**
 * Score after 90 minutes (plus stoppage time), which is what the 1X2 market settles on.
 * football-data's `fullTime` includes extra time and shoot-out goals for knockout ties,
 * so `regularTime` is used whenever the match went beyond regulation.
 */
export function regulationScore(score: ApiScore): { home: number; away: number } | null {
  const s = !score.duration || score.duration === "REGULAR" ? score.fullTime : score.regularTime;
  if (!s || s.home === null || s.away === null) return null;
  return { home: s.home, away: s.away };
}

export function outcomeFromScore(score: { home: number; away: number }): Outcome {
  if (score.home > score.away) return Outcome.HOME;
  if (score.home < score.away) return Outcome.AWAY;
  return Outcome.DRAW;
}

export type Settlement =
  | { action: "resolve"; outcome: Outcome }
  | { action: "cancel"; reason: string }
  | { action: "wait" };

const DAY_MS = 24 * 60 * 60 * 1000;
/** A kickoff moved by more than this is treated as a different event from the one people bet on */
const RESCHEDULE_TOLERANCE_MS = 60 * 60 * 1000;

/**
 * Decide what the keeper should do on-chain with a match, given the API's view of it.
 * `betsClosedAt` is the kickoff the on-chain match was created with.
 */
export function settlementFor(match: ApiMatchForSettlement, now: Date, betsClosedAt: Date): Settlement {
  const kickoff = new Date(match.utcDate).getTime();
  const sinceKickoff = now.getTime() - kickoff;

  // Rescheduled: bets closed at the old time, so the market is void once either kickoff has passed
  if (
    Math.abs(kickoff - betsClosedAt.getTime()) > RESCHEDULE_TOLERANCE_MS &&
    now.getTime() >= Math.min(kickoff, betsClosedAt.getTime())
  ) {
    return { action: "cancel", reason: "Match rescheduled" };
  }

  switch (match.status) {
    case "FINISHED": {
      const score = regulationScore(match.score);
      return score ? { action: "resolve", outcome: outcomeFromScore(score) } : { action: "wait" };
    }
    case "POSTPONED":
      return { action: "cancel", reason: "Match postponed" };
    case "CANCELLED":
      return { action: "cancel", reason: "Match cancelled" };
    case "AWARDED":
      return { action: "cancel", reason: "Match awarded" };
    case "SUSPENDED":
      // Suspended matches are often resumed the same day; only void once that is unlikely
      return sinceKickoff > DAY_MS ? { action: "cancel", reason: "Match suspended" } : { action: "wait" };
    default:
      return { action: "wait" };
  }
}
