import { describe, expect, it } from "vitest";
import { defaultRoundKey, roundDates, roundName, roundOf, roundsFor } from "./rounds";

// Local-time dates: October 2026 — Fri 9, Sat 10, Sun 11, Mon 12, Tue 13, Wed 14, Thu 15, Fri 16
const at = (day: number, hour = 15, month = 9) => new Date(2026, month, day, hour);

describe("roundOf", () => {
  it("puts Friday to Monday in one weekend", () => {
    for (const day of [9, 10, 11, 12]) expect(roundOf(at(day))).toMatchObject({ key: "2026-10-09", kind: "weekend" });
    expect(roundOf(at(12, 23)).key).toBe("2026-10-09"); // Monday night football
  });

  it("puts Tuesday to Thursday in one midweek", () => {
    for (const day of [13, 14, 15]) expect(roundOf(at(day))).toMatchObject({ key: "2026-10-13", kind: "midweek" });
    expect(roundOf(at(16, 0)).key).toBe("2026-10-16"); // just after midnight Thursday: next weekend
  });

  it("ends rounds at local midnight after the last day", () => {
    expect(roundOf(at(10)).end).toEqual(new Date(2026, 9, 13));
    expect(roundOf(at(14)).end).toEqual(new Date(2026, 9, 16));
  });
});

describe("roundName", () => {
  it("names rounds relative to a Saturday", () => {
    const now = at(10);
    expect(roundName(roundOf(at(11)), now)).toBe("This weekend");
    expect(roundName(roundOf(at(14)), now)).toBe("Midweek");
    expect(roundName(roundOf(at(17)), now)).toBe("Next weekend");
    expect(roundName(roundOf(at(21)), now)).toBe("Next midweek");
    expect(roundName(roundOf(at(3)), now)).toBe("Last weekend");
    expect(roundName(roundOf(at(7)), now)).toBe("Last midweek");
    expect(roundName(roundOf(at(24)), now)).toBeNull();
  });

  it("calls the coming weekend 'This weekend' during the week", () => {
    const wednesday = at(14);
    expect(roundName(roundOf(at(14)), wednesday)).toBe("Midweek");
    expect(roundName(roundOf(at(17)), wednesday)).toBe("This weekend");
    expect(roundName(roundOf(at(10)), wednesday)).toBe("Last weekend");
  });
});

describe("roundDates", () => {
  it("formats ranges within and across months", () => {
    expect(roundDates(roundOf(at(10)))).toMatch(/^9–12 Oct/);
    expect(roundDates(roundOf(at(31)))).toMatch(/^30 Oct – 2 Nov/);
  });
});

describe("rounds for fixtures", () => {
  it("lists distinct rounds in order", () => {
    expect(roundsFor([at(17), at(10), at(11), at(14)]).map((r) => r.key)).toEqual([
      "2026-10-09",
      "2026-10-13",
      "2026-10-16",
    ]);
  });

  it("opens on the round with today's games, even after kickoff", () => {
    const sunEvening = at(11, 21);
    expect(defaultRoundKey([at(10), at(11, 16), at(14), at(17)], sunEvening)).toBe("2026-10-09");
  });

  it("moves on once the round's last day is over", () => {
    const tuesday = at(13, 9);
    expect(defaultRoundKey([at(10), at(11), at(14), at(17)], tuesday)).toBe("2026-10-13");
    // international break: nothing until the following weekend
    expect(defaultRoundKey([at(10), at(24)], tuesday)).toBe("2026-10-23");
  });

  it("falls back to the latest round when everything is in the past", () => {
    expect(defaultRoundKey([at(3), at(10)], at(13))).toBe("2026-10-09");
    expect(defaultRoundKey([], at(13))).toBeNull();
  });
});
