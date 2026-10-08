"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { ConnectWallet } from "@/components/ConnectWallet";
import { walletLinkMessage } from "@/lib/auth/walletLink";
import { errorMessage } from "@/lib/errors";
import { shortAddress } from "@/lib/format";

export function LinkWallet({ userId, linked }: { userId: string; linked: string[] }) {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const router = useRouter();
  const [status, setStatus] = useState<{ busy?: boolean; error?: string }>({});

  if (!address) {
    return (
      <div className="flex items-center gap-3 text-sm text-muted">
        Connect a wallet to link it: <ConnectWallet />
      </div>
    );
  }
  if (linked.includes(address.toLowerCase())) {
    return <p className="text-sm text-muted">The connected wallet {shortAddress(address)} is linked.</p>;
  }

  async function link() {
    setStatus({ busy: true });
    try {
      const message = walletLinkMessage(userId, address!, new Date().toISOString());
      const signature = await signMessageAsync({ message });
      const res = await fetch("/api/wallets/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, message, signature }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not link wallet");
      setStatus({});
      router.refresh();
    } catch (err) {
      setStatus({ error: errorMessage(err) });
    }
  }

  return (
    <div className="space-y-1">
      <button
        onClick={link}
        disabled={status.busy}
        className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-accent disabled:opacity-60"
      >
        {status.busy ? "Check your wallet…" : `Link ${shortAddress(address)}`}
      </button>
      {status.error && <p className="text-xs text-danger">{status.error}</p>}
    </div>
  );
}
