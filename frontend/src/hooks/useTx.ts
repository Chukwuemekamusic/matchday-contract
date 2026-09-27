"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { usePublicClient } from "wagmi";
import type { Hash } from "viem";
import { chain } from "@/lib/contract/config";
import { errorMessage } from "@/lib/errors";

export type TxState =
  | { status: "idle" }
  | { status: "working"; label: string; hash?: Hash }
  | { status: "done"; hash: Hash }
  | { status: "error"; message: string };

/** Run a wallet transaction, wait for it to be mined, then refresh all contract reads */
export function useTx() {
  const publicClient = usePublicClient({ chainId: chain.id });
  const queryClient = useQueryClient();
  const [state, setState] = useState<TxState>({ status: "idle" });

  async function run(send: () => Promise<Hash>, label = "Confirm in your wallet…"): Promise<boolean> {
    try {
      setState({ status: "working", label });
      const hash = await send();
      setState({ status: "working", label: "Waiting for confirmation…", hash });
      const receipt = await publicClient!.waitForTransactionReceipt({ hash });
      await queryClient.invalidateQueries();
      if (receipt.status !== "success") {
        setState({ status: "error", message: "Transaction reverted." });
        return false;
      }
      setState({ status: "done", hash });
      return true;
    } catch (err) {
      setState({ status: "error", message: errorMessage(err) });
      return false;
    }
  }

  return { state, setState, run };
}
