"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme, getDefaultConfig, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { http, WagmiProvider } from "wagmi";
import { chain, rpcUrl } from "@/lib/contract/config";

const config = getDefaultConfig({
  appName: "MatchDay",
  // WalletConnect Cloud project id; injected wallets (MetaMask, Coinbase extension) work without it
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "matchday-dev",
  chains: [chain],
  transports: { [chain.id]: http(rpcUrl) },
  ssr: true,
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000 } } }));

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          initialChain={chain}
          theme={{
            lightMode: lightTheme({ accentColor: "#0f8a4a", borderRadius: "medium" }),
            darkMode: darkTheme({ accentColor: "#34c07a", borderRadius: "medium" }),
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
