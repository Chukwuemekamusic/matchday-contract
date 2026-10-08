/** Text of the public Telegram channel posts (plain text: names never need escaping) */

import type { PickCounts } from "./picks";

export interface DigestFixture {
  home: string;
  away: string;
  competition: string;
  kickoff: Date;
}

export interface ResultFixture {
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  counts: PickCounts;
}

export interface RecapRow {
  name: string;
  points: number;
  won: number;
  played: number;
}

const time = (d: Date, timeZone: string) =>
  d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone, timeZoneName: "short" });
const day = (d: Date, timeZone: string) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone });

export function digestPost(title: string, fixtures: DigestFixture[], url: string, timeZone: string): string {
  const lines = [`⚽ ${title}: picks are open`, ""];
  let currentDay = "";
  for (const f of [...fixtures].sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime())) {
    const d = day(f.kickoff, timeZone);
    if (d !== currentDay) {
      if (currentDay) lines.push("");
      lines.push(d);
      currentDay = d;
    }
    lines.push(`• ${time(f.kickoff, timeZone)}  ${f.home} v ${f.away} (${f.competition})`);
  }
  lines.push("", `Make your free picks: ${url}`);
  return lines.join("\n");
}

function outcomeOf(f: ResultFixture): 1 | 2 | 3 {
  return f.homeScore > f.awayScore ? 1 : f.homeScore < f.awayScore ? 3 : 2;
}

export function resultLine(f: ResultFixture): string {
  const total = f.counts[1] + f.counts[2] + f.counts[3];
  const called = f.counts[outcomeOf(f)];
  const share = total ? Math.round((called / total) * 100) : 0;
  const verdict =
    called === 0 ? "nobody called it 😮" : share < 34 ? `only ${called} called it 🔥` : `${called} called it (${share}%)`;
  return `FT ${f.home} ${f.homeScore}–${f.awayScore} ${f.away} · ${total} picks · ${verdict}`;
}

export function resultsPost(results: ResultFixture[], url: string): string {
  return ["📣 Full time", "", ...results.map(resultLine), "", `See who called it: ${url}`].join("\n");
}

export function recapPost(rows: RecapRow[], url: string): string {
  const medals = ["🥇", "🥈", "🥉"];
  return [
    "🏆 This week's top pickers",
    "",
    ...rows.map((r, i) => `${medals[i] ?? `${i + 1}.`} ${r.name} — ${r.points} pts (${r.won}/${r.played} correct)`),
    "",
    `Full table: ${url}`,
  ].join("\n");
}
