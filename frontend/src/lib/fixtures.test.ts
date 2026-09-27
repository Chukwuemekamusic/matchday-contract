import { describe, expect, it } from "vitest";
import { dayLabel, fixtureAcceptsBets, fixtureBucket } from "./fixtures";

const now = new Date(2026, 9, 17, 12, 0); // Sat 17 Oct 2026, local noon

describe("dayLabel", () => {
  it("names nearby days", () => {
    expect(dayLabel(new Date(2026, 9, 17, 20, 0), now)).toBe("Today");
    expect(dayLabel(new Date(2026, 9, 18, 0, 30), now)).toBe("Tomorrow");
    expect(dayLabel(new Date(2026, 9, 16, 23, 0), now)).toBe("Yesterday");
  });

  it("uses a short date further out", () => {
    expect(dayLabel(new Date(2026, 9, 24, 15, 0), now)).toMatch(/24/);
  });
});

describe("fixture buckets", () => {
  const at = (hours: number) => new Date(now.getTime() + hours * 3600_000).toISOString();

  it("sorts fixtures into tabs", () => {
    expect(fixtureBucket({ status: "TIMED", kickoff_at: at(2) }, now.getTime())).toBe("upcoming");
    expect(fixtureBucket({ status: "TIMED", kickoff_at: at(-1) }, now.getTime())).toBe("live");
    expect(fixtureBucket({ status: "IN_PLAY", kickoff_at: at(-1) }, now.getTime())).toBe("live");
    expect(fixtureBucket({ status: "FINISHED", kickoff_at: at(-3) }, now.getTime())).toBe("results");
    expect(fixtureBucket({ status: "POSTPONED", kickoff_at: at(5) }, now.getTime())).toBe("results");
  });

  it("closes betting 3 minutes before kickoff", () => {
    expect(fixtureAcceptsBets({ status: "TIMED", kickoff_at: at(0.1) }, now.getTime())).toBe(true);
    expect(fixtureAcceptsBets({ status: "TIMED", kickoff_at: at(0.04) }, now.getTime())).toBe(false);
    expect(fixtureAcceptsBets({ status: "POSTPONED", kickoff_at: at(5) }, now.getTime())).toBe(false);
  });
});
