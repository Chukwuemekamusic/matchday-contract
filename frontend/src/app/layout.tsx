import type { Metadata } from "next";
import Link from "next/link";
import { ConnectWallet } from "@/components/ConnectWallet";
import { NavLinks } from "@/components/NavLinks";
import { contractAddress, chain } from "@/lib/contract/config";
import { siteUrl } from "@/lib/site";
import { Providers } from "./providers";
import "./globals.css";

const description = "Parimutuel football betting on Base. Pick home, draw or away; winners split the pool.";

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: "MatchDay — pool betting on football",
  description,
  openGraph: { siteName: "MatchDay", type: "website", description },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const explorer = chain.blockExplorers?.default.url ?? "https://basescan.org";

  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <Providers>
          <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-sm text-white">⚽</span>
                MatchDay
              </Link>
              <div className="ml-auto sm:order-last">
                <ConnectWallet />
              </div>
              <NavLinks />
            </div>
          </header>

          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>

          <footer className="border-t border-border py-6 text-center text-xs text-muted">
            <p>
              Bets settle on-chain on {chain.name}. Contract{" "}
              <a className="underline" href={`${explorer}/address/${contractAddress}`} target="_blank" rel="noreferrer">
                {contractAddress.slice(0, 6)}…{contractAddress.slice(-4)}
              </a>
              . Results from football-data.org, settled on the 90-minute score. Bet responsibly.
            </p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
