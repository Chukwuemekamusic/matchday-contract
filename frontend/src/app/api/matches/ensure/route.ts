import { z } from "zod";
import { EnsureMatchError, ensureMatch } from "@/lib/keeper/ensureMatch";

export const maxDuration = 60;

const body = z.object({ fixtureId: z.number().int().positive() });

/** Called by the bet slip when the first bet on a fixture needs its on-chain match */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  try {
    const matchId = await ensureMatch(parsed.data.fixtureId);
    return Response.json({ matchId });
  } catch (err) {
    if (err instanceof EnsureMatchError) return Response.json({ error: err.message }, { status: err.status });
    console.error("[matches/ensure]", err);
    return Response.json({ error: "Could not prepare this match" }, { status: 500 });
  }
}
