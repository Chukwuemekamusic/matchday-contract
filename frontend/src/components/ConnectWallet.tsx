"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function ConnectWallet() {
  return <ConnectButton chainStatus="icon" showBalance={{ smallScreen: false, largeScreen: true }} accountStatus="address" />;
}
