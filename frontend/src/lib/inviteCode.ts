import { randomInt } from "node:crypto";

/** No 0/O, 1/I/L: codes get read out loud and typed from screenshots */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function newInviteCode(length = 8): string {
  let code = "";
  for (let i = 0; i < length; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

export function normaliseInviteCode(input: string): string | null {
  const code = input.trim().toUpperCase();
  return /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/.test(code) ? code : null;
}
