import { timingSafeEqual } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { chain } from "@/lib/contract/config";
import { db } from "@/lib/db/client";
import { keeperEnv } from "@/lib/env";
import { shortAddress } from "@/lib/format";

export const metadata: Metadata = { title: "Admin — MatchDay", robots: { index: false } };
export const dynamic = "force-dynamic";

interface KeeperRun {
  id: number;
  job: string;
  started_at: string;
  finished_at: string | null;
  ok: boolean | null;
  summary: Record<string, unknown> | null;
}

interface FailedMatch {
  id: number;
  fixture_id: number;
  match_id: number | null;
  create_tx_hash: string | null;
  state: string;
  error: string | null;
  created_at: string;
}

function authorized(given: string | undefined): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(keeperEnv().KEEPER_CRON_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function loadRuns(): Promise<KeeperRun[]> {
  const { data, error } = await db()
    .from("keeper_runs")
    .select("id, job, started_at, finished_at, ok, summary")
    .order("started_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as KeeperRun[];
}

async function loadFailed(): Promise<FailedMatch[]> {
  const { data, error } = await db()
    .from("onchain_matches")
    .select("id, fixture_id, match_id, create_tx_hash, state, error, created_at")
    .eq("state", "failed")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as FailedMatch[];
}

function duration(started: string, finished: string | null): string {
  if (!finished) return "…";
  const ms = new Date(finished).getTime() - new Date(started).getTime();
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const token = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  if (!authorized(token)) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">
        Not authorised. Append <code className="font-mono">?token=&lt;KEEPER_CRON_SECRET&gt;</code> to this URL.
      </div>
    );
  }

  const [runs, failed] = await Promise.all([loadRuns(), loadFailed()]);
  const explorer = chain.blockExplorers?.default.url ?? "https://basescan.org";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <p className="text-sm text-muted">Keeper health. Not linked from anywhere.</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Recent keeper runs</h2>
        {runs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">No runs yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-border">
                  <th className="px-3 py-2">Job</th>
                  <th className="px-3 py-2">Started</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Summary</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-mono">{r.job}</td>
                    <td className="px-3 py-2 text-muted">{new Date(r.started_at).toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-xs">{duration(r.started_at, r.finished_at)}</td>
                    <td className="px-3 py-2">
                      {r.finished_at === null ? (
                        <span className="text-muted">running…</span>
                      ) : r.ok ? (
                        <span className="text-accent-strong">ok</span>
                      ) : (
                        <span className="text-danger">failed</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <code className="font-mono text-xs text-muted">
                        {r.summary ? JSON.stringify(r.summary) : "—"}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Failed on-chain matches</h2>
        {failed.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted">None.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-border">
                  <th className="px-3 py-2">Fixture</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Tx</th>
                  <th className="px-3 py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {failed.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-3 py-2 font-mono">
                      <Link href={`/m/${m.fixture_id}`} className="underline">
                        {m.fixture_id}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted">{new Date(m.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {m.create_tx_hash ? (
                        <a
                          href={`${explorer}/tx/${m.create_tx_hash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {shortAddress(m.create_tx_hash)}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-danger">{m.error ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
