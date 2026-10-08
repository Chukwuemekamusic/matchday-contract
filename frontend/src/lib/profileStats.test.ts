import { describe, expect, it } from "vitest";
import { currentStreak, headToHead, signatureTeam, styleLabel, type SettledPick } from "./profileStats";

let n = 0;
function pick(prediction: 1 | 2 | 3, result: SettledPick["result"], extra: Partial<SettledPick> = {}): SettledPick {
  n++;
  return {
    fixtureId: n,
    prediction,
    result,
    points: result === "won" ? 3 : 0,
    homeTeam: "Arsenal",
    awayTeam: `Away ${n}`,
    settledAt: `2026-10-${String(n).padStart(2, "0")}T20:00:00Z`,
    ...extra,
  };
}

describe("currentStreak", () => {
  it("counts consecutive wins from the latest, skipping voids", () => {
    const picks = [pick(1, "lost"), pick(1, "won"), pick(2, "void"), pick(3, "won")];
    expect(currentStreak(picks)).toBe(2);
    expect(currentStreak([...picks, pick(1, "lost")])).toBe(0);
  });
});

describe("signatureTeam", () => {
  it("finds the most-backed team once it's backed 3+ times", () => {
    expect(signatureTeam([pick(1, "won"), pick(1, "lost"), pick(1, "won"), pick(2, "won")])).toBe("Arsenal");
    expect(signatureTeam([pick(1, "won"), pick(2, "lost")])).toBeNull();
  });
});

describe("styleLabel", () => {
  it("needs five decided picks", () => {
    expect(styleLabel([pick(2, "won"), pick(2, "lost")])).toBe("New face");
  });

  it("recognises draw lovers and upset hunters", () => {
    expect(styleLabel([pick(2, "won"), pick(2, "lost"), pick(1, "lost"), pick(2, "lost"), pick(3, "lost")])).toBe(
      "Draw specialist",
    );
    const upsets = [1, 2, 3].map(() => pick(3, "won", { points: 5 }));
    expect(styleLabel([...upsets, pick(1, "lost"), pick(1, "lost")])).toBe("Upset hunter");
  });

  it("falls back to home banker and all-rounder", () => {
    expect(styleLabel([1, 2, 3, 4, 5].map(() => pick(1, "lost")))).toBe("Home banker");
    expect(styleLabel([pick(1, "lost"), pick(1, "lost"), pick(3, "lost"), pick(2, "lost"), pick(3, "won")])).toBe(
      "All-rounder",
    );
  });
});

describe("headToHead", () => {
  it("scores shared matches where only one of them was right", () => {
    const a = [pick(1, "won", { fixtureId: 100 }), pick(1, "won", { fixtureId: 101 }), pick(2, "lost", { fixtureId: 102 })];
    const b = [pick(3, "lost", { fixtureId: 100 }), pick(1, "won", { fixtureId: 101 }), pick(3, "won", { fixtureId: 102 })];
    expect(headToHead(a, b)).toEqual({ shared: 3, a: 1, b: 1 });
    expect(headToHead(a, [pick(1, "won", { fixtureId: 999 })]).shared).toBe(0);
  });
});
