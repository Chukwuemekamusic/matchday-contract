import "server-only";
import { digestPost, recapPost, resultsPost, type ResultFixture } from "../channelPosts";
import { db } from "../db/client";
import { pickCounts, pointsTable } from "../db/social";
import type { FixtureRow } from "../db/types";
import { channelEnv } from "../env";
import { roundOf } from "../rounds";
import { siteUrl } from "../site";

const HOUR = 3600_000;

/** Reserve a post key; false when it was already posted (or is being posted) */
async function claim(key: string): Promise<boolean> {
  const { error } = await db().from("channel_posts").insert({ key });
  if (error?.code === "23505") return false;
  if (error) throw error;
  return true;
}

async function release(keys: string[]) {
  if (keys.length) await db().from("channel_posts").delete().in("key", keys);
}

async function send(token: string, chatId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Telegram channel post failed: ${res.status} ${await res.text()}`);
}

/** Claim keys, send once, and un-claim if sending fails so the next run retries */
async function post(keys: string[], text: string) {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID } = channelEnv();
  try {
    await send(TELEGRAM_BOT_TOKEN!, TELEGRAM_CHANNEL_ID!, text);
  } catch (err) {
    await release(keys);
    throw err;
  }
}

function enabled() {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID } = channelEnv();
  return Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHANNEL_ID);
}

/** "Picks are open" for the current weekend/midweek round, once, from 06:00 UTC on its first day */
export async function postDigestIfDue(now = new Date()) {
  if (!enabled()) return { skipped: "channel not configured" };
  const round = roundOf(now);
  if (now.getTime() < round.start.getTime() + 6 * HOUR) return { skipped: "too early" };

  const { data, error } = await db()
    .from("fixtures")
    .select("home_team, away_team, home_short, away_short, competition_name, kickoff_at")
    .in("status", ["SCHEDULED", "TIMED"])
    .gte("kickoff_at", now.toISOString())
    .lt("kickoff_at", round.end.toISOString());
  if (error) throw error;
  const fixtures = (data ?? []) as Pick<FixtureRow, "home_team" | "away_team" | "home_short" | "away_short" | "competition_name" | "kickoff_at">[];
  if (fixtures.length === 0) return { skipped: "no fixtures" };

  const key = `digest:${round.key}`;
  if (!(await claim(key))) return { skipped: "already posted" };
  const { CHANNEL_TIMEZONE } = channelEnv();
  await post(
    [key],
    digestPost(
      round.kind === "weekend" ? "This weekend" : "Midweek",
      fixtures.map((f) => ({
        home: f.home_short ?? f.home_team,
        away: f.away_short ?? f.away_team,
        competition: f.competition_name,
        kickoff: new Date(f.kickoff_at),
      })),
      siteUrl().origin,
      CHANNEL_TIMEZONE,
    ),
  );
  return { posted: key, fixtures: fixtures.length };
}

/** One post per run listing newly finished matches that people picked */
export async function postResults(now = new Date()) {
  if (!enabled()) return { skipped: "channel not configured" };
  const { data, error } = await db()
    .from("fixtures")
    .select("id, home_team, away_team, home_short, away_short, home_score, away_score")
    .eq("status", "FINISHED")
    .not("home_score", "is", null)
    .gte("kickoff_at", new Date(now.getTime() - 36 * HOUR).toISOString());
  if (error) throw error;
  const finished = (data ?? []) as Pick<FixtureRow, "id" | "home_team" | "away_team" | "home_short" | "away_short" | "home_score" | "away_score">[];
  if (finished.length === 0) return { posted: 0 };

  const counts = await pickCounts(finished.map((f) => f.id));
  const { CHANNEL_MIN_PICKS } = channelEnv();
  const claimed: string[] = [];
  const results: ResultFixture[] = [];
  for (const f of finished) {
    const c = counts.get(f.id);
    if (!c || c[1] + c[2] + c[3] < CHANNEL_MIN_PICKS) continue;
    const key = `result:${f.id}`;
    if (!(await claim(key))) continue;
    claimed.push(key);
    results.push({
      home: f.home_short ?? f.home_team,
      away: f.away_short ?? f.away_team,
      homeScore: f.home_score!,
      awayScore: f.away_score!,
      counts: c,
    });
  }
  if (results.length) await post(claimed, resultsPost(results, siteUrl().origin));
  return { posted: results.length };
}

/** Monday from 09:00 UTC: last 7 days' top 5 */
export async function postRecapIfDue(now = new Date()) {
  if (!enabled()) return { skipped: "channel not configured" };
  if (now.getUTCDay() !== 1 || now.getUTCHours() < 9) return { skipped: "not due" };
  const rows = await pointsTable({ since: new Date(now.getTime() - 7 * 24 * HOUR), limit: 5 });
  if (rows.length === 0) return { skipped: "no settled picks" };

  const key = `recap:${now.toISOString().slice(0, 10)}`;
  if (!(await claim(key))) return { skipped: "already posted" };
  await post(
    [key],
    recapPost(
      rows.map((r) => ({ name: r.display_name, points: r.points, won: r.won, played: r.played })),
      `${siteUrl().origin}/leaderboard`,
    ),
  );
  return { posted: key };
}
