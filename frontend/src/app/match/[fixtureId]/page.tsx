import Link from "next/link";
import { notFound } from "next/navigation";
import { FreePick, type MyPick } from "@/components/FreePick";
import { MatchHeader } from "@/components/MatchHeader";
import { MatchPanel } from "@/components/MatchPanel";
import { WhosIn } from "@/components/WhosIn";
import { currentProfile, requestOrigin } from "@/lib/auth/server";
import { matchActivity, type MatchActivity } from "@/lib/db/activity";
import { getFixture } from "@/lib/db/queries";
import { getPick } from "@/lib/db/social";
import { fixtureAcceptsBets, requestTime } from "@/lib/fixtures";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/match/[fixtureId]">) {
  const id = Number((await params).fixtureId);
  const fixture = Number.isInteger(id) ? await getFixture(id).catch(() => null) : null;
  if (!fixture) return { title: "Match — MatchDay" };
  const title = `${fixture.home_team} vs ${fixture.away_team} — MatchDay`;
  const description = `${fixture.competition_name}: who wins? Make your free pick — ${fixture.home_short ?? fixture.home_team}, the draw or ${
    fixture.away_short ?? fixture.away_team
  } — and see who's in.`;
  return { title, description, openGraph: { title, description }, twitter: { title, description } };
}

const NO_ACTIVITY: MatchActivity = { counts: { 1: 0, 2: 0, 3: 0 }, entries: [] };

export default async function MatchPage({ params }: PageProps<"/match/[fixtureId]">) {
  const id = Number((await params).fixtureId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const fixture = await getFixture(id);
  if (!fixture) notFound();

  const now = requestTime();
  const [profile, activity, origin] = await Promise.all([
    currentProfile(),
    matchActivity(fixture.id, fixture.onchain_match_id).catch((err) => {
      console.error("[match] activity", err);
      return NO_ACTIVITY;
    }),
    requestOrigin(),
  ]);
  const pick = profile ? await getPick(profile.id, fixture.id).catch(() => null) : null;
  const myPick: MyPick | null = pick ? { prediction: pick.prediction, result: pick.result, points: pick.points } : null;

  const home = fixture.home_short ?? fixture.home_team;
  const away = fixture.away_short ?? fixture.away_team;
  const score =
    fixture.home_score !== null && fixture.away_score !== null ? { home: fixture.home_score, away: fixture.away_score } : null;
  const picksOpen = ["SCHEDULED", "TIMED"].includes(fixture.status) && new Date(fixture.kickoff_at).getTime() > now;

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
      <FreePick
        fixtureId={fixture.id}
        home={home}
        away={away}
        counts={activity.counts}
        myPick={myPick}
        username={profile?.username ?? null}
        locked={!picksOpen}
        shareUrl={profile ? `${origin}/pick/${fixture.id}/${profile.username}` : null}
      />
      <WhosIn activity={activity} home={home} away={away} now={new Date(now)} />

      <div className="space-y-1 pt-2">
        <h2 className="font-semibold">Back it with ETH</h2>
        <p className="text-sm text-muted">
          Optional. Stake ETH on Base: everyone who picked the result splits the pool. Needs a wallet.
        </p>
      </div>
      <MatchPanel
        fixtureId={fixture.id}
        initialMatchId={fixture.onchain_match_id}
        home={home}
        away={away}
        fixtureOpen={fixtureAcceptsBets(fixture, now)}
        preferredSide={myPick?.prediction}
      />
    </div>
  );
}
