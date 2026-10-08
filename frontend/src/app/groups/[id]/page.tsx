import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PointsTable } from "@/components/PointsTable";
import { ShareButton } from "@/components/ShareButton";
import { currentUserId, requestOrigin } from "@/lib/auth/server";
import { groupById, groupMembers, isMember } from "@/lib/db/groups";
import { pointsTable, type PointsRow } from "@/lib/db/social";
import { requestTime } from "@/lib/fixtures";
import { leaveGroup } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Group — MatchDay", robots: { index: false } };

export default async function GroupPage({ params, searchParams }: PageProps<"/groups/[id]">) {
  const { id } = await params;
  const period = (await searchParams).period === "all" ? "all" : "week";
  const userId = await currentUserId();
  if (!userId) redirect(`/signin?next=/groups/${id}`);

  const group = await groupById(id);
  if (!group) notFound();
  // Tables are private to members; everyone else needs the invite link
  if (!(await isMember(group.id, userId))) notFound();

  const [members, scored, origin] = await Promise.all([
    groupMembers(group.id),
    pointsTable({ groupId: group.id, since: period === "week" ? new Date(requestTime() - 7 * 86400_000) : undefined, limit: 500 }),
    requestOrigin(),
  ]);

  // Members without settled picks yet still appear, at the bottom
  const scoredIds = new Set(scored.map((r) => r.user_id));
  const rows: PointsRow[] = [
    ...scored,
    ...members
      .filter((m) => !scoredIds.has(m.id))
      .map((m) => ({ user_id: m.id, username: m.username, display_name: m.display_name, avatar_url: m.avatar_url, points: 0, played: 0, won: 0 })),
  ];
  const inviteUrl = `${origin}/join/${group.invite_code}`;
  const tab = (key: string, label: string, href: string) => (
    <Link
      href={href}
      aria-current={period === key ? "page" : undefined}
      className={`rounded-md px-3 py-1.5 ${period === key ? "bg-accent text-white" : "text-muted hover:text-foreground"}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-6">
      <Link href="/groups" className="text-sm text-muted hover:text-foreground">
        ← Groups
      </Link>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight">{group.name}</h1>
          <p className="text-sm text-muted">
            {members.length} {members.length === 1 ? "member" : "members"} · invite code{" "}
            <span className="font-mono font-semibold text-foreground">{group.invite_code}</span>
          </p>
        </div>
        <ShareButton
          url={inviteUrl}
          text={`Join "${group.name}" on MatchDay — free football picks, and a table to settle who really knows ball.`}
          label="Invite friends"
        />
      </div>

      <div className="flex w-fit rounded-lg border border-border bg-surface p-1 text-sm">
        {tab("week", "Last 7 days", `/groups/${group.id}`)}
        {tab("all", "All time", `/groups/${group.id}?period=all`)}
      </div>
      <PointsTable rows={rows} highlight={userId} empty="No members yet." />
      <p className="text-xs text-muted">
        Everyone&apos;s free picks count here automatically — just pick matches as usual.{" "}
        <Link href="/" className="underline">
          Find a match
        </Link>
      </p>

      <form action={leaveGroup}>
        <input type="hidden" name="groupId" value={group.id} />
        <button className="text-sm text-muted hover:text-danger">
          {group.owner_id === userId ? "Delete group" : "Leave group"}
        </button>
      </form>
    </div>
  );
}
