import { explorerTxUrl } from "@/lib/contract/config";
import type { TxState } from "@/hooks/useTx";

export function TxStatus({ state, doneText }: { state: TxState; doneText: string }) {
  if (state.status === "idle") return null;
  if (state.status === "error") return <p className="text-sm text-danger">{state.message}</p>;
  const hash = state.hash;
  return (
    <p className="text-sm text-muted">
      {state.status === "working" ? state.label : doneText}{" "}
      {hash && (
        <a href={explorerTxUrl(hash)} target="_blank" rel="noreferrer" className="underline">
          View transaction
        </a>
      )}
    </p>
  );
}
