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

export function supabaseEnv() {
  if (!supabase) supabase = parse(supabaseSchema, "Supabase");
  return supabase;
}

export function keeperEnv() {
  if (!keeper) keeper = parse(keeperSchema, "keeper");
  return keeper;
}
