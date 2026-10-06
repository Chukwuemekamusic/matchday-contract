import "server-only";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { chain, rpcUrl } from "../contract/config";
import { keeperEnv } from "../env";

const transport = http(process.env.RPC_URL || rpcUrl);

export const publicClient = createPublicClient({ chain, transport });

/** Wallet registered as a match manager on the contract (addMatchManager). Keep it lightly funded. */
export function keeperWallet() {
  const account = privateKeyToAccount(keeperEnv().KEEPER_PRIVATE_KEY);
  return createWalletClient({ account, chain, transport });
}
