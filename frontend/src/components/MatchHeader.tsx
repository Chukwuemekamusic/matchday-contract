import { Crest } from "@/components/Team";
import { statusLabel } from "@/lib/fixtures";
import { LocalTime } from "@/components/LocalTime";

export interface MatchHeaderProps {
  competition: string;
  home: { name: string; crest?: string | null };
  away: { name: string; crest?: string | null };
  kickoff: Date;
  status?: string;
  score?: { home: number; away: number } | null;
}

export function MatchHeader({ competition, home, away, kickoff, status, score }: MatchHeaderProps) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-6 text-center">
      <div className="text-xs uppercase tracking-wide text-muted">{competition}</div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="flex flex-col items-center gap-2">
          <Crest src={home.crest} name={home.name} size={56} />
          <span className="font-semibold">{home.name}</span>
        </div>
        <div className="font-mono text-3xl font-bold">{score ? `${score.home} – ${score.away}` : "vs"}</div>
        <div className="flex flex-col items-center gap-2">
          <Crest src={away.crest} name={away.name} size={56} />
          <span className="font-semibold">{away.name}</span>
        </div>
      </div>
      <div className="mt-4 text-sm text-muted">
        <LocalTime date={kickoff} />
        {status && <> · {statusLabel(status)}</>}
      </div>
    </section>
  );
}
