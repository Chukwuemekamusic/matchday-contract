"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { ReactNode } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { chain } from "@/lib/contract/config";

/** Renders children only when a wallet is connected to the right chain */
export function ChainGate({ children, prompt = "Connect a wallet to continue" }: { children: ReactNode; prompt?: string }) {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center gap-3 py-2 text-sm text-muted">
        <span>{prompt}</span>
        <ConnectButton />
      </div>
    );
  }
  if (chainId !== chain.id) {
    return (
      <button
        onClick={() => switchChain({ chainId: chain.id })}
        disabled={isPending}
        className="w-full rounded-lg bg-warning px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        Switch to {chain.name}
      </button>
    );
  }
  return <>{children}</>;
}
