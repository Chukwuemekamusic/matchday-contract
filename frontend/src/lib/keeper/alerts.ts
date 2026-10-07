import "server-only";
import { db } from "../db/client";
import { alertEnv } from "../env";
import type { HealthIssue } from "../health";
import { siteUrl } from "../site";
import { checkHealth } from "./health";

interface AlertRow {
  key: string;
  severity: string;
  message: string;
  last_sent_at: string;
}

const icon = (severity: string) => (severity === "critical" ? "🔴" : "🟡");

/** Discord reads `content`, Slack reads `text`; each ignores the other */
async function postWebhook(url: string, message: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: message, text: message }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Alert webhook failed: ${res.status} ${await res.text()}`);
}

/**
 * Check health and post new, repeating (every ALERT_REPEAT_HOURS) and resolved problems to
 * ALERT_WEBHOOK_URL. Called after each resolve run. If pg_cron itself stops, nothing calls
 * this — that case is covered by an uptime monitor on /api/health.
 */
export async function sendHealthAlerts() {
  const { ALERT_WEBHOOK_URL, ALERT_REPEAT_HOURS } = alertEnv();
  if (!ALERT_WEBHOOK_URL) return { sent: 0, skipped: "ALERT_WEBHOOK_URL not set" };

  const report = await checkHealth();
  const { data, error } = await db().from("alert_log").select("key, severity, message, last_sent_at");
  if (error) throw error;
  const logged = new Map((data as AlertRow[]).map((r) => [r.key, r]));
  const repeatMs = ALERT_REPEAT_HOURS * 3600_000;
  const now = Date.now();

  const due: HealthIssue[] = report.issues.filter((issue) => {
    const prev = logged.get(issue.key);
    return !prev || prev.severity !== issue.severity || now - new Date(prev.last_sent_at).getTime() >= repeatMs;
  });
  const active = new Set(report.issues.map((i) => i.key));
  const resolved = [...logged.values()].filter((row) => !active.has(row.key));

  if (due.length === 0 && resolved.length === 0) return { sent: 0 };

  const lines = [
    ...due.map((i) => `${icon(i.severity)} ${i.message}${i.detail ? ` — ${i.detail}` : ""}`),
    ...resolved.map((r) => `✅ Resolved: ${r.message}`),
  ];
  await postWebhook(ALERT_WEBHOOK_URL, [`**MatchDay keeper**`, ...lines, `${siteUrl().origin}/admin`].join("\n"));

  // Only record after a successful post, so a failed webhook is retried next run
  if (due.length) {
    const sentAt = new Date().toISOString();
    const { error: upsertError } = await db()
      .from("alert_log")
      .upsert(due.map((i) => ({ key: i.key, severity: i.severity, message: i.message, last_sent_at: sentAt })));
    if (upsertError) throw upsertError;
  }
  if (resolved.length) {
    const { error: deleteError } = await db()
      .from("alert_log")
      .delete()
      .in(
        "key",
        resolved.map((r) => r.key),
      );
    if (deleteError) throw deleteError;
  }
  return { sent: due.length, resolved: resolved.length };
}
