import { isKeeperRequest } from "@/lib/keeper/auth";
import { resolveMatches } from "@/lib/keeper/resolve";
import { recordRun } from "@/lib/keeper/runs";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isKeeperRequest(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json(await recordRun("resolve", resolveMatches));
  } catch (err) {
    console.error("[keeper/resolve]", err);
    return Response.json({ error: "Resolve run failed" }, { status: 500 });
  }
}
