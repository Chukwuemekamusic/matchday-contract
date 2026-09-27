import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Keeper routes are called by Supabase pg_cron with `Authorization: Bearer <KEEPER_CRON_SECRET>` */
export function isKeeperRequest(request: Request): boolean {
  const secret = process.env.KEEPER_CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
