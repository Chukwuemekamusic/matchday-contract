import { describe, expect, it } from "vitest";
import { checkWalletLinkMessage, walletLinkMessage } from "./walletLink";

const user = "11111111-2222-3333-4444-555555555555";
const addr = "0x6e00000000000000000000000000000000ece400";
const now = Date.parse("2026-10-08T12:00:00Z");

describe("wallet link message", () => {
  it("accepts a fresh message for the same account and address", () => {
    const msg = walletLinkMessage(user, addr, "2026-10-08T11:58:00Z");
    expect(checkWalletLinkMessage(msg, user, addr, now)).toEqual({ ok: true });
  });

  it("rejects another account, another address or an old signature", () => {
    const msg = walletLinkMessage(user, addr, "2026-10-08T11:58:00Z");
    expect(checkWalletLinkMessage(msg, "99999999-2222-3333-4444-555555555555", addr, now).ok).toBe(false);
    expect(checkWalletLinkMessage(msg, user, "0x7e00000000000000000000000000000000ece400", now).ok).toBe(false);
    const old = walletLinkMessage(user, addr, "2026-10-08T11:00:00Z");
    expect(checkWalletLinkMessage(old, user, addr, now)).toEqual({ ok: false, reason: "Signature expired, try again" });
  });
});
