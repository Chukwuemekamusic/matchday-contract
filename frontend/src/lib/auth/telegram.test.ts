import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyTelegramLogin } from "./telegram";

const TOKEN = "123456:TEST-token";

function sign(fields: Record<string, string>) {
  const check = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
  const secret = createHash("sha256").update(TOKEN).digest();
  return { ...fields, hash: createHmac("sha256", secret).update(check).digest("hex") };
}

const now = 1_800_000_000;
const login = { id: "42", first_name: "Ada", username: "ada_fc", auth_date: String(now - 30) };

describe("verifyTelegramLogin", () => {
  it("accepts correctly signed, fresh data", () => {
    expect(verifyTelegramLogin(sign(login), TOKEN, now)).toMatchObject({ id: "42", first_name: "Ada", username: "ada_fc" });
  });

  it("rejects tampered fields and wrong tokens", () => {
    expect(verifyTelegramLogin({ ...sign(login), id: "43" }, TOKEN, now)).toBeNull();
    expect(verifyTelegramLogin(sign(login), "999:other", now)).toBeNull();
  });

  it("rejects stale or malformed logins", () => {
    expect(verifyTelegramLogin(sign({ ...login, auth_date: String(now - 2 * 86400) }), TOKEN, now)).toBeNull();
    expect(verifyTelegramLogin({ ...login, hash: "nothex" }, TOKEN, now)).toBeNull();
  });

  it("ignores unknown query params such as next", () => {
    expect(verifyTelegramLogin({ ...sign(login), next: "/me" }, TOKEN, now)).not.toBeNull();
  });
});
