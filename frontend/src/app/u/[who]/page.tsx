import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { LocalTime } from "@/components/LocalTime";
import { ShareButton } from "@/components/ShareButton";
import { currentUserId, requestOrigin } from "@/lib/auth/server";
import { profilesForWallets } from "@/lib/db/activity";
import { picksOf, profileByUsername, walletsOf } from "@/lib/db/social";
import { pickLabel } from "@/lib/match";
import { currentStreak, headToHead, signatureTeam, styleLabel } from "@/lib/profileStats";
import { toSettled } from "@/lib/profileView";
import { fetchBettingRecord } from "@/lib/subgraph";

export const dynamic = "force-dynamic";

const isAddress = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s);

export async function generateMetadata({ params }: PageProps<"/u/[who]">): Promise<Metadata> {
  const who = decodeURIComponent((await params).who);
  if (isAddress(who)) return { title: `${who.slice(0, 6)}…${who.slice(-4)} — MatchDay` };
  const profile = await profileByUsername(who).catch(() => null);
  return { title: profile ? `${profile.display_name} (@${profile.username}) — MatchDay` : "Profile — MatchDay" };
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="font-mono text-lg font-semibold">{value}</div>
    </div>
  );
}

export default async function ProfilePage({ params }: PageProps<"/u/[who]">) {
  const who = decodeURIComponent((await params).who);

  if (isAddress(who)) {
    // A linked wallet's canonical page is its owner's profile
    const owner = (await profilesForWallets([who]).catch(() => new Map())).get(who.toLowerCase());
    if (owner) redirect(`/u/${owner.username}`);
    return <WalletProfile address={who} />;
  }

  const profile = await profileByUsername(who);
  if (!profile) notFound();

  const viewerId = await currentUserId();
  const [picks, wallets, origin] = await Promise.all([picksOf(profile.id), walletsOf(profile.id), requestOrigin()]);
  const [eth, viewerPicks] = await Promise.all([
    fetchBettingRecord(wallets).catch(() => null),
    viewerId && viewerId !== profile.id ? picksOf(viewerId, { settledOnly: true }) : Promise.resolve(null),
  ]);

  const settled = toSettled(picks);
  const decided = settled.filter((p) => p.result !== "void");
  const won = decided.filter((p) => p.result === "won").length;
  const points = settled.reduce((sum, p) => sum + p.points, 0);
  const team = signatureTeam(settled);
  const h2h = viewerPicks ? headToHead(toSettled(viewerPicks), settled) : null;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center gap-4">
        <Avatar name={profile.display_name} seed={profile.id} src={profile.avatar_url} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight">{profile.display_name}</h1>
          <div className="text-sm text-muted">@{profile.username}</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-accent-soft px-2.5 py-1 font-medium text-accent-strong">{styleLabel(settled)}</span>
            {team && <span className="rounded-full bg-surface-muted px-2.5 py-1">Backs {team}</span>}
          </div>
        </div>
        <ShareButton
          url={`${origin}/u/${profile.username}`}
          text={`${profile.display_name} on MatchDay: ${won}/${decided.length} correct picks. Think you can beat that?`}
          label="Share profile"
        />
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Points" value={points} />
        <Stat label="Correct" value={decided.length ? `${won}/${decided.length}` : "—"} />
        <Stat label="Streak" value={currentStreak(settled)} />
        <Stat label="Picks" value={picks.length} />
      </div>

      {h2h && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-semibold">You vs {profile.display_name}</h2>
          {h2h.shared === 0 ? (
            <p className="text-sm text-muted">No settled matches picked by both of you yet.</p>
          ) : (
            <p className="text-sm">
              <span className="font-mono text-2xl font-bold">
                {h2h.a} – {h2h.b}
              </span>{" "}
              <span className="text-muted">
                over {h2h.shared} shared {h2h.shared === 1 ? "match" : "matches"}
                {h2h.a > h2h.b ? " — you lead" : h2h.a < h2h.b ? " — they lead" : " — level"}
              </span>
            </p>
          )}
        </section>
      )}

      {eth && eth.bets > 0 && (
        <p className="text-sm text-muted">
          Backed {eth.bets} {eth.bets === 1 ? "pick" : "picks"} with ETH · {eth.won} won · {eth.lost} lost
          {eth.refunded ? ` · ${eth.refunded} refunded` : ""}
        </p>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">Recent picks</h2>
        {picks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">No picks yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {picks.slice(0, 15).map((p) => {
              const f = p.fixtures;
              const home = f.home_short ?? f.home_team;
              const away = f.away_short ?? f.away_team;
              return (
                <li key={p.fixture_id}>
                  <Link href={`/match/${p.fixture_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {home} vs {away}
                        {f.home_score !== null && f.away_score !== null && (
                          <span className="ml-2 font-mono text-muted">
                            {f.home_score}–{f.away_score}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted">
                        {f.competition_name} · <LocalTime date={f.kickoff_at} />
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <div>{pickLabel(p.prediction, home, away)}</div>
                      <ResultBadge result={p.result} points={p.points} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function ResultBadge({ result, points }: { result: string | null; points: number | null }) {
  const cls = "inline-block rounded-full px-2 py-0.5 text-xs font-medium";
  if (result === "won") return <span className={`${cls} bg-accent-soft text-accent-strong`}>+{points} pts</span>;
  if (result === "lost") return <span className={`${cls} bg-surface-muted text-danger`}>Missed</span>;
  if (result === "void") return <span className={`${cls} bg-surface-muted text-muted`}>Void</span>;
  return <span className={`${cls} bg-surface-muted text-muted`}>Pending</span>;
}

async function WalletProfile({ address }: { address: string }) {
  const record = await fetchBettingRecord([address]).catch(() => null);
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  return (
    <div className="space-y-6">
      <section className="flex items-center gap-4">
        <Avatar name={address} seed={address.toLowerCase()} size={72} />
        <div>
          <h1 className="font-mono text-2xl font-bold">{short}</h1>
          <p className="text-sm text-muted">A wallet that hasn&apos;t been linked to a MatchDay profile.</p>
        </div>
      </section>
      {record && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="ETH bets" value={record.bets} />
          <Stat label="Won" value={record.won} />
          <Stat label="Lost" value={record.lost} />
          <Stat label="Refunded" value={record.refunded} />
        </div>
      )}
    </div>
  );
}
