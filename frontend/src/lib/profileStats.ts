/** Derived, rule-based profile facts from a person's settled free picks */

export interface SettledPick {
  fixtureId: number;
  prediction: 1 | 2 | 3;
  result: "won" | "lost" | "void";
  points: number;
  homeTeam: string;
  awayTeam: string;
  settledAt: string;
}

const decided = (picks: SettledPick[]) => picks.filter((p) => p.result !== "void");

/** Consecutive correct picks, most recent first */
export function currentStreak(picks: SettledPick[]): number {
  const sorted = decided(picks).sort((a, b) => b.settledAt.localeCompare(a.settledAt));
  let streak = 0;
  for (const p of sorted) {
    if (p.result !== "won") break;
    streak++;
  }
  return streak;
}

/** The team they back most often (draws don't count), if any team stands out */
export function signatureTeam(picks: SettledPick[]): string | null {
  const counts = new Map<string, number>();
  for (const p of picks) {
    if (p.prediction === 2) continue;
    const team = p.prediction === 1 ? p.homeTeam : p.awayTeam;
    counts.set(team, (counts.get(team) ?? 0) + 1);
  }
  const [best] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return best && best[1] >= 3 ? best[0] : null;
}

/** A short, evidence-based label for how someone picks */
export function styleLabel(picks: SettledPick[]): string {
  const d = decided(picks);
  if (d.length < 5) return "New face";
  const share = (n: number) => n / d.length;
  const draws = d.filter((p) => p.prediction === 2).length;
  const homes = d.filter((p) => p.prediction === 1).length;
  const aways = d.filter((p) => p.prediction === 3).length;
  const wins = d.filter((p) => p.result === "won");
  const calledIt = wins.filter((p) => p.points > 3).length;

  if (calledIt >= 3 && calledIt / Math.max(wins.length, 1) >= 0.25) return "Upset hunter";
  if (d.length >= 10 && share(wins.length) >= 0.6) return "Sharp shooter";
  if (share(draws) >= 0.4) return "Draw specialist";
  if (share(aways) >= 0.5) return "Away-day believer";
  if (share(homes) >= 0.7) return "Home banker";
  return "All-rounder";
}

export interface HeadToHead {
  shared: number;
  /** Matches where only `a` was right */
  a: number;
  /** Matches where only `b` was right */
  b: number;
}

/** Compare two people on the matches they both picked (void matches don't count) */
export function headToHead(a: SettledPick[], b: SettledPick[]): HeadToHead {
  const theirs = new Map(decided(b).map((p) => [p.fixtureId, p]));
  const out: HeadToHead = { shared: 0, a: 0, b: 0 };
  for (const p of decided(a)) {
    const q = theirs.get(p.fixtureId);
    if (!q) continue;
    out.shared++;
    if (p.result === "won" && q.result !== "won") out.a++;
    if (q.result === "won" && p.result !== "won") out.b++;
  }
  return out;
}
