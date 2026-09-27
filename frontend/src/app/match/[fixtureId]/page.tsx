import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchHeader } from "@/components/MatchHeader";
import { MatchPanel } from "@/components/MatchPanel";
import { getFixture } from "@/lib/db/queries";
import { fixtureAcceptsBets, requestTime } from "@/lib/fixtures";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/match/[fixtureId]">) {
  const id = Number((await params).fixtureId);
  const fixture = Number.isInteger(id) ? await getFixture(id).catch(() => null) : null;
  if (!fixture) return { title: "Match — MatchDay" };
  const title = `${fixture.home_team} vs ${fixture.away_team} — MatchDay`;
  const description = `${fixture.competition_name}: pick ${fixture.home_short ?? fixture.home_team}, the draw or ${
    fixture.away_short ?? fixture.away_team
  }. Winners split the pool.`;
  return { title, description, openGraph: { title, description }, twitter: { title, description } };
}

export default async function MatchPage({ params }: PageProps<"/match/[fixtureId]">) {
  const id = Number((await params).fixtureId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const fixture = await getFixture(id);
  if (!fixture) notFound();

  const home = fixture.home_short ?? fixture.home_team;
  const away = fixture.away_short ?? fixture.away_team;
  const score =
    fixture.home_score !== null && fixture.away_score !== null ? { home: fixture.home_score, away: fixture.away_score } : null;

  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← All matches
      </Link>
      <MatchHeader
        competition={fixture.competition_name}
        home={{ name: fixture.home_team, crest: fixture.home_crest }}
        away={{ name: fixture.away_team, crest: fixture.away_crest }}
        kickoff={new Date(fixture.kickoff_at)}
        status={fixture.status}
        score={score}
      />
      <MatchPanel
        fixtureId={fixture.id}
        initialMatchId={fixture.onchain_match_id}
        home={home}
        away={away}
        fixtureOpen={fixtureAcceptsBets(fixture, requestTime())}
      />
    </div>
  );
}
