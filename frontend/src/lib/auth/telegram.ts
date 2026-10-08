import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export interface TelegramLogin {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string;
  hash: string;
}

const FIELDS = ["id", "first_name", "last_name", "username", "photo_url", "auth_date"] as const;

/**
 * Verify data from the Telegram Login Widget
 * (https://core.telegram.org/widgets/login#checking-authorization):
 * HMAC-SHA256 of the sorted "key=value" lines, keyed with SHA256(bot token).
 */
export function verifyTelegramLogin(
  params: Record<string, string | undefined>,
  botToken: string,
  nowSec = Math.floor(Date.now() / 1000),
  maxAgeSec = 86400,
): TelegramLogin | null {
  const { hash, id, auth_date } = params;
  if (!hash || !id || !auth_date || !/^[0-9a-f]{64}$/.test(hash)) return null;

  const checkString = FIELDS.filter((k) => params[k] !== undefined)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("\n");
  const secret = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(checkString).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, "hex"))) return null;

  const age = nowSec - Number(auth_date);
  if (!Number.isFinite(age) || age < -60 || age > maxAgeSec) return null;

  const login: TelegramLogin = { id, auth_date, hash };
  for (const k of ["first_name", "last_name", "username", "photo_url"] as const) {
    if (params[k] !== undefined) login[k] = params[k];
  }
  return login;
}

/** Stable synthetic email for a Telegram account (example.com is reserved, so it can never be a real inbox) */
export const telegramEmail = (telegramId: string) => `telegram-${telegramId}@telegram.example.com`;
