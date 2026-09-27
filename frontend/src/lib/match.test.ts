import { describe, expect, it } from "vitest";
import {
  MatchStatus,
  Outcome,
  betState,
  estimatePayout,
  impliedMultiplier,
  matchPhase,
  type OnChainMatch,
} from "./match";

const eth = (n: number) => BigInt(Math.round(n * 1000)) * 10n ** 15n;

function match(overrides: Partial<OnChainMatch> = {}): OnChainMatch {
  return {
    matchId: 1n,
    kickoffTime: 1_000n,
    totalPool: eth(8),
    homePool: eth(4),
    drawPool: 0n,
    awayPool: eth(4),
    homeBetCount: 2n,
    drawBetCount: 0n,
    awayBetCount: 1n,
    platformFeeAmount: 0n,
    result: Outcome.NONE,
    status: MatchStatus.OPEN,
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    competition: "Premier League",
    ...overrides,
  };
}

describe("matchPhase", () => {
  const opts = { nowSec: 500n, gracePeriod: 6300n, paused: false, matchPaused: false };

  it("is open before kickoff while status is OPEN", () => {
    expect(matchPhase(match(), opts)).toBe("open");
  });

  it("is not bettable after kickoff even while status is still OPEN", () => {
    expect(matchPhase(match(), { ...opts, nowSec: 1_000n })).toBe("live");
    expect(matchPhase(match(), { ...opts, nowSec: 1_000n + 6300n })).toBe("awaiting");
  });

  it("reports pauses before kickoff", () => {
    expect(matchPhase(match(), { ...opts, matchPaused: true })).toBe("paused");
    expect(matchPhase(match(), { ...opts, paused: true })).toBe("paused");
  });

  it("reports terminal states", () => {
    expect(matchPhase(match({ status: MatchStatus.RESOLVED }), opts)).toBe("resolved");
    expect(matchPhase(match({ status: MatchStatus.CANCELLED }), opts)).toBe("cancelled");
  });
});

describe("betState", () => {
  const resolved = match({ status: MatchStatus.RESOLVED, result: Outcome.HOME, platformFeeAmount: eth(0.08) });

  it("pays winners their share of the pool after fee", () => {
    // 1 of 4 in the home pool: 1 * (8 - 0.08) / 4 = 1.98
    expect(betState(resolved, { amount: eth(1), prediction: Outcome.HOME, claimed: false })).toEqual({
      kind: "won",
      payout: eth(1.98),
      claimed: false,
    });
  });

  it("marks other picks as lost", () => {
    expect(betState(resolved, { amount: eth(4), prediction: Outcome.AWAY, claimed: false })).toEqual({ kind: "lost" });
  });

  it("refunds everyone when nobody picked the result", () => {
    const noWinner = match({ status: MatchStatus.RESOLVED, result: Outcome.DRAW });
    expect(betState(noWinner, { amount: eth(4), prediction: Outcome.AWAY, claimed: true })).toEqual({
      kind: "refund",
      payout: eth(4),
      claimed: true,
    });
  });

  it("returns stakes when everyone picked the result", () => {
    const allHome = match({ status: MatchStatus.RESOLVED, result: Outcome.HOME, totalPool: eth(4), awayPool: 0n });
    expect(betState(allHome, { amount: eth(1), prediction: Outcome.HOME, claimed: false })).toMatchObject({
      kind: "won",
      payout: eth(1),
    });
  });

  it("refunds cancelled matches and leaves open ones pending", () => {
    expect(betState(match({ status: MatchStatus.CANCELLED }), { amount: eth(1), prediction: 1, claimed: false }).kind).toBe(
      "refund",
    );
    expect(betState(match(), { amount: eth(1), prediction: 1, claimed: false }).kind).toBe("pending");
  });
});

describe("odds", () => {
  it("estimates payout like calculatePotentialWinnings", () => {
    // total 9, fee 1% -> 8.91, draw pool becomes 1 -> 8.91
    expect(estimatePayout(match(), Outcome.DRAW, eth(1), 100n)).toBe(eth(8.91));
    expect(estimatePayout(match(), Outcome.DRAW, 0n, 100n)).toBe(0n);
  });

  it("gives implied multipliers and null for empty pools", () => {
    expect(impliedMultiplier(match(), Outcome.HOME, 100n)).toBeCloseTo(1.98);
    expect(impliedMultiplier(match(), Outcome.DRAW, 100n)).toBeNull();
  });
});
