import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { joinGroup } from "@/app/groups/actions";
import { currentUserId } from "@/lib/auth/server";
import { groupByCode, groupMembers, isMember } from "@/lib/db/groups";
import { normaliseInviteCode } from "@/lib/inviteCode";

export const dynamic = "force-dynamic";

async function load(params: PageProps<"/join/[code]">["params"]) {
  const code = normaliseInviteCode((await params).code);
  return code ? { code, group: await groupByCode(code).catch(() => null) } : null;
}

export async function generateMetadata({ params }: PageProps<"/join/[code]">): Promise<Metadata> {
  const found = await load(params);
  if (!found?.group) return { title: "MatchDay" };
  const title = `Join "${found.group.name}" on MatchDay`;
  const description = "Free football picks and a group table to settle who really knows ball.";
  return { title, description, openGraph: { title, description }, twitter: { title, description }, robots: { index: false } };
}

export default async function JoinPage({ params, searchParams }: PageProps<"/join/[code]">) {
  const found = await load(params);
  if (!found?.group) notFound();
  const { code, group } = found;
  const full = (await searchParams).full === "1";

  const userId = await currentUserId();
  if (userId && (await isMember(group.id, userId))) redirect(`/groups/${group.id}`);
  const members = await groupMembers(group.id);
  const owner = members.find((m) => m.id === group.owner_id);

  return (
    <div className="mx-auto max-w-md space-y-5 py-6 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-accent-soft text-2xl font-bold text-accent-strong">
        {group.name.slice(0, 1).toUpperCase()}
      </span>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
        <p className="text-sm text-muted">
          {owner ? `${owner.display_name} invited you` : "You're invited"} · {members.length}{" "}
          {members.length === 1 ? "member" : "members"}
        </p>
      </div>
      <p className="text-sm text-muted">
        Make free picks on Europe&apos;s top matches and see who tops your group&apos;s table each week. No wallet needed.
      </p>
      {full ? (
        <p className="text-sm text-danger">This group is full.</p>
      ) : userId ? (
        <form action={joinGroup}>
          <input type="hidden" name="code" value={code} />
          <button className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white hover:bg-accent-strong">
            Join group
          </button>
        </form>
      ) : (
        <Link
          href={`/signin?next=${encodeURIComponent(`/join/${code}`)}`}
          className="block w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white hover:bg-accent-strong"
        >
          Sign in to join
        </Link>
      )}
    </div>
  );
}
