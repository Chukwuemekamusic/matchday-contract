import "server-only";
import { timingSafeEqual } from "node:crypto";
import { keeperEnv } from "../env";

/** Keeper routes are called by Supabase pg_cron with `Authorization: Bearer <KEEPER_CRON_SECRET>` */
export function isKeeperRequest(request: Request): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${keeperEnv().KEEPER_CRON_SECRET}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
