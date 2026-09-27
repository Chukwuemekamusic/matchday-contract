import "server-only";
import { matchDayBet } from "../contract/config";
import { db } from "../db/client";
import type { OnChainMatchRow } from "../db/types";
import { fetchMatchesByIds } from "../football/api";
import { settlementFor } from "../football/result";
import { MatchStatus, type Outcome } from "../match";
import { publicClient } from "./chain";
import { reconcileCreating } from "./ensureMatch";
import { upsertFixtures } from "./syncFixtures";
import { sendContractTx } from "./tx";

const BATCH = 50; // contract MAX_BATCH_SIZE

async function setRow(id: number, patch: Partial<OnChainMatchRow>) {
  const { error } = await db()
    .from("onchain_matches")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Copy on-chain resolved/cancelled status into the DB (covers manual owner actions too) */
async function syncFromChain(rows: OnChainMatchRow[], txHash?: string): Promise<Set<number>> {
  const settled = new Set<number>();
  if (rows.length === 0) return settled;
  const onChain = await publicClient.readContract({
    ...matchDayBet,
    functionName: "getMatches",
    args: [rows.map((r) => BigInt(r.match_id!))],
  });
  for (let i = 0; i < rows.length; i++) {
    const m = onChain[i];
    if (m.status === MatchStatus.RESOLVED) {
      await setRow(rows[i].id, { state: "resolved", result: m.result, ...(txHash && { settle_tx_hash: txHash }) });
      settled.add(rows[i].id);
    } else if (m.status === MatchStatus.CANCELLED) {
      await setRow(rows[i].id, { state: "cancelled", ...(txHash && { settle_tx_hash: txHash }) });
      settled.add(rows[i].id);
    }
  }
  return settled;
}

/**
 * Resolve finished matches and cancel postponed/cancelled ones.
 * Only matches the app created (created on a first bet) are touched.
 */
export async function resolveMatches() {
  const summary = { reconciled: 0, checked: 0, resolved: 0, cancelled: 0, waiting: 0, alreadySettled: 0 };

  // 1. Finish any interrupted createMatch calls
  const { data: creating } = await db().from("onchain_matches").select("*").eq("state", "creating");
  for (const row of (creating ?? []) as OnChainMatchRow[]) {
    if ((await reconcileCreating(row)) !== "creating") summary.reconciled++;
  }

  // 2. All open matches: only ones with bets exist, and postponements can happen before kickoff
  const { data, error } = await db().from("onchain_matches").select("*").eq("state", "open");
  if (error) throw error;
  let rows = (data ?? []) as OnChainMatchRow[];
  if (rows.length === 0) return summary;

  // 3. Skip anything already settled on-chain
  const settledBefore = await syncFromChain(rows);
  summary.alreadySettled = settledBefore.size;
  rows = rows.filter((r) => !settledBefore.has(r.id));
  if (rows.length === 0) return summary;

  // 4. Ask football-data for the latest state and store it
  const apiMatches = await fetchMatchesByIds([...new Set(rows.map((r) => r.fixture_id))]);
  await upsertFixtures(apiMatches);
  const byId = new Map(apiMatches.map((m) => [m.id, m]));

  const gracePeriod = await publicClient.readContract({ ...matchDayBet, functionName: "gracePeriod" });
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const now = new Date();

  const toResolve: { row: OnChainMatchRow; outcome: Outcome }[] = [];
  const toCancel = new Map<string, OnChainMatchRow[]>();

  for (const row of rows) {
    summary.checked++;
    const api = byId.get(row.fixture_id);
    if (!api) {
      summary.waiting++;
      continue;
    }
    const betsClosedAt = new Date(row.kickoff_at);
    const decision = settlementFor(api, now, betsClosedAt);
    // The contract refuses resolution before its own kickoff + gracePeriod
    const kickoffSec = BigInt(Math.floor(betsClosedAt.getTime() / 1000));
    if (decision.action === "resolve" && nowSec >= kickoffSec + gracePeriod) {
      toResolve.push({ row, outcome: decision.outcome });
    } else if (decision.action === "cancel") {
      toCancel.set(decision.reason, [...(toCancel.get(decision.reason) ?? []), row]);
    } else {
      summary.waiting++;
    }
  }

  // 5. Send batches, then read back what actually happened on-chain
  for (let i = 0; i < toResolve.length; i += BATCH) {
    const batch = toResolve.slice(i, i + BATCH);
    const { hash } = await sendContractTx({
      functionName: "batchResolveMatches",
      args: [batch.map((b) => BigInt(b.row.match_id!)), batch.map((b) => b.outcome)],
    });
    summary.resolved += (await syncFromChain(batch.map((b) => b.row), hash)).size;
  }

  for (const [reason, cancelRows] of toCancel) {
    for (let i = 0; i < cancelRows.length; i += BATCH) {
      const batch = cancelRows.slice(i, i + BATCH);
      const { hash } = await sendContractTx({
        functionName: "batchCancelMatches",
        args: [batch.map((r) => BigInt(r.match_id!)), reason],
      });
      summary.cancelled += (await syncFromChain(batch, hash)).size;
    }
  }

  return summary;
}
