import type { Metadata } from "next";
import Link from "next/link";
import { EthLeaderboard } from "@/components/EthLeaderboard";
import { PointsTable } from "@/components/PointsTable";
import { currentUserId } from "@/lib/auth/server";
import { pointsTable, type PointsRow } from "@/lib/db/social";
import { requestTime } from "@/lib/fixtures";

export const metadata: Metadata = { title: "Leaderboard — MatchDay" };

type Board = "points" | "eth";

function Tabs({ items, active }: { items: { key: string; label: string; href: string }[]; active: string }) {
  return (
    <div className="flex rounded-lg border border-border bg-surface p-1 text-sm">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? "page" : undefined}
          className={`rounded-md px-3 py-1.5 ${active === t.key ? "bg-accent text-white" : "text-muted hover:text-foreground"}`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export default async function LeaderboardPage({ searchParams }: PageProps<"/leaderboard">) {
  const params = await searchParams;
  const board: Board = params.board === "eth" ? "eth" : "points";
  const period = params.period === "all" ? "all" : "week";
  const sort = params.sort === "wins" ? "wins" : "profit";

  let rows: PointsRow[] = [];
  let failed = false;
  const viewer = await currentUserId();
  if (board === "points") {
    try {
      rows = await pointsTable({ since: period === "week" ? new Date(requestTime() - 7 * 86400_000) : undefined });
    } catch (err) {
      console.error("[leaderboard] points", err);
      failed = true;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
          <p className="text-sm text-muted">
            {board === "points"
              ? "Free picks: 3 points for a correct result, +2 when fewer than a third of fans called it."
              : "Top 50 wallets across all settled ETH pools."}
          </p>
        </div>
        <Tabs
          active={board}
          items={[
            { key: "points", label: "Points", href: "/leaderboard" },
            { key: "eth", label: "ETH", href: "/leaderboard?board=eth" },
          ]}
        />
      </div>

      {board === "points" ? (
        <>
          <Tabs
            active={period}
            items={[
              { key: "week", label: "Last 7 days", href: "/leaderboard" },
              { key: "all", label: "All time", href: "/leaderboard?period=all" },
            ]}
          />
          {failed ? (
            <p className="rounded-xl border border-danger/40 bg-surface p-6 text-sm text-danger">
              The points table is unavailable right now. Please try again shortly.
            </p>
          ) : (
            <PointsTable rows={rows} highlight={viewer} empty="No settled picks yet. Make a pick on any match to get on the board." />
          )}
        </>
      ) : (
        <>
          <Tabs
            active={sort}
            items={[
              { key: "profit", label: "Profit", href: "/leaderboard?board=eth" },
              { key: "wins", label: "Wins", href: "/leaderboard?board=eth&sort=wins" },
            ]}
          />
          <EthLeaderboard sort={sort} />
          <p className="text-xs text-muted">Profit is net of stakes, in ETH, and counts a bet once its match is settled.</p>
        </>
      )}
    </div>
  );
}
