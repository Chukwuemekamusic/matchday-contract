"use client";

import { useReadContracts } from "wagmi";
import { matchDayBet } from "@/lib/contract/config";

/** Contract-wide settings the UI needs (fees, stake limits, grace period, global pause) */
export function useProtocol() {
  const { data, isLoading } = useReadContracts({
    contracts: [
      { ...matchDayBet, functionName: "platformFeeBps" },
      { ...matchDayBet, functionName: "minStake" },
      { ...matchDayBet, functionName: "maxStake" },
      { ...matchDayBet, functionName: "gracePeriod" },
      { ...matchDayBet, functionName: "paused" },
    ],
    allowFailure: false,
    query: { staleTime: 60_000 },
  });

  return {
    isLoading,
    feeBps: data?.[0] ?? 100n,
    minStake: data?.[1],
    maxStake: data?.[2],
    gracePeriod: data?.[3] ?? 6300n,
    paused: data?.[4] ?? false,
  };
}
