"use client";

import { useEffect, useState } from "react";
import { parseEther } from "viem";
import { useAccount, useBalance, useReadContracts, useWriteContract } from "wagmi";
import { ChainGate } from "@/components/ChainGate";
import { PoolBar } from "@/components/PoolBar";
import { TxStatus } from "@/components/TxStatus";
import { useProtocol } from "@/hooks/useProtocol";
import { useTx } from "@/hooks/useTx";
import { matchDayBet } from "@/lib/contract/config";
import { formatEth } from "@/lib/format";
import {
  MatchStatus,
  SIDES,
  betState,
  estimatePayout,
  impliedMultiplier,
  matchPhase,
  outcomePool,
  pickLabel,
  type MatchPhase,
  type OnChainMatch,
  type Side,
} from "@/lib/match";

const EMPTY_POOLS = { totalPool: 0n, homePool: 0n, drawPool: 0n, awayPool: 0n };

const PHASE_TEXT: Record<Exclude<MatchPhase, "open">, string> = {
  paused: "Betting on this match is paused.",
  live: "Betting closed at kickoff. The match will be settled after full time.",
  awaiting: "Waiting for the result to be settled on-chain.",
  resolved: "This match is settled.",
  cancelled: "This match was cancelled — all stakes are refundable.",
};

interface Props {
  /** football-data fixture id; enables creating the on-chain match on the first bet */
  fixtureId?: number;
  initialMatchId: number | null;
  home: string;
  away: string;
  /** Whether the fixture can still take a first bet (used before the match exists on-chain) */
  fixtureOpen: boolean;
}

export function MatchPanel({ fixtureId, initialMatchId, home, away, fixtureOpen }: Props) {
  const [matchId, setMatchId] = useState<number | null>(initialMatchId);
  const id = BigInt(matchId ?? 0);
  const { address } = useAccount();
  const protocol = useProtocol();

  const { data } = useReadContracts({
    contracts: [
      { ...matchDayBet, functionName: "getMatch", args: [id] },
      { ...matchDayBet, functionName: "matchPaused", args: [id] },
      { ...matchDayBet, functionName: "hasUserBet", args: [id, address ?? "0x0000000000000000000000000000000000000000"] },
      { ...matchDayBet, functionName: "getUserBet", args: [id, address ?? "0x0000000000000000000000000000000000000000"] },
    ],
    allowFailure: false,
    query: { enabled: matchId !== null, refetchInterval: 20_000 },
  });

  const match: OnChainMatch | undefined = data?.[0];
  const hasBet = Boolean(address && data?.[2]);
  const bet = hasBet ? data?.[3] : undefined;

  const [nowSec, setNowSec] = useState(() => BigInt(Math.floor(Date.now() / 1000)));
  useEffect(() => {
    const t = setInterval(() => setNowSec(BigInt(Math.floor(Date.now() / 1000))), 15_000);
    return () => clearInterval(t);
  }, []);

  const phase: MatchPhase = match
    ? matchPhase(match, { nowSec, gracePeriod: protocol.gracePeriod, paused: protocol.paused, matchPaused: data?.[1] ?? false })
    : fixtureOpen && !protocol.paused
      ? "open"
      : "live";

  const pools = match ?? EMPTY_POOLS;

  return (
    <div className="grid items-start gap-4 md:grid-cols-[1fr_22rem]">
      <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Pool</h2>
          <span className="font-mono text-lg">{formatEth(pools.totalPool)} ETH</span>
        </div>
        <PoolBar pools={pools} />
        <div className="grid grid-cols-3 gap-2 text-center">
          {SIDES.map((side, i) => {
            const x = impliedMultiplier(pools, side, protocol.feeBps);
            const count = match ? [match.homeBetCount, match.drawBetCount, match.awayBetCount][i] : 0n;
            const won = match?.status === MatchStatus.RESOLVED && match.result === side;
            return (
              <div key={side} className={`rounded-xl p-3 ${won ? "bg-accent-soft ring-2 ring-accent" : "bg-surface-muted"}`}>
                <div className="truncate text-xs text-muted">{pickLabel(side, home, away)}</div>
                <div className="font-mono text-xl font-semibold">{x ? `${x.toFixed(2)}×` : "—"}</div>
                <div className="text-xs text-muted">
                  {formatEth(outcomePool(pools, side))} ETH · {count.toString()} {count === 1n ? "bet" : "bets"}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted">
          Multipliers show what a winning bet would currently return per 1 ETH staked, after the{" "}
          {(Number(protocol.feeBps) / 100).toFixed(1)}% fee. They move as bets come in and are only final at kickoff.
        </p>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        {match && bet && hasBet ? (
          <YourBet match={match} bet={bet} home={home} away={away} />
        ) : phase === "open" ? (
          <BetSlip
            fixtureId={fixtureId}
            matchId={matchId}
            onMatchCreated={setMatchId}
            pools={pools}
            home={home}
            away={away}
          />
        ) : (
          <p className="text-sm text-muted">{PHASE_TEXT[phase]}</p>
        )}
      </section>
    </div>
  );
}

function BetSlip({
  fixtureId,
  matchId,
  onMatchCreated,
  pools,
  home,
  away,
}: {
  fixtureId?: number;
  matchId: number | null;
  onMatchCreated: (id: number) => void;
  pools: typeof EMPTY_POOLS;
  home: string;
  away: string;
}) {
  const { address } = useAccount();
  const { data: balance } = useBalance({ address });
  const { feeBps, minStake, maxStake } = useProtocol();
  const { writeContractAsync } = useWriteContract();
  const { state, setState, run } = useTx();

  const [side, setSide] = useState<Side | null>(null);
  const [amountText, setAmountText] = useState("");

  let amount: bigint | null = null;
  try {
    amount = amountText ? parseEther(amountText) : null;
  } catch {
    amount = null;
  }

  const problem =
    amountText && amount === null
      ? "Enter a valid amount"
      : amount !== null && minStake !== undefined && amount < minStake
        ? `Minimum stake is ${formatEth(minStake)} ETH`
        : amount !== null && maxStake !== undefined && amount > maxStake
          ? `Maximum stake is ${formatEth(maxStake)} ETH`
          : amount !== null && balance && amount > balance.value
            ? "Not enough ETH in your wallet"
            : null;

  const payout = side && amount ? estimatePayout(pools, side, amount, feeBps) : 0n;
  const busy = state.status === "working";
  // Only transient failures (network, server errors) are worth retrying; e.g. "betting closed" is final
  const [retryable, setRetryable] = useState(false);
  const canRetry = retryable && state.status === "error" && matchId === null;

  async function placeBet() {
    if (!side || !amount) return;
    let id = matchId;
    if (id === null) {
      setRetryable(false);
      setState({ status: "working", label: "Opening this match on-chain (first bet)…" });
      let res: Response;
      try {
        res = await fetch("/api/matches/ensure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fixtureId }),
        });
      } catch {
        setRetryable(true);
        setState({ status: "error", message: "Network error — tap Retry to try again." });
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { matchId?: number; error?: string };
      if (!res.ok || body.matchId === undefined) {
        const base = body.error ?? "Could not open this match for betting.";
        const transient = res.status >= 500 || res.status === 409; // 409: creation still in flight
        setRetryable(transient);
        setState({ status: "error", message: transient ? `${base} Tap Retry to try again.` : base });
        return;
      }
      id = body.matchId;
      onMatchCreated(id);
    }
    const ok = await run(() =>
      writeContractAsync({ ...matchDayBet, functionName: "placeBet", args: [BigInt(id!), side], value: amount! }),
    );
    if (ok) setAmountText("");
  }

  const presets = [minStake, 5n * 10n ** 15n, 10n ** 16n, maxStake].filter(
    (v, i, arr): v is bigint => v !== undefined && (!maxStake || v <= maxStake) && arr.indexOf(v) === i,
  );

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Place a bet</h2>

      <div className="grid grid-cols-3 gap-2">
        {SIDES.map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={`truncate rounded-lg border px-2 py-2.5 text-sm font-medium ${
              side === s ? "border-accent bg-accent-soft text-accent-strong" : "border-border hover:border-accent"
            }`}
          >
            {pickLabel(s, home, away)}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <label className="flex items-center rounded-lg border border-border bg-background px-3 focus-within:border-accent">
          <input
            inputMode="decimal"
            placeholder="0.01"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value.replace(",", ".").trim())}
            className="w-full bg-transparent py-2.5 font-mono outline-none"
            aria-label="Stake in ETH"
          />
          <span className="text-sm text-muted">ETH</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.toString()}
              onClick={() => setAmountText(formatEth(p, 6))}
              className="rounded-md bg-surface-muted px-2 py-1 font-mono text-xs hover:bg-accent-soft"
            >
              {formatEth(p)}
            </button>
          ))}
        </div>
        {problem && <p className="text-xs text-danger">{problem}</p>}
      </div>

      <div className="rounded-lg bg-surface-muted p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Estimated return</span>
          <span className="font-mono font-semibold">{payout > 0n ? `${formatEth(payout)} ETH` : "—"}</span>
        </div>
        <p className="mt-1 text-xs text-muted">
          {pools.totalPool === 0n
            ? "You'd be the first bettor. If nobody backs another outcome, your stake is simply returned."
            : "Estimate at current pool sizes; the final return depends on bets placed before kickoff."}
        </p>
      </div>

      <ChainGate prompt="Connect a wallet to bet">
        <button
          onClick={placeBet}
          disabled={!side || !amount || Boolean(problem) || busy}
          className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white hover:bg-accent-strong disabled:opacity-50"
        >
          {busy
            ? "Working…"
            : canRetry
              ? `Retry${side ? ` — Bet on ${pickLabel(side, home, away)}` : ""}`
              : side
                ? `Bet on ${pickLabel(side, home, away)}`
                : "Choose an outcome"}
        </button>
      </ChainGate>
      <TxStatus state={state} doneText="Bet placed!" />
      <p className="text-xs text-muted">One bet per wallet per match. Bets can&apos;t be changed or withdrawn.</p>
    </div>
  );
}

function YourBet({
  match,
  bet,
  home,
  away,
}: {
  match: OnChainMatch;
  bet: { amount: bigint; prediction: number; claimed: boolean };
  home: string;
  away: string;
}) {
  const { writeContractAsync } = useWriteContract();
  const { state, run } = useTx();
  const s = betState(match, bet);

  const claim = () =>
    run(() =>
      writeContractAsync({
        ...matchDayBet,
        functionName: match.status === MatchStatus.CANCELLED ? "claimRefund" : "claimWinnings",
        args: [match.matchId],
      }),
    );

  const canClaim = (s.kind === "won" || s.kind === "refund") && !s.claimed && s.payout > 0n;

  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Your bet</h2>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-surface-muted p-3">
          <div className="text-xs text-muted">Pick</div>
          <div className="font-semibold">{pickLabel(bet.prediction, home, away)}</div>
        </div>
        <div className="rounded-lg bg-surface-muted p-3">
          <div className="text-xs text-muted">Stake</div>
          <div className="font-mono font-semibold">{formatEth(bet.amount)} ETH</div>
        </div>
      </div>

      {s.kind === "pending" && <p className="text-sm text-muted">Good luck! This bet settles after full time.</p>}
      {s.kind === "lost" && <p className="text-sm text-muted">This one didn&apos;t come in.</p>}
      {(s.kind === "won" || s.kind === "refund") && (
        <div className="rounded-lg bg-accent-soft p-3 text-sm">
          <div className="font-semibold text-accent-strong">
            {s.kind === "won" ? "You won!" : "Refund"} {formatEth(s.payout)} ETH
          </div>
          {s.claimed && <div className="text-xs text-muted">Claimed</div>}
        </div>
      )}

      {canClaim && (
        <ChainGate>
          <button
            onClick={claim}
            disabled={state.status === "working"}
            className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white hover:bg-accent-strong disabled:opacity-50"
          >
            Claim {formatEth((s as { payout: bigint }).payout)} ETH
          </button>
        </ChainGate>
      )}
      <TxStatus state={state} doneText="Claimed!" />
    </div>
  );
}
