import { base, baseSepolia } from "viem/chains";
import { getAddress, type Address, type Chain } from "viem";
import { matchDayBetAbi } from "./abi";

const chains = { base, "base-sepolia": baseSepolia } as const;
type ChainKey = keyof typeof chains;

const chainKey = (process.env.NEXT_PUBLIC_CHAIN ?? "base") as ChainKey;
if (!(chainKey in chains)) {
  throw new Error(`NEXT_PUBLIC_CHAIN must be one of ${Object.keys(chains).join(", ")}`);
}

export const chain: Chain = chains[chainKey];

/** Optional custom RPC (recommended in production; public RPCs are rate limited) */
export const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || undefined;

export const contractAddress: Address = getAddress(
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "0x1b048C7323C7c7FE910a5F0e08B36b0c715e8947",
);

export const matchDayBet = { address: contractAddress, abi: matchDayBetAbi, chainId: chain.id } as const;

export const explorerTxUrl = (hash: string) => `${chain.blockExplorers?.default.url ?? "https://basescan.org"}/tx/${hash}`;
