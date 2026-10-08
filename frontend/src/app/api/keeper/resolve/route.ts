import { sendHealthAlerts } from "@/lib/keeper/alerts";
import { isKeeperRequest } from "@/lib/keeper/auth";
import { resolveMatches } from "@/lib/keeper/resolve";
import { recordRun } from "@/lib/keeper/runs";
import { settlePicks } from "@/lib/keeper/settlePicks";

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
    // Free picks settle from fixture results; a failure here mustn't hide the on-chain run
    const picks = await recordRun("settle-picks", settlePicks).catch((err) => {
      console.error("[keeper/settle-picks]", err);
      return { error: "settle-picks failed" };
    });
    await alertSafely();
    return Response.json({ ...summary, picks });
  } catch (err) {
    console.error("[keeper/resolve]", err);
    await alertSafely();
    return Response.json({ error: "Resolve run failed" }, { status: 500 });
  }
}
