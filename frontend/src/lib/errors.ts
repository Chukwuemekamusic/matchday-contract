import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";

const CONTRACT_ERRORS: Record<string, string> = {
  AlreadyBet: "You already have a bet on this match — it's one bet per wallet per match.",
  BelowMinStake: "Stake is below the minimum.",
  AboveMaxStake: "Stake is above the maximum.",
  BettingIsClosed: "Betting closed at kickoff.",
  MatchNotOpen: "This match is no longer taking bets.",
  MatchIsPaused: "Betting on this match is paused.",
  EnforcedPause: "Betting is paused right now.",
  InvalidOutcome: "Pick home, draw or away.",
  MatchNotFound: "This match doesn't exist on-chain.",
  NothingToClaim: "Nothing left to claim.",
  AlreadyClaimed: "Already claimed.",
  NotAWinner: "This bet didn't win.",
  NoBetFound: "No bet found for this wallet.",
  MatchNotResolved: "This match hasn't been settled yet.",
  MatchNotCancelled: "This match wasn't cancelled.",
  TransferFailed: "The payout transfer failed.",
};

/** Human-readable message for a wallet / contract / fetch error */
export function errorMessage(err: unknown): string {
  if (err instanceof BaseError) {
    if (err.walk((e) => e instanceof UserRejectedRequestError)) return "Transaction cancelled in your wallet.";
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName;
      if (name && CONTRACT_ERRORS[name]) return CONTRACT_ERRORS[name];
      if (name) return `Transaction rejected: ${name}`;
    }
    if (/insufficient funds/i.test(err.message)) return "Not enough ETH to cover the stake and gas.";
    return err.shortMessage;
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}
