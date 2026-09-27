import "server-only";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain, rpcUrl } from "../contract/config";

const transport = http(process.env.RPC_URL || rpcUrl);

export const publicClient = createPublicClient({ chain, transport });

/** Wallet registered as a match manager on the contract (addMatchManager). Keep it lightly funded. */
export function keeperWallet() {
  const key = process.env.KEEPER_PRIVATE_KEY as Hex | undefined;
  if (!key) throw new Error("KEEPER_PRIVATE_KEY is not set");
  return createWalletClient({ account: privateKeyToAccount(key), chain, transport });
}
