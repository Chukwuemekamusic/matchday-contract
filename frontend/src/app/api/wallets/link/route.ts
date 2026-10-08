import { z } from "zod";
import { currentUserId } from "@/lib/auth/server";
import { checkWalletLinkMessage } from "@/lib/auth/walletLink";
import { db } from "@/lib/db/client";
import { publicClient } from "@/lib/keeper/chain";

const body = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  message: z.string().max(500),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
});

/** Link a wallet to the signed-in account after verifying a signed message (EOAs and smart wallets) */
export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in first" }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { address, message, signature } = parsed.data;

  const check = checkWalletLinkMessage(message, userId, address);
  if (!check.ok) return Response.json({ error: check.reason }, { status: 400 });

  const valid = await publicClient
    .verifyMessage({ address: address as `0x${string}`, message, signature: signature as `0x${string}` })
    .catch(() => false);
  if (!valid) return Response.json({ error: "Signature doesn't match this wallet" }, { status: 400 });

  const lower = address.toLowerCase();
  const { data: existing } = await db().from("wallets").select("user_id").eq("address", lower).maybeSingle();
  if (existing && existing.user_id !== userId) {
    return Response.json({ error: "This wallet is linked to another account" }, { status: 409 });
  }
  const { error } = await db().from("wallets").upsert({ address: lower, user_id: userId });
  if (error) return Response.json({ error: "Could not link wallet" }, { status: 500 });
  return Response.json({ ok: true });
}
