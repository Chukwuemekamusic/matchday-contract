/** Free-pick scoring. Kept deliberately simple so it's easy to explain on the how-it-works page. */

export const POINTS_CORRECT = 3;
export const POINTS_CALLED_IT_BONUS = 2;
/** The bonus needs a real crowd to beat */
const BONUS_MIN_PICKS = 3;
const BONUS_MAX_SHARE = 1 / 3;

export type PickCounts = Record<1 | 2 | 3, number>;

export function totalPicks(counts: PickCounts): number {
  return counts[1] + counts[2] + counts[3];
}

/** Points for a correct pick, given how many people picked each outcome */
export function pointsForWinner(counts: PickCounts, outcome: 1 | 2 | 3): number {
  const total = totalPicks(counts);
  const calledIt = total >= BONUS_MIN_PICKS && counts[outcome] / total < BONUS_MAX_SHARE;
  return POINTS_CORRECT + (calledIt ? POINTS_CALLED_IT_BONUS : 0);
}

/** Percent split of picks per outcome (rounded, may not sum to exactly 100) */
export function pickShares(counts: PickCounts): PickCounts {
  const total = totalPicks(counts);
  if (total === 0) return { 1: 0, 2: 0, 3: 0 };
  return {
    1: Math.round((counts[1] / total) * 100),
    2: Math.round((counts[2] / total) * 100),
    3: Math.round((counts[3] / total) * 100),
  };
}
