import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { LocalTime } from "@/components/LocalTime";
import { Crest } from "@/components/Team";
import { loadPickCard, pickedTeam } from "@/lib/db/pickCard";
import { pickLabel, SIDES } from "@/lib/match";
import { pickShares, totalPicks } from "@/lib/picks";

export const dynamic = "force-dynamic";

type Props = PageProps<"/pick/[fixtureId]/[username]">;

async function load(params: Props["params"]) {
  const { fixtureId, username } = await params;
  return { fixtureId: Number(fixtureId), card: await loadPickCard(Number(fixtureId), decodeURIComponent(username)).catch(() => null) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { card } = await load(params);
  if (!card) return { title: "MatchDay" };
  const f = card.fixture;
  const title = `${card.profile.display_name} picked ${pickedTeam(card)} — ${f.home_team} vs ${f.away_team}`;
  const description = "Think they're wrong? Make your free pick on MatchDay.";
  return { title, description, openGraph: { title, description }, twitter: { title, description } };
}

/** Landing page for a shared pick: who picked what, and one tap to make your own */
export default async function PickPage({ params }: Props) {
  const { fixtureId, card } = await load(params);
  if (!card) redirect(Number.isInteger(fixtureId) && fixtureId > 0 ? `/match/${fixtureId}` : "/");

  const { fixture: f, profile, pick, counts, record } = card;
  const home = f.home_short ?? f.home_team;
  const away = f.away_short ?? f.away_team;
  const shares = pickShares(counts);
  const total = totalPicks(counts);

  return (
    <div className="mx-auto max-w-lg space-y-5 py-4">
      <section className="space-y-5 rounded-2xl border border-border bg-surface p-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <Avatar name={profile.display_name} seed={profile.id} src={profile.avatar_url} size={64} />
          <div>
            <Link href={`/u/${profile.username}`} className="text-lg font-semibold hover:underline">
              {profile.display_name}
            </Link>
            {record.decided > 0 && (
              <div className="text-xs text-muted">
                {record.won}/{record.decided} correct picks
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="text-sm text-muted">picked</div>
          <div className="text-3xl font-bold tracking-tight text-accent-strong">{pickLabel(pick.prediction, home, away)}</div>
          {pick.result === "won" && <div className="mt-1 text-sm font-semibold text-accent-strong">…and called it ✔</div>}
          {pick.result === "lost" && <div className="mt-1 text-sm text-muted">…not this time</div>}
        </div>
        <div className="flex items-center justify-center gap-3 text-sm">
          <Crest src={f.home_crest} name={home} size={28} />
          <span className="font-medium">
            {home} vs {away}
          </span>
          <Crest src={f.away_crest} name={away} size={28} />
        </div>
        <div className="text-xs text-muted">
          {f.competition_name} · <LocalTime date={f.kickoff_at} />
        </div>
        {total > 0 && (
          <div className="space-y-1.5 text-left">
            {SIDES.map((side) => (
              <div key={side} className="flex items-center gap-2 text-xs">
                <span className="w-20 truncate">{pickLabel(side, home, away)}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${shares[side]}%` }} />
                </span>
                <span className="w-9 text-right font-mono">{shares[side]}%</span>
              </div>
            ))}
            <div className="text-center text-xs text-muted">
              {total} {total === 1 ? "fan has" : "fans have"} picked
            </div>
          </div>
        )}
      </section>
      <Link
        href={`/match/${f.id}`}
        className="block rounded-xl bg-accent px-4 py-3 text-center font-semibold text-white hover:bg-accent-strong"
      >
        Think they&apos;re wrong? Make your pick
      </Link>
      <p className="text-center text-xs text-muted">Free to play — no wallet needed.</p>
    </div>
  );
}
