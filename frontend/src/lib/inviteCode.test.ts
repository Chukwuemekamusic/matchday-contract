import { describe, expect, it } from "vitest";
import { newInviteCode, normaliseInviteCode } from "./inviteCode";

describe("invite codes", () => {
  it("are 8 unambiguous characters", () => {
    for (let i = 0; i < 50; i++) expect(newInviteCode()).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
  });

  it("accept lower case and reject ambiguous or wrong-length input", () => {
    expect(normaliseInviteCode(" abcd2345 ")).toBe("ABCD2345");
    expect(normaliseInviteCode("ABCD0O1I")).toBeNull();
    expect(normaliseInviteCode("ABC")).toBeNull();
  });
});
