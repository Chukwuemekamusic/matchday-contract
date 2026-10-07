/**
 * European football runs in two rhythms: weekend rounds (Fri–Mon) and midweek rounds
 * (Tue–Thu, mostly Champions League). Fixtures are grouped into those rounds using the
 * viewer's local time, so a Friday- or Monday-night game lands in its weekend.
 */

export type RoundKind = "weekend" | "midweek";

export interface Round {
  /** Local date of the first day (Fri or Tue), YYYY-MM-DD; also used in the URL */
  key: string;
  kind: RoundKind;
  /** Local midnight of the first day */
  start: Date;
  /** Local midnight after the last day (exclusive) */
  end: Date;
}

const DAY_MS = 86400_000;

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Days since the round started, by weekday (Sun=0 … Sat=6)
const WEEKEND_OFFSET: Record<number, number> = { 5: 0, 6: 1, 0: 2, 1: 3 };
const MIDWEEK_OFFSET: Record<number, number> = { 2: 0, 3: 1, 4: 2 };

export function roundOf(date: Date): Round {
  const day = date.getDay();
  const kind: RoundKind = day in WEEKEND_OFFSET ? "weekend" : "midweek";
  const start = addDays(startOfDay(date), -(kind === "weekend" ? WEEKEND_OFFSET[day] : MIDWEEK_OFFSET[day]));
  return { key: dateKey(start), kind, start, end: addDays(start, kind === "weekend" ? 4 : 3) };
}

/** Start of the round of `kind` that is in progress now, or the next one to begin */
function currentOrNextStart(kind: RoundKind, now: Date): Date {
  const r = roundOf(now);
  if (r.kind === kind) return r.start;
  // A midweek is followed by a weekend 3 days after it starts; a weekend by a midweek 4 days after
  return addDays(r.start, r.kind === "midweek" ? 3 : 4);
}

/** "This weekend", "Next midweek", "Last weekend" … or null when further away */
export function roundName(round: Round, now: Date): string | null {
  const weeks = Math.round((round.start.getTime() - currentOrNextStart(round.kind, now).getTime()) / (7 * DAY_MS));
  const noun = round.kind === "weekend" ? "weekend" : "midweek";
  if (weeks === 0) return round.kind === "weekend" ? "This weekend" : "Midweek";
  if (weeks === 1) return `Next ${noun}`;
  if (weeks === -1) return `Last ${noun}`;
  return null;
}

/** "10–13 Oct" or "31 Oct – 3 Nov" */
export function roundDates(round: Round): string {
  const last = addDays(round.end, -1);
  const month = (d: Date) => d.toLocaleDateString(undefined, { month: "short" });
  return round.start.getMonth() === last.getMonth()
    ? `${round.start.getDate()}–${last.getDate()} ${month(last)}`
    : `${round.start.getDate()} ${month(round.start)} – ${last.getDate()} ${month(last)}`;
}

/** Distinct rounds of the given kickoffs, in chronological order */
export function roundsFor(kickoffs: Date[]): Round[] {
  const byKey = new Map<string, Round>();
  for (const k of kickoffs) {
    const r = roundOf(k);
    if (!byKey.has(r.key)) byKey.set(r.key, r);
  }
  return [...byKey.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * The round to open on: the earliest one with a match today or later, so today's games —
 * including ones already kicked off — stay visible until the day is over.
 */
export function defaultRoundKey(kickoffs: Date[], now: Date): string | null {
  const today = startOfDay(now).getTime();
  const upcoming = kickoffs.filter((k) => k.getTime() >= today).sort((a, b) => a.getTime() - b.getTime());
  if (upcoming.length) return roundOf(upcoming[0]).key;
  const rounds = roundsFor(kickoffs);
  return rounds.at(-1)?.key ?? null;
}
