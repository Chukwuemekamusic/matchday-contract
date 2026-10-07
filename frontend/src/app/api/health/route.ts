import { checkHealth } from "@/lib/keeper/health";

export const dynamic = "force-dynamic";

/**
 * Public health check for an uptime monitor: 200 when healthy or degraded, 503 when a
 * critical problem exists (keeper out of gas, results job not running, matches unsettled
 * for a day). Internal details are only shown on /admin and in private alerts.
 */
export async function GET() {
  try {
    const report = await checkHealth();
    const issues = report.issues.map(({ key, severity, message }) => ({ key, severity, message }));
    return Response.json({ ...report, issues }, { status: report.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[health]", err);
    return Response.json({ ok: false, status: "down", error: "Health check failed" }, { status: 503 });
  }
}
