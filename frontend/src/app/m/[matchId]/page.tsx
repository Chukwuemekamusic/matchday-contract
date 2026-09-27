import { notFound, redirect } from "next/navigation";
import { OnChainMatchView } from "@/components/OnChainMatchView";
import { fixtureIdForMatch } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/** Link target by on-chain match id (used from "My bets"): goes to the fixture page when we have one */
export default async function OnChainMatchPage({ params }: PageProps<"/m/[matchId]">) {
  const id = Number((await params).matchId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const fixtureId = await fixtureIdForMatch(id).catch(() => null);
  if (fixtureId) redirect(`/match/${fixtureId}`);

  // Matches created before this app (e.g. by the Towns bot) only exist on-chain
  return <OnChainMatchView matchId={id} />;
}
