"use client";

import { useAccount } from "wagmi";

/** Marks the connected wallet's row */
export function YouBadge({ address }: { address: string }) {
  const { address: connected } = useAccount();
  if (!connected || connected.toLowerCase() !== address.toLowerCase()) return null;
  return <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-strong">You</span>;
}
