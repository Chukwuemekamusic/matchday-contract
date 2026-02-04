# MatchDayBet V3 Contract Proposed Update

## Improve ClaimStatus for Already-Claimed Bets

Problem: Currently, claimType: 0 is used for both "not eligible" (lost) and "already
claimed", making user feedback ambiguous.

Solution: Add a new claimType value to distinguish already-claimed bets.

Changes Required:

1.  MatchDayBetV3.sol (lines 957-960):

- Change claimType: 0 to claimType: 3 for already-claimed bets
- Update ClaimStatus struct comment to document: 0=none, 1=winnings, 2=refund,
  3=already_claimed

2.  Bot claim command (matchday_bet_bot/src/handlers/claim.ts):

- Update error handling logic (lines 135-167) to handle claimType: 3
- Show user-friendly message: "You've already claimed this!" instead of generic "Not
  eligible"
- Remove/simplify the database-based check (lines 182-193) since contract is now source of
  truth

3.  Testing:

- Run forge test to ensure contract tests pass
- Update any relevant test cases to expect claimType: 3 for already-claimed scenarios

Benefits:

- Clearer user feedback distinguishing "you lost" from "you already claimed"
- Contract becomes source of truth (no DB dependency)
- More maintainable and semantically correct code
