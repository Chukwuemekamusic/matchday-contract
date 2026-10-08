import { getAddress, isAddress } from "viem";

/** Message a user signs to prove they control a wallet they link to their account */
export function walletLinkMessage(userId: string, address: string, issuedAt: string): string {
  return [
    "MatchDay: link this wallet to my account",
    `Account: ${userId}`,
    `Address: ${getAddress(address)}`,
    `Issued: ${issuedAt}`,
  ].join("\n");
}

/** Parse and check a signed link message: right account, right address, issued in the last 10 minutes */
export function checkWalletLinkMessage(
  message: string,
  userId: string,
  address: string,
  now = Date.now(),
): { ok: true } | { ok: false; reason: string } {
  if (!isAddress(address)) return { ok: false, reason: "Invalid address" };
  const issued = /^Issued: (.+)$/m.exec(message)?.[1];
  if (!issued || message !== walletLinkMessage(userId, address, issued)) return { ok: false, reason: "Unexpected message" };
  const age = now - Date.parse(issued);
  if (!Number.isFinite(age) || age < -60_000 || age > 10 * 60_000) return { ok: false, reason: "Signature expired, try again" };
  return { ok: true };
}
