import { describe, expect, it } from "vitest";
import { Outcome } from "../match";
import { regulationScore, settlementFor } from "./result";

const now = new Date("2026-09-27T20:00:00Z");
const kickoff = "2026-09-27T17:00:00Z";
const closed = new Date(kickoff);

describe("regulationScore", () => {
  it("uses fullTime for matches decided in regulation", () => {
    expect(regulationScore({ duration: "REGULAR", fullTime: { home: 2, away: 1 } })).toEqual({ home: 2, away: 1 });
  });

  it("uses regularTime when a tie went to extra time or penalties", () => {
    const score = { duration: "PENALTY_SHOOTOUT", fullTime: { home: 5, away: 4 }, regularTime: { home: 1, away: 1 } };
    expect(regulationScore(score)).toEqual({ home: 1, away: 1 });
  });

  it("returns null when the score is incomplete", () => {
    expect(regulationScore({ duration: "EXTRA_TIME", fullTime: { home: 2, away: 1 } })).toBeNull();
    expect(regulationScore({ fullTime: { home: null, away: null } })).toBeNull();
  });
});

describe("settlementFor", () => {
  it("resolves finished matches on the regulation result", () => {
    expect(settlementFor({ status: "FINISHED", utcDate: kickoff, score: { fullTime: { home: 0, away: 3 } } }, now, closed)).toEqual({
      action: "resolve",
      outcome: Outcome.AWAY,
    });
    const et = { duration: "EXTRA_TIME", fullTime: { home: 2, away: 1 }, regularTime: { home: 1, away: 1 } };
    expect(settlementFor({ status: "FINISHED", utcDate: kickoff, score: et }, now, closed)).toEqual({
      action: "resolve",
      outcome: Outcome.DRAW,
    });
  });

  it("cancels postponed and cancelled matches", () => {
    expect(settlementFor({ status: "POSTPONED", utcDate: kickoff, score: {} }, now, closed).action).toBe("cancel");
    expect(settlementFor({ status: "CANCELLED", utcDate: kickoff, score: {} }, now, closed).action).toBe("cancel");
  });

  it("waits on suspended matches for a day before cancelling", () => {
    expect(settlementFor({ status: "SUSPENDED", utcDate: kickoff, score: {} }, now, closed).action).toBe("wait");
    const later = new Date("2026-09-29T00:00:00Z");
    expect(settlementFor({ status: "SUSPENDED", utcDate: kickoff, score: {} }, later, closed).action).toBe("cancel");
  });

  it("cancels matches rescheduled away from the on-chain kickoff", () => {
    // postponed to next week: void once the original kickoff has passed
    const moved = { status: "TIMED", utcDate: "2026-10-04T17:00:00Z", score: {} };
    expect(settlementFor(moved, now, closed)).toEqual({ action: "cancel", reason: "Match rescheduled" });
    expect(settlementFor(moved, new Date("2026-09-27T12:00:00Z"), closed).action).toBe("wait");
    // played at a different time than bets closed
    const playedEarlier = { status: "FINISHED", utcDate: "2026-09-26T17:00:00Z", score: { fullTime: { home: 1, away: 0 } } };
    expect(settlementFor(playedEarlier, now, closed).action).toBe("cancel");
  });

  it("tolerates small kickoff adjustments", () => {
    const nudged = { status: "FINISHED", utcDate: "2026-09-27T17:30:00Z", score: { fullTime: { home: 1, away: 0 } } };
    expect(settlementFor(nudged, now, closed)).toEqual({ action: "resolve", outcome: Outcome.HOME });
  });

  it("waits while the match is in play", () => {
    expect(settlementFor({ status: "IN_PLAY", utcDate: kickoff, score: {} }, now, closed).action).toBe("wait");
  });
});
