import type { NextConfig } from "next";

// Coinbase's CDP SDK (pulled in by wagmi's Base Account connector) has optional
// x402 payment peer dependencies that this app doesn't use; resolve them to an empty module.
const unusedOptionalDeps = [
  "@x402/core/client",
  "@x402/evm",
  "@x402/evm/exact/client",
  "@x402/evm/upto/client",
  "@x402/svm/exact/client",
];

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: Object.fromEntries(unusedOptionalDeps.map((dep) => [dep, "./src/lib/shims/empty.ts"])),
  },
};

export default nextConfig;
