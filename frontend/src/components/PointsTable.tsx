import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import type { PointsRow } from "@/lib/db/social";

/** Free-pick points table; `highlight` marks the viewer's row */
export function PointsTable({ rows, highlight, empty }: { rows: PointsRow[]; highlight?: string | null; empty: string }) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted">
          <tr className="border-b border-border">
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Fan</th>
            <th className="px-4 py-3 text-right font-medium">Picks</th>
            <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Correct</th>
            <th className="px-4 py-3 text-right font-medium">Points</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={r.user_id} className={r.user_id === highlight ? "bg-accent-soft/60" : undefined}>
              <td className="px-4 py-3 font-mono text-muted">{i + 1}</td>
              <td className="px-4 py-3">
                <Link href={`/u/${r.username}`} className="flex items-center gap-2 hover:underline">
                  <Avatar name={r.display_name} seed={r.user_id} src={r.avatar_url} size={24} />
                  <span className="truncate font-medium">{r.display_name}</span>
                  {r.user_id === highlight && (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-strong">You</span>
                  )}
                </Link>
              </td>
              <td className="px-4 py-3 text-right font-mono">{r.played}</td>
              <td className="hidden px-4 py-3 text-right font-mono sm:table-cell">
                {r.played ? `${Math.round((r.won / r.played) * 100)}%` : "—"}
              </td>
              <td className="px-4 py-3 text-right font-mono font-semibold">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
