"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";
import { useAccount, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { ChainGate } from "@/components/ChainGate";
import { TxStatus } from "@/components/TxStatus";
import { useTx } from "@/hooks/useTx";
import { matchDayBet } from "@/lib/contract/config";
import { formatEth, formatKickoff } from "@/lib/format";
import { Outcome, betState, pickLabel, type BetState } from "@/lib/match";
import { fetchUserBets } from "@/lib/subgraph";

const BATCH = 50; // contract MAX_BATCH_SIZE
const PREDICTION = { HOME: Outcome.HOME, DRAW: Outcome.DRAW, AWAY: Outcome.AWAY } as const;

const chunk = <T,>(items: T[]) => Array.from({ length: Math.ceil(items.length / BATCH) }, (_, i) => items.slice(i * BATCH, (i + 1) * BATCH));

export function MyBets() {
  const { address } = useAccount();

  return (
    <ChainGate prompt="Connect your wallet to see your bets">
      {address && <MyBetsFor address={address} />}
    </ChainGate>
  );
}

function MyBetsFor({ address }: { address: `0x${string}` }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["user-bets", address],
    queryFn: () => fetchUserBets(address),
    refetchInterval: 30_000,
  });

  const matchIds = useMemo(() => (data?.bets ?? []).map((b) => BigInt(b.match.matchId)), [data]);

  // Settlement state and claimability come from the contract, not the (possibly lagging) subgraph
  const { data: matches } = useReadContract({
    ...matchDayBet,
    functionName: "getMatches",
    args: [matchIds],
    query: { enabled: matchIds.length > 0 },
  });
  const { data: claims } = useReadContracts({
    contracts: matchIds.map((id) => ({ ...matchDayBet, functionName: "getClaimStatus" as const, args: [id, address] as const })),
    allowFailure: false,
    query: { enabled: matchIds.length > 0 },
  });

  const rows = useMemo(
    () =>
      (data?.bets ?? []).map((b, i) => {
        const m = matches?.[i];
        const claim = claims?.[i];
        const bet = { amount: BigInt(b.amount), prediction: PREDICTION[b.prediction] };
        // A settled bet that the contract says can't be claimed has already been claimed
        const state: BetState | undefined = m && claim ? betState(m, { ...bet, claimed: !claim.canClaim }) : undefined;
        return { b, bet, state, claim };
      }),
    [data, matches, claims],
  );

  const winnings = rows.filter((r) => r.claim?.canClaim && r.claim.claimType === 1);
  const refunds = rows.filter((r) => r.claim?.canClaim && r.claim.claimType === 2);
  const claimable = [...winnings, ...refunds].reduce((sum, r) => sum + (r.claim?.amount ?? 0n), 0n);

  const { writeContractAsync } = useWriteContract();
  const { state, run } = useTx();

  async function claimAll() {
    for (const ids of chunk(winnings.map((r) => BigInt(r.b.match.matchId)))) {
      if (!(await run(() => writeContractAsync({ ...matchDayBet, functionName: "batchClaimWinnings", args: [ids] })))) return;
    }
    for (const ids of chunk(refunds.map((r) => BigInt(r.b.match.matchId)))) {
      if (!(await run(() => writeContractAsync({ ...matchDayBet, functionName: "batchClaimRefunds", args: [ids] })))) return;
    }
  }

  if (isLoading) return <p className="text-sm text-muted">Loading your bets…</p>;
  if (error) return <p className="text-sm text-danger">Couldn&apos;t load your bets: {(error as Error).message}</p>;

  const user = data?.user;
  const txCount = (winnings.length ? Math.ceil(winnings.length / BATCH) : 0) + (refunds.length ? Math.ceil(refunds.length / BATCH) : 0);

  return (
    <div className="space-y-6">
      {user && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Bets" value={user.totalBets} />
          <Stat label="Won / lost" value={`${user.winCount} / ${user.lossCount}`} />
          <Stat label="Staked" value={`${formatEth(BigInt(user.totalWagered))} ETH`} />
          <Stat label="Net profit" value={`${formatEth(BigInt(user.totalProfit))} ETH`} />
        </div>
      )}

      {claimable > 0n && (
        <section className="flex flex-col gap-3 rounded-2xl border border-accent bg-accent-soft p-5 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="text-sm text-accent-strong">Ready to claim</div>
            <div className="font-mono text-2xl font-bold">{formatEth(claimable)} ETH</div>
            <div className="text-xs text-muted">
              {winnings.length} winning, {refunds.length} refunded {txCount > 1 && `· ${txCount} transactions`}
            </div>
          </div>
          <button
            onClick={claimAll}
            disabled={state.status === "working"}
            className="rounded-lg bg-accent px-5 py-3 font-semibold text-white hover:bg-accent-strong disabled:opacity-50"
          >
            Claim all
          </button>
          <TxStatus state={state} doneText="Claimed!" />
        </section>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
          No bets yet. <Link href="/" className="underline">Find a match</Link>.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {rows.map(({ b, bet, state: s, claim }) => (
            <li key={b.id}>
              <Link href={`/m/${b.match.matchId}`} className="flex items-center gap-3 p-4 hover:bg-surface-muted">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {b.match.homeTeam} vs {b.match.awayTeam}
                  </div>
                  <div className="text-xs text-muted">
                    {b.match.competition} · {formatKickoff(Number(b.match.kickoffTime) * 1000)}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div>
                    {pickLabel(bet.prediction, b.match.homeTeam, b.match.awayTeam)} ·{" "}
                    <span className="font-mono">{formatEth(bet.amount)}</span>
                  </div>
                  <StateBadge state={s} claimAmount={claim?.amount} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="font-mono font-semibold">{value}</div>
    </div>
  );
}

function StateBadge({ state, claimAmount }: { state?: BetState; claimAmount?: bigint }) {
  if (!state) return <span className="text-xs text-muted">…</span>;
  const styles = "inline-block rounded-full px-2 py-0.5 text-xs font-medium";
  switch (state.kind) {
    case "pending":
      return <span className={`${styles} bg-surface-muted text-muted`}>Pending</span>;
    case "lost":
      return <span className={`${styles} bg-surface-muted text-danger`}>Lost</span>;
    case "won":
      return state.claimed ? (
        <span className={`${styles} bg-surface-muted text-accent-strong`}>Won · claimed</span>
      ) : (
        <span className={`${styles} bg-accent-soft text-accent-strong`}>Won {formatEth(claimAmount ?? state.payout)} ETH</span>
      );
    case "refund":
      return state.claimed ? (
        <span className={`${styles} bg-surface-muted text-muted`}>Refunded</span>
      ) : (
        <span className={`${styles} bg-accent-soft text-accent-strong`}>Refund {formatEth(state.payout)} ETH</span>
      );
  }
}
