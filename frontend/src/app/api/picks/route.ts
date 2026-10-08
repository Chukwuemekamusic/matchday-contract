import { z } from "zod";
import { currentUserId } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import type { FixtureRow } from "@/lib/db/types";

const body = z.object({
  fixtureId: z.number().int().positive(),
  prediction: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

/** Make or change a free pick. Picks can be changed until kickoff. */
export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: "Sign in to make a pick" }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid pick" }, { status: 400 });
  const { fixtureId, prediction } = parsed.data;

  const { data: fixture } = await db().from("fixtures").select("status, kickoff_at").eq("id", fixtureId).maybeSingle();
  const f = fixture as Pick<FixtureRow, "status" | "kickoff_at"> | null;
  if (!f) return Response.json({ error: "Unknown match" }, { status: 404 });
  if (!["SCHEDULED", "TIMED"].includes(f.status) || new Date(f.kickoff_at).getTime() <= Date.now()) {
    return Response.json({ error: "Picks are locked — this match has kicked off" }, { status: 400 });
  }

  const now = new Date().toISOString();
  // Re-picking also clears any earlier settlement (e.g. a voided match that was rescheduled)
  const { error } = await db().from("picks").upsert(
    { user_id: userId, fixture_id: fixtureId, prediction, updated_at: now, result: null, points: null, settled_at: null },
    { onConflict: "user_id,fixture_id" },
  );
  if (error) return Response.json({ error: "Could not save your pick" }, { status: 500 });
  return Response.json({ ok: true });
}
