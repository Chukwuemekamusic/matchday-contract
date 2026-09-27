import { describe, expect, it } from "vitest";
import { parseEther } from "viem";
import { formatEth } from "./format";

describe("formatEth", () => {
  it("shows up to 4 decimals and trims zeros", () => {
    expect(formatEth(parseEther("1.23456"))).toBe("1.2345");
    expect(formatEth(parseEther("0.0100"))).toBe("0.01");
    expect(formatEth(parseEther("2"))).toBe("2");
    expect(formatEth(0n)).toBe("0");
  });

  it("keeps small amounts visible", () => {
    expect(formatEth(parseEther("0.00002"))).toBe("0.00002");
    expect(formatEth(parseEther("0.0000123"))).toBe("0.000012");
  });

  it("formats negative amounts without -0", () => {
    expect(formatEth(-parseEther("0.00002"))).toBe("-0.00002");
    expect(formatEth(-parseEther("0.0002"))).toBe("-0.0002");
    expect(formatEth(-parseEther("1.5"))).toBe("-1.5");
  });
});
