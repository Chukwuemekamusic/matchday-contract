// Stand-in for optional x402 payment dependencies that Coinbase's CDP SDK imports
// (via wagmi's Base Account connector) but this app never uses.
export function toClientEvmSigner(): never {
  throw new Error("x402 payments are not supported in this app");
}
