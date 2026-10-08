import { describe, expect, it } from "vitest";
import { pickShares, pointsForWinner } from "./picks";

describe("pointsForWinner", () => {
  it("gives 3 points for a popular correct pick", () => {
    expect(pointsForWinner({ 1: 6, 2: 2, 3: 2 }, 1)).toBe(3);
  });

  it("adds the called-it bonus when under a third picked the result", () => {
    expect(pointsForWinner({ 1: 6, 2: 2, 3: 2 }, 3)).toBe(5);
    expect(pointsForWinner({ 1: 2, 2: 1, 3: 0 }, 2)).toBe(3); // exactly 1/3 is not under a third
  });

  it("needs at least 3 picks for the bonus", () => {
    expect(pointsForWinner({ 1: 1, 2: 0, 3: 1 }, 3)).toBe(3);
  });
});

describe("pickShares", () => {
  it("splits picks into percentages", () => {
    expect(pickShares({ 1: 1, 2: 1, 3: 2 })).toEqual({ 1: 25, 2: 25, 3: 50 });
    expect(pickShares({ 1: 0, 2: 0, 3: 0 })).toEqual({ 1: 0, 2: 0, 3: 0 });
  });
});
