import "server-only";
import { z } from "zod";

const hex64 = z
  .string()
  .trim()
  .transform((v) => (v.startsWith("0x") ? v : `0x${v}`))
  .refine((v): v is `0x${string}` => /^0x[0-9a-fA-F]{64}$/.test(v), {
    message: "must be 64 hex characters (0x prefix optional)",
  });

const supabaseSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const keeperSchema = z.object({
  KEEPER_PRIVATE_KEY: hex64,
  KEEPER_CRON_SECRET: z.string().min(16, "set via `openssl rand -hex 32`"),
  FOOTBALL_DATA_API_KEY: z.string().min(1),
  RPC_URL: z.string().url().optional().or(z.literal("").transform(() => undefined)),
});

const emptyToUndefined = z.literal("").transform(() => undefined);

const alertSchema = z.object({
  // Discord or Slack incoming webhook; alerts are skipped when unset
  ALERT_WEBHOOK_URL: z.string().url().optional().or(emptyToUndefined),
  // Telegram bot token from @BotFather; takes precedence over ALERT_WEBHOOK_URL when both are set
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional().or(emptyToUndefined),
  // Target chat id — personal (positive) or group/channel (usually negative)
  TELEGRAM_CHAT_ID: z.string().min(1).optional().or(emptyToUndefined),
  // Alert when the keeper wallet holds less than this (ETH)
  KEEPER_MIN_BALANCE_ETH: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "must be a decimal ETH amount, e.g. 0.002")
    .optional()
    .or(emptyToUndefined)
    .transform((v) => v ?? "0.002"),
  // Re-send an unresolved alert at most this often
  ALERT_REPEAT_HOURS: z.coerce.number().positive().optional().or(emptyToUndefined).transform((v) => v ?? 6),
});

function parse<T>(schema: z.ZodType<T>, group: string): T {
  const result = schema.safeParse(process.env);
  if (result.success) return result.data;
  const details = result.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid ${group} environment:\n${details}`);
}

let supabase: z.infer<typeof supabaseSchema> | undefined;
let keeper: z.infer<typeof keeperSchema> | undefined;
let alert: z.infer<typeof alertSchema> | undefined;

export function supabaseEnv() {
  if (!supabase) supabase = parse(supabaseSchema, "Supabase");
  return supabase;
}

export function keeperEnv() {
  if (!keeper) keeper = parse(keeperSchema, "keeper");
  return keeper;
}

export function alertEnv() {
  if (!alert) alert = parse(alertSchema, "alert");
  return alert;
}
