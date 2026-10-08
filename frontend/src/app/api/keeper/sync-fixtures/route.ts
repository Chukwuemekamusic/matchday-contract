import { isKeeperRequest } from "@/lib/keeper/auth";
import { postDigestIfDue } from "@/lib/keeper/channel";
import { recordRun } from "@/lib/keeper/runs";
import { syncFixtures } from "@/lib/keeper/syncFixtures";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isKeeperRequest(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const summary = await recordRun("sync-fixtures", syncFixtures);
    const digest = await recordRun("channel", () => postDigestIfDue()).catch((err) => {
      console.error("[keeper/channel]", err);
      return { error: "digest failed" };
    });
    return Response.json({ ...summary, digest });
  } catch (err) {
    console.error("[keeper/sync-fixtures]", err);
    return Response.json({ error: "Fixture sync failed" }, { status: 500 });
  }
}
