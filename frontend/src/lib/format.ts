import { formatEther } from "viem";

/** Format wei as ETH with up to `digits` decimals, trimming trailing zeros */
export function formatEth(wei: bigint, digits = 4): string {
  const [whole, frac = ""] = formatEther(wei).split(".");
  const trimmed = frac.slice(0, digits).replace(/0+$/, "");
  if (!trimmed && wei > 0n && whole === "0") return `<0.${"0".repeat(digits - 1)}1`;
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function formatKickoff(date: Date | string | number): string {
  const d = new Date(date);
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
