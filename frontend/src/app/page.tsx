import { FixtureList } from "@/components/FixtureList";
import { listFixtures } from "@/lib/db/queries";
import { requestTime } from "@/lib/fixtures";
import type { FixtureView } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  let fixtures: FixtureView[] = [];
  let loadError = false;
  try {
    fixtures = await listFixtures();
  } catch (err) {
    console.error("[home] failed to load fixtures", err);
    loadError = true;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Back your team. Split the pot.</h1>
        <p className="max-w-2xl text-sm text-muted">
          Pick home, draw or away on Europe&apos;s top leagues. Every stake goes into one pool per match, and the
          winners share it — no bookmaker. Payouts are paid in ETH on Base.
        </p>
      </section>

      {loadError ? (
        <p className="rounded-xl border border-danger/40 bg-surface p-6 text-sm text-danger">
          Fixtures are unavailable right now. Please try again shortly.
        </p>
      ) : (
        <FixtureList fixtures={fixtures} serverNow={requestTime()} />
      )}
    </div>
  );
}
