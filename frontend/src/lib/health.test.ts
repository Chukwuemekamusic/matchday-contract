import { describe, expect, it } from "vitest";
import { evaluateHealth, type HealthInput } from "./health";

const now = new Date("2026-10-10T18:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

const healthy: HealthInput = {
  keeper: { address: "0xkeeper", balanceWei: 10n ** 16n },
  minBalanceWei: 2n * 10n ** 15n,
  lastResolveOk: minutesAgo(5),
  lastSyncOk: minutesAgo(120),
  openKickoffs: [minutesAgo(60)],
  stuckCreating: 0,
  failedCreations24h: 0,
};

const keys = (input: Partial<HealthInput>) => evaluateHealth({ ...healthy, ...input }, now).map((i) => `${i.key}:${i.severity}`);

describe("evaluateHealth", () => {
  it("reports nothing when everything is fine", () => {
    expect(evaluateHealth(healthy, now)).toEqual([]);
  });

  it("flags keeper config and balance problems", () => {
    expect(keys({ keeper: null, keeperError: "bad key" })).toEqual(["keeper_config:critical"]);
    expect(keys({ keeper: { address: "0xkeeper", balanceWei: 10n ** 15n } })).toEqual(["keeper_balance_low:critical"]);
    expect(keys({ keeper: { address: "0xkeeper", balanceWei: null } })).toEqual(["keeper_balance_unknown:warn"]);
  });

  it("flags a results job that stopped running", () => {
    expect(keys({ lastResolveOk: minutesAgo(25) })).toEqual([]);
    expect(keys({ lastResolveOk: minutesAgo(45) })).toEqual(["resolve_stale:critical"]);
    expect(keys({ lastResolveOk: null })).toEqual(["resolve_stale:critical"]);
  });

  it("escalates a stale fixture sync", () => {
    expect(keys({ lastSyncOk: minutesAgo(14 * 60) })).toEqual(["sync_stale:warn"]);
    expect(keys({ lastSyncOk: minutesAgo(40 * 60) })).toEqual(["sync_stale:critical"]);
  });

  it("flags matches that should have settled", () => {
    expect(keys({ openKickoffs: [minutesAgo(7 * 60)] })).toEqual(["settlement_overdue:warn"]);
    expect(keys({ openKickoffs: [minutesAgo(7 * 60), minutesAgo(30 * 60)] })).toEqual(["settlement_overdue:critical"]);
    expect(evaluateHealth({ ...healthy, openKickoffs: [minutesAgo(7 * 60), minutesAgo(8 * 60)] }, now)[0].message).toBe(
      "2 matches are overdue for settlement",
    );
  });

  it("flags stuck and failed match creations", () => {
    expect(keys({ stuckCreating: 1, failedCreations24h: 2 })).toEqual(["creation_stuck:warn", "creation_failed:warn"]);
  });
});
