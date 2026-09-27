import { isKeeperRequest } from "@/lib/keeper/auth";
import { recordRun } from "@/lib/keeper/runs";
import { syncFixtures } from "@/lib/keeper/syncFixtures";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isKeeperRequest(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json(await recordRun("sync-fixtures", syncFixtures));
  } catch (err) {
    console.error("[keeper/sync-fixtures]", err);
    return Response.json({ error: "Fixture sync failed" }, { status: 500 });
  }
}
