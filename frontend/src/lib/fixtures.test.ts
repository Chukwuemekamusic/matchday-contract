import { describe, expect, it } from "vitest";
import { dayLabel, fixtureAcceptsBets, fixtureState } from "./fixtures";

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

describe("fixture states", () => {
  const at = (hours: number) => new Date(now.getTime() + hours * 3600_000).toISOString();
  const state = (status: string, hours: number) => fixtureState({ status, kickoff_at: at(hours) }, now.getTime());

  it("tracks a fixture through match day", () => {
    expect(state("TIMED", 2)).toBe("open");
    expect(state("TIMED", 0.04)).toBe("closing");
    expect(state("TIMED", -0.5)).toBe("live"); // kicked off, status not synced yet
    expect(state("IN_PLAY", -1)).toBe("live");
    expect(state("TIMED", -3)).toBe("ended");
    expect(state("FINISHED", -3)).toBe("finished");
  });

  it("keeps suspended matches live and reports postponements", () => {
    expect(state("SUSPENDED", -4)).toBe("live");
    expect(state("POSTPONED", 5)).toBe("postponed");
    expect(state("CANCELLED", 5)).toBe("cancelled");
  });

  it("closes betting 3 minutes before kickoff", () => {
    expect(fixtureAcceptsBets({ status: "TIMED", kickoff_at: at(0.1) }, now.getTime())).toBe(true);
    expect(fixtureAcceptsBets({ status: "TIMED", kickoff_at: at(0.04) }, now.getTime())).toBe(false);
    expect(fixtureAcceptsBets({ status: "POSTPONED", kickoff_at: at(5) }, now.getTime())).toBe(false);
  });
});
