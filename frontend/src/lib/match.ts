/**
 * Pure match/bet logic mirroring MatchDayBetV3. Keep in sync with the contract:
 * every payout rule here must match _calculatePayout / calculatePotentialWinnings.
 */

export const Outcome = { NONE: 0, HOME: 1, DRAW: 2, AWAY: 3 } as const;
export type Outcome = (typeof Outcome)[keyof typeof Outcome];
export type Side = Exclude<Outcome, 0>;
export const SIDES: readonly Side[] = [Outcome.HOME, Outcome.DRAW, Outcome.AWAY];

export const MatchStatus = { OPEN: 0, CLOSED: 1, RESOLVED: 2, CANCELLED: 3 } as const;
export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];

const BASIS_POINTS = 10_000n;

/** Subset of the on-chain Match struct the UI needs */
export interface OnChainMatch {
  matchId: bigint;
  kickoffTime: bigint;
  totalPool: bigint;
  homePool: bigint;
  drawPool: bigint;
  awayPool: bigint;
  homeBetCount: bigint;
  drawBetCount: bigint;
  awayBetCount: bigint;
  platformFeeAmount: bigint;
  result: number;
  status: number;
  homeTeam: string;
  awayTeam: string;
  competition: string;
}

export interface OnChainBet {
  amount: bigint;
  prediction: number;
  claimed: boolean;
}

export function outcomePool(m: Pick<OnChainMatch, "homePool" | "drawPool" | "awayPool">, o: number): bigint {
  if (o === Outcome.HOME) return m.homePool;
  if (o === Outcome.DRAW) return m.drawPool;
  if (o === Outcome.AWAY) return m.awayPool;
  return 0n;
}

export type MatchPhase =
  | "open" // bets accepted
  | "paused" // match or contract paused, before kickoff
  | "live" // kicked off, result not yet resolvable
  | "awaiting" // result window reached, waiting for resolution
  | "resolved"
  | "cancelled";

/**
 * Status OPEN alone does not mean betting is open: the contract keeps OPEN until
 * closeBetting/resolution, but rejects bets from kickoff onwards.
 */
export function matchPhase(
  m: Pick<OnChainMatch, "status" | "kickoffTime">,
  opts: { nowSec: bigint; gracePeriod: bigint; paused: boolean; matchPaused: boolean },
): MatchPhase {
  if (m.status === MatchStatus.RESOLVED) return "resolved";
  if (m.status === MatchStatus.CANCELLED) return "cancelled";
  if (opts.nowSec < m.kickoffTime) {
    if (m.status !== MatchStatus.OPEN) return "live";
    return opts.paused || opts.matchPaused ? "paused" : "open";
  }
  return opts.nowSec >= m.kickoffTime + opts.gracePeriod ? "awaiting" : "live";
}

/** Payout for a bet on a resolved match (contract _calculatePayout) */
export function resolvedPayout(m: OnChainMatch, bet: OnChainBet): bigint {
  const winnerPool = outcomePool(m, m.result);
  if (winnerPool === 0n || winnerPool === m.totalPool) return bet.amount;
  if (bet.prediction !== m.result) return 0n;
  return (bet.amount * (m.totalPool - m.platformFeeAmount)) / winnerPool;
}

export type BetState =
  | { kind: "pending" }
  | { kind: "won"; payout: bigint; claimed: boolean }
  | { kind: "lost" }
  | { kind: "refund"; payout: bigint; claimed: boolean };

export function betState(m: OnChainMatch, bet: OnChainBet): BetState {
  if (m.status === MatchStatus.CANCELLED) return { kind: "refund", payout: bet.amount, claimed: bet.claimed };
  if (m.status !== MatchStatus.RESOLVED) return { kind: "pending" };
  const winnerPool = outcomePool(m, m.result);
  if (winnerPool === 0n) return { kind: "refund", payout: bet.amount, claimed: bet.claimed };
  if (bet.prediction !== m.result) return { kind: "lost" };
  return { kind: "won", payout: resolvedPayout(m, bet), claimed: bet.claimed };
}

/**
 * Estimated payout if `amount` is added to `pick` now (contract calculatePotentialWinnings).
 * Assumes the fee is charged, so it is a slight under-estimate when nobody else bets.
 */
export function estimatePayout(
  pools: Pick<OnChainMatch, "totalPool" | "homePool" | "drawPool" | "awayPool">,
  pick: Side,
  amount: bigint,
  feeBps: bigint,
): bigint {
  if (amount <= 0n) return 0n;
  const total = pools.totalPool + amount;
  const pickPool = outcomePool(pools, pick) + amount;
  const effective = total - (total * feeBps) / BASIS_POINTS;
  return (amount * effective) / pickPool;
}

/** Decimal payout multiplier per outcome (e.g. 2.35), or null when nobody picked it */
export function impliedMultiplier(
  pools: Pick<OnChainMatch, "totalPool" | "homePool" | "drawPool" | "awayPool">,
  pick: Side,
  feeBps: bigint,
): number | null {
  const pool = outcomePool(pools, pick);
  if (pool === 0n) return null;
  const effective = pools.totalPool - (pools.totalPool * feeBps) / BASIS_POINTS;
  return Number((effective * BASIS_POINTS) / pool) / Number(BASIS_POINTS);
}

export function pickLabel(pick: number, home: string, away: string): string {
  if (pick === Outcome.HOME) return home;
  if (pick === Outcome.AWAY) return away;
  if (pick === Outcome.DRAW) return "Draw";
  return "—";
}
