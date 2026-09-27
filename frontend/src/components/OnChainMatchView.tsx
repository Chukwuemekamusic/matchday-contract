"use client";

import Link from "next/link";
import { useReadContract } from "wagmi";
import { MatchHeader } from "@/components/MatchHeader";
import { MatchPanel } from "@/components/MatchPanel";
import { matchDayBet } from "@/lib/contract/config";

export function OnChainMatchView({ matchId }: { matchId: number }) {
  const { data: match, isLoading } = useReadContract({ ...matchDayBet, functionName: "getMatch", args: [BigInt(matchId)] });

  if (isLoading) return <p className="text-sm text-muted">Loading match…</p>;
  if (!match || match.matchId === 0n) return <p className="text-sm text-muted">Match #{matchId} was not found.</p>;

  return (
    <div className="space-y-4">
      <Link href="/me" className="text-sm text-muted hover:text-foreground">
        ← My bets
      </Link>
      <MatchHeader
        competition={match.competition}
        home={{ name: match.homeTeam }}
        away={{ name: match.awayTeam }}
        kickoff={new Date(Number(match.kickoffTime) * 1000)}
      />
      <MatchPanel initialMatchId={matchId} home={match.homeTeam} away={match.awayTeam} fixtureOpen={false} />
    </div>
  );
}
