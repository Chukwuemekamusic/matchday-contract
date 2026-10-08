"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function ConnectWallet() {
  return (
    <ConnectButton
      label="Wallet"
      chainStatus="icon"
      showBalance={{ smallScreen: false, largeScreen: true }}
      accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
    />
  );
}
