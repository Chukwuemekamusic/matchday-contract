import { describe, expect, it } from "vitest";
import { digestPost, recapPost, resultLine } from "./channelPosts";

describe("channel posts", () => {
  it("groups the digest by day in the channel's time zone", () => {
    const post = digestPost(
      "This weekend",
      [
        { home: "Arsenal", away: "Chelsea", competition: "Premier League", kickoff: new Date("2026-10-10T16:30:00Z") },
        { home: "Inter", away: "Napoli", competition: "Serie A", kickoff: new Date("2026-10-11T18:45:00Z") },
      ],
      "https://matchday.app",
      "Africa/Lagos",
    );
    expect(post).toContain("This weekend: picks are open");
    expect(post).toMatch(/Saturday 10 Oct\n• 17:30 \S+\s+Arsenal v Chelsea \(Premier League\)/);
    expect(post).toMatch(/Sunday 11 Oct\n• 19:45/);
    expect(post.endsWith("Make your free picks: https://matchday.app")).toBe(true);
  });

  it("describes how many people called a result", () => {
    const counts = { 1: 6, 2: 2, 3: 2 } as const;
    expect(resultLine({ home: "Arsenal", away: "Chelsea", homeScore: 2, awayScore: 1, counts })).toBe(
      "FT Arsenal 2–1 Chelsea · 10 picks · 6 called it (60%)",
    );
    expect(resultLine({ home: "Arsenal", away: "Chelsea", homeScore: 0, awayScore: 1, counts })).toContain("only 2 called it");
    expect(resultLine({ home: "A", away: "B", homeScore: 1, awayScore: 1, counts: { 1: 3, 2: 0, 3: 1 } })).toContain(
      "nobody called it",
    );
  });

  it("ranks the weekly recap", () => {
    const post = recapPost(
      [
        { name: "Ada", points: 14, won: 4, played: 6 },
        { name: "Tobi", points: 9, won: 3, played: 7 },
      ],
      "https://matchday.app/leaderboard",
    );
    expect(post).toContain("🥇 Ada — 14 pts (4/6 correct)");
    expect(post).toContain("🥈 Tobi — 9 pts");
  });
});
