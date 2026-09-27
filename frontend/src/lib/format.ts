import { formatEther } from "viem";

/**
 * Format wei as ETH. Shows `digits` decimals, but keeps two significant digits for
 * small amounts (0.00002 instead of 0) and never renders a negative value as "-0".
 */
export function formatEth(wei: bigint, digits = 4): string {
  if (wei === 0n) return "0";
  const negative = wei < 0n;
  const [whole, frac = ""] = formatEther(negative ? -wei : wei).split(".");

  let decimals = digits;
  if (whole === "0") {
    const firstSignificant = frac.search(/[1-9]/);
    if (firstSignificant >= digits) decimals = Math.min(firstSignificant + 2, 18);
  }
  const trimmed = frac.slice(0, decimals).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${trimmed ? `.${trimmed}` : ""}`;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
