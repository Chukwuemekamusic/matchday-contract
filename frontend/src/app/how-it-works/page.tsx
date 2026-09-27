import type { Metadata } from "next";
import { chain, contractAddress } from "@/lib/contract/config";

export const metadata: Metadata = { title: "How it works — MatchDay" };

const steps = [
  {
    title: "Pick an outcome",
    body: "Choose home win, draw or away win and stake ETH. Your stake joins the match pool. One bet per wallet per match, and bets can't be changed.",
  },
  {
    title: "Betting closes at kickoff",
    body: "The payout multipliers you see move as other people bet. They are final once the match kicks off.",
  },
  {
    title: "Winners split the pool",
    body: "After full time, everyone who picked the result shares the whole pool in proportion to their stake, minus a small platform fee.",
  },
  {
    title: "Claim your winnings",
    body: "Winnings sit in the contract until you claim them from My bets. There is no deadline.",
  },
];

export default function HowItWorks() {
  const explorer = chain.blockExplorers?.default.url ?? "https://basescan.org";
  return (
    <article className="max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">How it works</h1>

      <ol className="space-y-4">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-4 rounded-xl border border-border bg-surface p-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent font-semibold text-white">{i + 1}</span>
            <div>
              <h2 className="font-semibold">{s.title}</h2>
              <p className="text-sm text-muted">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="space-y-2 text-sm">
        <h2 className="text-lg font-semibold">Example</h2>
        <p className="text-muted">
          A match pool holds 10 ETH: 5 on home, 2 on draw, 3 on away. Home wins. With a 1% fee, 9.9 ETH is shared by the
          home bettors, so a 1 ETH home bet returns 1.98 ETH.
        </p>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-lg font-semibold">Special cases</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>If nobody picked the result, every stake is refunded with no fee.</li>
          <li>If everybody picked the same outcome and it wins, stakes are returned with no fee.</li>
          <li>Postponed, cancelled or abandoned matches are cancelled on-chain and every stake is refundable.</li>
          <li>
            Matches settle on the score after 90 minutes plus stoppage time. Extra time and penalty shoot-outs don&apos;t
            count.
          </li>
        </ul>
      </section>

      <section className="space-y-2 text-sm">
        <h2 className="text-lg font-semibold">Where results come from</h2>
        <p className="text-muted">
          Results come from football-data.org and are posted on-chain by the MatchDay operator, usually within about two
          hours of kickoff. The contract enforces the payout rules, but the operator reports the result — there is no
          decentralised oracle.
        </p>
        <p className="text-muted">
          Contract:{" "}
          <a className="font-mono underline" href={`${explorer}/address/${contractAddress}`} target="_blank" rel="noreferrer">
            {contractAddress}
          </a>{" "}
          on {chain.name}.
        </p>
      </section>
    </article>
  );
}
