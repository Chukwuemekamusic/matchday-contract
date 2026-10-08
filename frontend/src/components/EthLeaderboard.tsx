import { YouBadge } from "@/components/YouBadge";
import { chain } from "@/lib/contract/config";
import { formatEth, shortAddress } from "@/lib/format";
import { fetchLeaderboard, type LeaderboardEntry, type LeaderboardSort } from "@/lib/subgraph";

/** Top 50 wallets by ETH profit or wins, from the subgraph */
export async function EthLeaderboard({ sort }: { sort: LeaderboardSort }) {
  let entries: LeaderboardEntry[] = [];
  let failed = false;
  try {
    entries = await fetchLeaderboard(sort);
  } catch (err) {
    console.error("[leaderboard]", err);
    failed = true;
  }

  const explorer = chain.blockExplorers?.default.url ?? "https://basescan.org";

  return (
    <>
      {failed ? (
        <p className="rounded-xl border border-danger/40 bg-surface p-6 text-sm text-danger">
          The leaderboard is unavailable right now. Please try again shortly.
        </p>
      ) : entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">No bets yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Bettor</th>
                <th className="px-4 py-3 text-right font-medium">Bets</th>
                <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">W · L · R</th>
                <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Win rate</th>
                <th className="hidden px-4 py-3 text-right font-medium md:table-cell">Staked</th>
                <th className="px-4 py-3 text-right font-medium">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map((e, i) => {
                const wins = Number(e.winCount);
                const decided = wins + Number(e.lossCount);
                const profit = BigInt(e.totalProfit);
                return (
                  <tr key={e.id}>
                    <td className="px-4 py-3 font-mono text-muted">{i + 1}</td>
                    <td className="px-4 py-3">
                      <a href={`${explorer}/address/${e.id}`} target="_blank" rel="noreferrer" className="font-mono hover:underline">
                        {shortAddress(e.id)}
                      </a>
                      <YouBadge address={e.id} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{e.totalBets}</td>
                    <td className="hidden px-4 py-3 text-right font-mono sm:table-cell">
                      {e.winCount} · {e.lossCount} · {e.refundCount}
                    </td>
                    <td className="hidden px-4 py-3 text-right font-mono sm:table-cell">
                      {decided ? `${Math.round((wins / decided) * 100)}%` : "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-right font-mono md:table-cell">{formatEth(BigInt(e.totalWagered))}</td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${profit > 0n ? "text-accent" : profit < 0n ? "text-danger" : ""}`}>
                      {profit > 0n ? "+" : ""}
                      {formatEth(profit)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
