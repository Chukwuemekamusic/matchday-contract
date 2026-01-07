# MatchDayBet Smart Contract

A parimutuel betting smart contract for football matches, built for the Towns Protocol bot competition.

## Overview

MatchDayBet allows users to bet on football match outcomes (Home Win, Draw, Away Win) using native ETH on Base. It uses a parimutuel betting model where all bets go into a pool and winners split the pot proportionally.

## Key Features

- **Parimutuel Betting**: No bookmaker odds - winners split the losing side's stakes
- **Native ETH**: Simple UX with no token approvals needed
- **Pull-based Payouts**: Users claim their own winnings (saves gas, better UX)
- **Platform Fee**: 1% fee taken from total pool only when there are both winners AND losers
- **Configurable Limits**: Adjustable min/max stake amounts
- **Emergency Controls**: Pausable, cancellable matches with full refunds

## How It Works

### Betting Flow

```
1. Owner creates match with teams, competition, and kickoff time
2. Users place bets (HOME, DRAW, or AWAY) before kickoff
3. Betting auto-closes at kickoff time
4. After match ends, owner resolves with the result
5. Winners claim their share of the pool
```

### Payout Calculation

```
Total Pool: 1000 ETH
Home Pool:   500 ETH (50%)
Draw Pool:   200 ETH (20%)
Away Pool:   300 ETH (30%)

If HOME wins:
- Platform fee: 1000 * 1% = 10 ETH
- Distributable: 1000 - 10 = 990 ETH
- Home bettors split 990 ETH proportionally

Example: User bet 50 ETH on Home
- User share: (50 / 500) * 990 = 99 ETH
- Profit: 99 - 50 = 49 ETH (98% ROI)
```

### Edge Cases

| Scenario                    | Behavior                            |
| --------------------------- | ----------------------------------- |
| Only one outcome has bets   | Winners get refunded (no fee taken) |
| Match cancelled/postponed   | All bettors can claim full refund   |
| User bets on losing outcome | No payout (funds go to winners)     |

## Contract Interface

### For Users

```solidity
// Place a bet
function placeBet(uint256 matchId, Outcome prediction) external payable;

// Claim winnings after match resolves
function claimWinnings(uint256 matchId) external;

// Claim refund if match cancelled
function claimRefund(uint256 matchId) external;

// View functions
function getMatch(uint256 matchId) external view returns (Match memory);
function getOdds(uint256 matchId) external view returns (uint256, uint256, uint256);
function getPools(uint256 matchId) external view returns (uint256, uint256, uint256, uint256);
function getUserBet(uint256 matchId, address user) external view returns (Bet memory);
function calculatePotentialWinnings(uint256 matchId, Outcome outcome, uint256 amount) external view returns (uint256);
```

### For Owner (Bot)

```solidity
// Create a new match
function createMatch(string homeTeam, string awayTeam, string competition, uint256 kickoffTime) external returns (uint256);

// Close betting (called at kickoff)
function closeBetting(uint256 matchId) external;

// Resolve match with result
function resolveMatch(uint256 matchId, Outcome result) external;

// Cancel match (enables refunds)
function cancelMatch(uint256 matchId, string reason) external;

// Withdraw accumulated fees
function withdrawFees(address to) external;

// Admin controls
function setStakeLimits(uint256 newMin, uint256 newMax) external;
function setPlatformFee(uint256 newFeeBps) external;
function pause() external;
function unpause() external;
```

## Enums

```solidity
enum Outcome { NONE, HOME, DRAW, AWAY }
enum MatchStatus { OPEN, CLOSED, RESOLVED, CANCELLED }
```

## Default Configuration

| Parameter    | Value        | Description                   |
| ------------ | ------------ | ----------------------------- |
| Platform Fee | 1% (100 bps) | Taken from pool on resolution |
| Min Stake    | 0.0004 ETH   | ~$1 at $2500/ETH              |
| Max Stake    | 0.04 ETH     | ~$100 at $2500/ETH            |
| Max Fee      | 5% (500 bps) | Hard cap on fee changes       |

## Events

```solidity
event MatchCreated(uint256 indexed matchId, string homeTeam, string awayTeam, string competition, uint256 kickoffTime);
event BetPlaced(uint256 indexed matchId, address indexed bettor, Outcome prediction, uint256 amount, uint256 newPoolTotal);
event BettingClosed(uint256 indexed matchId);
event MatchResolved(uint256 indexed matchId, Outcome result, uint256 totalPool, uint256 winnerPool, uint256 platformFee);
event MatchCancelled(uint256 indexed matchId, string reason);
event WinningsClaimed(uint256 indexed matchId, address indexed bettor, uint256 amount, uint256 profit);
event RefundClaimed(uint256 indexed matchId, address indexed bettor, uint256 amount);
event FeesWithdrawn(address indexed to, uint256 amount);
```

## Security Features

- **ReentrancyGuard**: Protects against reentrancy attacks on claims
- **Pausable**: Emergency pause functionality
- **Ownable**: Admin functions restricted to owner (bot wallet)
- **Custom Errors**: Gas-efficient error handling
- **Input Validation**: Comprehensive checks on all inputs

## Deployment

### Prerequisites

- Node.js & npm
- Foundry or Hardhat
- Base Sepolia ETH for testnet / Base ETH for mainnet

### Using Foundry

```bash
# Install dependencies
forge install OpenZeppelin/openzeppelin-contracts

# Compile
forge build

# Test
forge test

# Deploy to Base Sepolia
forge create --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  src/MatchDayBet.sol:MatchDayBet

# Deploy to Base Mainnet
forge create --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY \
  src/MatchDayBet.sol:MatchDayBet
```

### Using Hardhat

```bash
# Install dependencies
npm install @openzeppelin/contracts

# Compile
npx hardhat compile

# Deploy
npx hardhat run scripts/deploy.js --network base-sepolia
```

## Integration with Towns Bot

The bot interacts with this contract to:

1. **Create matches** daily based on Football-Data.org API
2. **Listen for BetPlaced events** to confirm user bets
3. **Close betting** when matches kick off
4. **Resolve matches** when results come in
5. **Monitor claims** and provide transaction links

## Gas Estimates (Base L2)

| Function      | Estimated Gas | Cost @ 0.001 gwei |
| ------------- | ------------- | ----------------- |
| placeBet      | ~120,000      | ~$0.003           |
| claimWinnings | ~80,000       | ~$0.002           |
| createMatch   | ~150,000      | ~$0.004           |
| resolveMatch  | ~60,000       | ~$0.0015          |

## License

MIT

## Author

Built for the Towns Protocol "Bots That Move Money" competition.
