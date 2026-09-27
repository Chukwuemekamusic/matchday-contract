import "server-only";
import { encodeFunctionData, keccak256, type Hex, type TransactionReceipt } from "viem";
import { matchDayBet } from "../contract/config";
import { keeperWallet, publicClient } from "./chain";

type WriteArgs = Parameters<typeof encodeFunctionData<typeof matchDayBet.abi>>[0];

/**
 * Sign a contract call locally, hand its hash to `beforeSend` (so callers can persist it),
 * then broadcast and wait for the receipt. Retries with a fresh nonce if two keeper calls race.
 */
export async function sendContractTx(
  call: Omit<WriteArgs, "abi">,
  beforeSend?: (hash: Hex) => Promise<void>,
): Promise<{ hash: Hex; receipt: TransactionReceipt }> {
  const wallet = keeperWallet();
  const data = encodeFunctionData({ abi: matchDayBet.abi, ...call } as WriteArgs);

  for (let attempt = 1; ; attempt++) {
    // prepareTransactionRequest estimates gas, so contract reverts surface here before anything is sent
    const request = await wallet.prepareTransactionRequest({
      account: wallet.account,
      chain: wallet.chain,
      to: matchDayBet.address,
      data,
    });
    const serialized = await wallet.signTransaction(request);
    const hash = keccak256(serialized);
    await beforeSend?.(hash);

    try {
      await publicClient.sendRawTransaction({ serializedTransaction: serialized });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (attempt < 3 && /nonce|underpriced|already known/i.test(message)) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      throw err;
    }

    const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
    return { hash, receipt };
  }
}
