import "server-only";
import type { ApiScore } from "./result";

const BASE_URL = "https://api.football-data.org/v4";

export const SUPPORTED_COMPETITIONS = (process.env.FOOTBALL_COMPETITIONS ?? "PL,PD,BL1,SA,FL1,CL")
  .split(",")
  .map((c) => c.trim())
  .filter(Boolean);

interface ApiTeam {
  id: number | null;
  name: string | null;
  shortName: string | null;
  tla: string | null;
  crest: string | null;
}

export interface ApiMatch {
  id: number;
  utcDate: string;
  status: string;
  competition: { id: number; name: string; code: string; emblem: string | null };
  homeTeam: ApiTeam;
  awayTeam: ApiTeam;
  score: ApiScore;
}

async function request<T>(path: string): Promise<T> {
  const token = process.env.FOOTBALL_DATA_API_KEY;
  if (!token) throw new Error("FOOTBALL_DATA_API_KEY is not set");

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-Auth-Token": token },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`football-data ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Matches in the supported competitions between two dates (free tier: max 10 day range) */
export async function fetchMatchesBetween(from: Date, to: Date): Promise<ApiMatch[]> {
  const params = new URLSearchParams({
    competitions: SUPPORTED_COMPETITIONS.join(","),
    dateFrom: isoDate(from),
    dateTo: isoDate(to),
  });
  const data = await request<{ matches: ApiMatch[] }>(`/matches?${params}`);
  return data.matches;
}

/** Current state of specific matches by football-data id */
export async function fetchMatchesByIds(ids: number[]): Promise<ApiMatch[]> {
  const out: ApiMatch[] = [];
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20);
    const data = await request<{ matches: ApiMatch[] }>(`/matches?ids=${chunk.join(",")}`);
    out.push(...data.matches);
  }
  return out;
}
