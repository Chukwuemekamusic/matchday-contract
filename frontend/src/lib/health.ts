/** Operational health rules for the keeper. Pure, so the thresholds are unit tested. */

export type Severity = "warn" | "critical";

export interface HealthIssue {
  key: string;
  severity: Severity;
  /** Safe to show publicly */
  message: string;
  /** Internal detail (errors, addresses) for the admin page and private alerts only */
  detail?: string;
}

export interface HealthInput {
  /** null when the keeper env is invalid; detail explains why */
  keeper: { address: string; balanceWei: bigint | null } | null;
  keeperError?: string;
  minBalanceWei: bigint;
  lastResolveOk: Date | null;
  lastSyncOk: Date | null;
  lastResolveError?: string;
  /** Kickoffs of on-chain matches that are still open */
  openKickoffs: Date[];
  stuckCreating: number;
  failedCreations24h: number;
}

const MIN = 60_000;
const HOUR = 60 * MIN;

const ago = (date: Date, now: Date) => {
  const minutes = Math.round((now.getTime() - date.getTime()) / MIN);
  return minutes < 120 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`;
};

export function evaluateHealth(input: HealthInput, now: Date): HealthIssue[] {
  const issues: HealthIssue[] = [];

  if (!input.keeper) {
    issues.push({
      key: "keeper_config",
      severity: "critical",
      message: "Keeper is not configured",
      detail: input.keeperError,
    });
  } else if (input.keeper.balanceWei === null) {
    issues.push({ key: "keeper_balance_unknown", severity: "warn", message: "Could not read the keeper wallet balance" });
  } else if (input.keeper.balanceWei < input.minBalanceWei) {
    issues.push({
      key: "keeper_balance_low",
      severity: "critical",
      message: "Keeper wallet is low on ETH for gas",
      detail: `${input.keeper.address} holds ${input.keeper.balanceWei} wei`,
    });
  }

  // pg_cron calls resolve every 10 minutes
  if (!input.lastResolveOk || now.getTime() - input.lastResolveOk.getTime() > 30 * MIN) {
    issues.push({
      key: "resolve_stale",
      severity: "critical",
      message: input.lastResolveOk
        ? `Results job last succeeded ${ago(input.lastResolveOk, now)}`
        : "Results job has never succeeded",
      detail: input.lastResolveError,
    });
  }

  // sync runs every 6 hours
  const syncAge = input.lastSyncOk ? now.getTime() - input.lastSyncOk.getTime() : Infinity;
  if (syncAge > 13 * HOUR) {
    issues.push({
      key: "sync_stale",
      severity: syncAge > 36 * HOUR ? "critical" : "warn",
      message: input.lastSyncOk ? `Fixture sync last succeeded ${ago(input.lastSyncOk, now)}` : "Fixture sync has never succeeded",
    });
  }

  // A match normally settles about 2 hours after kickoff
  const overdue = input.openKickoffs.filter((k) => now.getTime() - k.getTime() > 6 * HOUR);
  if (overdue.length > 0) {
    const veryLate = overdue.some((k) => now.getTime() - k.getTime() > 24 * HOUR);
    issues.push({
      key: "settlement_overdue",
      severity: veryLate ? "critical" : "warn",
      message: `${overdue.length} match${overdue.length === 1 ? " is" : "es are"} overdue for settlement`,
    });
  }

  if (input.stuckCreating > 0) {
    issues.push({ key: "creation_stuck", severity: "warn", message: `${input.stuckCreating} match creation(s) stuck` });
  }
  if (input.failedCreations24h > 0) {
    issues.push({
      key: "creation_failed",
      severity: "warn",
      message: `${input.failedCreations24h} match creation(s) failed in the last 24 h`,
    });
  }

  return issues;
}
