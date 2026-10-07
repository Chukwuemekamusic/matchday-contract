import "server-only";
import { parseEther } from "viem";
import { db } from "../db/client";
import { alertEnv } from "../env";
import { evaluateHealth, type HealthInput, type HealthIssue } from "../health";
import { keeperWallet, publicClient } from "./chain";

export interface HealthReport {
  ok: boolean;
  status: "ok" | "degraded" | "down";
  checkedAt: string;
  issues: HealthIssue[];
}

async function lastRun(job: string, ok?: boolean) {
  let q = db().from("keeper_runs").select("started_at, summary").eq("job", job);
  if (ok !== undefined) q = q.eq("ok", ok);
  const { data, error } = await q.order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data as { started_at: string; summary: { error?: string } | null } | null;
}

async function count(state: string, column: "updated_at" | "created_at", op: "lt" | "gt", since: Date) {
  const { count: n, error } = await db()
    .from("onchain_matches")
    .select("id", { count: "exact", head: true })
    .eq("state", state)
    [op](column, since.toISOString());
  if (error) throw error;
  return n ?? 0;
}

async function keeperStatus(): Promise<Pick<HealthInput, "keeper" | "keeperError">> {
  let address: `0x${string}`;
  try {
    address = keeperWallet().account.address;
  } catch (err) {
    return { keeper: null, keeperError: err instanceof Error ? err.message : String(err) };
  }
  const balanceWei = await publicClient.getBalance({ address }).catch(() => null);
  return { keeper: { address, balanceWei } };
}

/** Gather the keeper's operational state and evaluate it */
export async function checkHealth(now = new Date()): Promise<HealthReport> {
  const { KEEPER_MIN_BALANCE_ETH } = alertEnv();

  const [keeper, resolveOk, syncOk, resolveFailed, open, stuckCreating, failedCreations24h] = await Promise.all([
    keeperStatus(),
    lastRun("resolve", true),
    lastRun("sync-fixtures", true),
    lastRun("resolve", false),
    db().from("onchain_matches").select("kickoff_at").eq("state", "open"),
    count("creating", "updated_at", "lt", new Date(now.getTime() - 15 * 60_000)),
    count("failed", "created_at", "gt", new Date(now.getTime() - 24 * 3600_000)),
  ]);
  if (open.error) throw open.error;

  const issues = evaluateHealth(
    {
      ...keeper,
      minBalanceWei: parseEther(KEEPER_MIN_BALANCE_ETH),
      lastResolveOk: resolveOk ? new Date(resolveOk.started_at) : null,
      lastSyncOk: syncOk ? new Date(syncOk.started_at) : null,
      lastResolveError: resolveFailed?.summary?.error,
      openKickoffs: (open.data ?? []).map((r) => new Date(r.kickoff_at as string)),
      stuckCreating,
      failedCreations24h,
    },
    now,
  );

  const status = issues.some((i) => i.severity === "critical") ? "down" : issues.length ? "degraded" : "ok";
  return { ok: status !== "down", status, checkedAt: now.toISOString(), issues };
}
