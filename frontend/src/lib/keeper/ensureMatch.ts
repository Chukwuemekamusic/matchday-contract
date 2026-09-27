import "server-only";
import { parseEventLogs, type Hex } from "viem";
import { matchDayBet } from "../contract/config";
import { db } from "../db/client";
import type { FixtureRow, OnChainMatchRow } from "../db/types";
import { SUPPORTED_COMPETITIONS } from "../football/api";
import { publicClient } from "./chain";
import { sendContractTx } from "./tx";

/** Bets close at kickoff; don't spend gas creating a match nobody can bet on in time */
const MIN_LEAD_MS = 3 * 60_000;
/** Only create matches for fixtures in the near future */
const MAX_LEAD_MS = 8 * 86400_000;
const BETTABLE_STATUSES = new Set(["SCHEDULED", "TIMED"]);
const MAX_STRING_BYTES = 64; // contract MAX_STRING_LENGTH

export class EnsureMatchError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Truncate to the contract's 64-byte limit without splitting a UTF-8 character */
export function fitBytes(value: string, max = MAX_STRING_BYTES): string {
  const encoder = new TextEncoder();
  if (encoder.encode(value).length <= max) return value;
  let out = "";
  for (const ch of value) {
    if (encoder.encode(out + ch).length > max) break;
    out += ch;
  }
  return out;
}

function matchIdFromReceipt(logs: Parameters<typeof parseEventLogs>[0]["logs"]): bigint | null {
  const events = parseEventLogs({ abi: matchDayBet.abi, logs, eventName: "MatchCreated" });
  const ours = events.find((e) => e.address.toLowerCase() === matchDayBet.address.toLowerCase());
  return ours ? ours.args.matchId : null;
}

async function updateRow(id: number, patch: Partial<OnChainMatchRow>) {
  const { error } = await db()
    .from("onchain_matches")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Settle a 'creating' row left behind by a crash or timeout by checking its transaction.
 * Returns the row's state afterwards.
 */
export async function reconcileCreating(row: OnChainMatchRow): Promise<OnChainMatchRow["state"]> {
  const ageMs = Date.now() - new Date(row.updated_at).getTime();

  if (!row.create_tx_hash) {
    if (ageMs < 2 * 60_000) return "creating";
    await updateRow(row.id, { state: "failed", error: "never broadcast" });
    return "failed";
  }

  const hash = row.create_tx_hash as Hex;
  const receipt = await publicClient.getTransactionReceipt({ hash }).catch(() => null);
  if (receipt) {
    const matchId = receipt.status === "success" ? matchIdFromReceipt(receipt.logs) : null;
    if (matchId !== null) {
      await updateRow(row.id, { state: "open", match_id: Number(matchId), error: null });
      return "open";
    }
    await updateRow(row.id, { state: "failed", error: "createMatch reverted" });
    return "failed";
  }

  const pending = await publicClient.getTransaction({ hash }).catch(() => null);
  if (!pending && ageMs > 3 * 60_000) {
    await updateRow(row.id, { state: "failed", error: "transaction dropped" });
    return "failed";
  }
  return "creating";
}

async function activeRow(fixtureId: number): Promise<OnChainMatchRow | null> {
  const { data, error } = await db()
    .from("onchain_matches")
    .select("*")
    .eq("fixture_id", fixtureId)
    .in("state", ["creating", "open"])
    .maybeSingle();
  if (error) throw error;
  return data as OnChainMatchRow | null;
}

/** Wait for another request's in-flight creation of the same fixture */
async function waitForOpen(fixtureId: number): Promise<number | null> {
  for (let i = 0; i < 10; i++) {
    const row = await activeRow(fixtureId);
    if (!row) return null;
    if (row.state === "open" && row.match_id !== null) return row.match_id;
    if ((await reconcileCreating(row)) === "failed") return null;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new EnsureMatchError("Match is still being created, try again in a moment", 409);
}

/**
 * Lazily create the on-chain match for a fixture (first bet) and return its match id.
 * The partial unique index on onchain_matches makes the insert a per-fixture lock,
 * so concurrent first bets never create duplicates.
 */
export async function ensureMatch(fixtureId: number): Promise<number> {
  const { data: fixture, error } = await db().from("fixtures").select("*").eq("id", fixtureId).maybeSingle();
  if (error) throw error;
  if (!fixture) throw new EnsureMatchError("Unknown fixture", 404);
  const f = fixture as FixtureRow;

  const existing = await activeRow(fixtureId);
  if (existing?.state === "open" && existing.match_id !== null) return existing.match_id;

  const lead = new Date(f.kickoff_at).getTime() - Date.now();
  if (!SUPPORTED_COMPETITIONS.includes(f.competition_code)) throw new EnsureMatchError("Competition not supported", 400);
  if (!BETTABLE_STATUSES.has(f.status) || lead < MIN_LEAD_MS) throw new EnsureMatchError("Betting is closed for this match", 400);
  if (lead > MAX_LEAD_MS) throw new EnsureMatchError("Betting opens closer to kickoff", 400);

  if (existing) {
    const id = await waitForOpen(fixtureId);
    if (id !== null) return id;
  }

  const { data: inserted, error: insertError } = await db()
    .from("onchain_matches")
    .insert({ fixture_id: fixtureId, state: "creating", kickoff_at: f.kickoff_at })
    .select("*")
    .single();
  if (insertError) {
    if (insertError.code === "23505") {
      const id = await waitForOpen(fixtureId);
      if (id !== null) return id;
    }
    throw insertError;
  }
  const row = inserted as OnChainMatchRow;

  try {
    const { receipt } = await sendContractTx(
      {
        functionName: "createMatch",
        args: [
          fitBytes(f.home_team),
          fitBytes(f.away_team),
          fitBytes(f.competition_name),
          BigInt(Math.floor(new Date(row.kickoff_at).getTime() / 1000)),
        ],
      },
      (hash) => updateRow(row.id, { create_tx_hash: hash }),
    );
    const matchId = receipt.status === "success" ? matchIdFromReceipt(receipt.logs) : null;
    if (matchId === null) throw new Error("createMatch did not emit MatchCreated");
    await updateRow(row.id, { state: "open", match_id: Number(matchId) });
    return Number(matchId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // If the tx was broadcast, let reconciliation decide; otherwise free the lock now
    const { data: current } = await db().from("onchain_matches").select("*").eq("id", row.id).single();
    if (!(current as OnChainMatchRow | null)?.create_tx_hash) {
      await updateRow(row.id, { state: "failed", error: message.slice(0, 500) });
    }
    throw new EnsureMatchError("Could not create the match on-chain, please retry", 502);
  }
}
