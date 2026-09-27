import { SIDES, outcomePool, type OnChainMatch } from "@/lib/match";

const COLORS = ["bg-home", "bg-draw", "bg-away"];

/** Share of the pool on each outcome */
export function PoolBar({ pools }: { pools: Pick<OnChainMatch, "totalPool" | "homePool" | "drawPool" | "awayPool"> }) {
  if (pools.totalPool === 0n) {
    return <div className="h-2 w-full rounded-full bg-surface-muted" />;
  }
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-muted">
      {SIDES.map((side, i) => {
        const pct = Number((outcomePool(pools, side) * 10_000n) / pools.totalPool) / 100;
        return pct > 0 ? <div key={side} className={COLORS[i]} style={{ width: `${pct}%` }} /> : null;
      })}
    </div>
  );
}
