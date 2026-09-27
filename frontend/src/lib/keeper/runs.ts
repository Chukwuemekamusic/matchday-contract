import "server-only";
import { db } from "../db/client";

/** Run a keeper job and record its outcome in keeper_runs */
export async function recordRun<T extends object>(job: string, fn: () => Promise<T>): Promise<T> {
  const { data } = await db().from("keeper_runs").insert({ job }).select("id").single();
  const id = data?.id as number | undefined;
  try {
    const summary = await fn();
    if (id) await db().from("keeper_runs").update({ finished_at: new Date().toISOString(), ok: true, summary }).eq("id", id);
    return summary;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (id) {
      await db()
        .from("keeper_runs")
        .update({ finished_at: new Date().toISOString(), ok: false, summary: { error: message } })
        .eq("id", id);
    }
    throw err;
  }
}
