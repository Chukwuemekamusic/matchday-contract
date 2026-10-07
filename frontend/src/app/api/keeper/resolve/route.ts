import { sendHealthAlerts } from "@/lib/keeper/alerts";
import { isKeeperRequest } from "@/lib/keeper/auth";
import { resolveMatches } from "@/lib/keeper/resolve";
import { recordRun } from "@/lib/keeper/runs";

export const maxDuration = 60;

async function alertSafely() {
  try {
    await sendHealthAlerts();
  } catch (err) {
    console.error("[keeper/alerts]", err);
  }
}

export async function POST(request: Request) {
  if (!isKeeperRequest(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const summary = await recordRun("resolve", resolveMatches);
    await alertSafely();
    return Response.json(summary);
  } catch (err) {
    console.error("[keeper/resolve]", err);
    await alertSafely();
    return Response.json({ error: "Resolve run failed" }, { status: 500 });
  }
}
