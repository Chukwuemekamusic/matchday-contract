Let's build out the technical architecture for the Football Match Day Betting Bot.

---

## Technical Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TOWNS PROTOCOL LAYER                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐          │
│  │   Towns Space   │    │  Bot Framework  │    │   User Wallets  │          │
│  │  (Betting Room) │◄──►│ @towns-protocol │◄──►│   (Base Chain)  │          │
│  │                 │    │      /bot       │    │                 │          │
│  └─────────────────┘    └────────┬────────┘    └─────────────────┘          │
└──────────────────────────────────┼──────────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                              ▼
┌─────────────────────────────┐    ┌─────────────────────────────────────────┐
│      BACKEND SERVICE        │    │           BASE CHAIN (L2)               │
│  ┌───────────────────────┐  │    │  ┌─────────────────────────────────┐    │
│  │    Bot Server         │  │    │  │   MatchDayBet.sol               │    │
│  │    (Node.js)          │  │    │  │   - createMatch()               │    │
│  │                       │  │    │  │   - placeBet()                  │    │
│  │  • Event Handlers     │  │    │  │   - resolveMatch()              │    │
│  │  • Command Parser     │──┼────┼─►│   - claimWinnings()             │    │
│  │  • Match Scheduler    │  │    │  │   - refund()                    │    │
│  │  • Result Resolver    │  │    │  └─────────────────────────────────┘    │
│  └───────────┬───────────┘  │    │                                         │
│              │              │    │  ┌─────────────────────────────────┐    │
│  ┌───────────▼───────────┐  │    │  │   Native ETH (base)             │    │
│  │    Database           │  │    │  │   (existing on Base)            │    │
│  │    (PostgreSQL)       │  │    │  └─────────────────────────────────┘    │
│  │                       │  │    │                                         │
│  │  • Match metadata     │  │    └─────────────────────────────────────────┘
│  │  • API match IDs      │  │
│  │  • Scheduled jobs     │  │
│  └───────────────────────┘  │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│    EXTERNAL DATA SOURCE     │
│  ┌───────────────────────┐  │
│  │  Football-Data.org    │  │
│  │  API                  │  │
│  │                       │  │
│  │  • Match schedules    │  │
│  │  • Kickoff times      │  │
│  │  • Final results      │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

---

### Component Breakdown

#### 1. Smart Contract: `MatchDayBet.sol`

This is the core on-chain logic handling all funds.

```
┌────────────────────────────────────────────────────────────────┐
│                     MatchDayBet.sol                            │
├────────────────────────────────────────────────────────────────┤
│  State Variables:                                              │
│  ─────────────────                                             │
│  • owner (address)                                             │
│  • usdcToken (IERC20)                                          │
│  • platformFeePercent (uint256) = 100 (1%)                     │
│  • minStake (uint256) = 1 USDC                                 │
│  • maxStake (uint256) = 100 USDC                               │
│  • matches (mapping matchId => Match)                          │
│  • bets (mapping matchId => outcome => Bet[])                  │
│  • userBets (mapping user => matchId => Bet)                   │
├────────────────────────────────────────────────────────────────┤
│  Structs:                                                      │
│  ────────                                                      │
│  Match {                                                       │
│    uint256 matchId;                                            │
│    uint256 kickoffTime;                                        │
│    uint256 totalPool;                                          │
│    uint256[3] outcomePools; // [home, draw, away]              │
│    Outcome result;          // PENDING, HOME, DRAW, AWAY       │
│    Status status;           // OPEN, CLOSED, RESOLVED, REFUNDED│
│  }                                                             │
│                                                                │
│  Bet {                                                         │
│    address bettor;                                             │
│    uint256 amount;                                             │
│    Outcome prediction;                                         │
│    bool claimed;                                               │
│  }                                                             │
├────────────────────────────────────────────────────────────────┤
│  Functions:                                                    │
│  ──────────                                                    │
│  createMatch(matchId, kickoffTime)           [onlyOwner]       │
│  placeBet(matchId, outcome) payable         [external]         │
│  closeBetting(matchId)                       [onlyOwner]       │
│  resolveMatch(matchId, result)               [onlyOwner]       │
│  claimWinnings(matchId)                      [public]          │
│  refundBets(matchId)                         [onlyOwner]       │
│  getMatchOdds(matchId) → uint256[3]          [view]            │
│  getUserBet(user, matchId) → Bet             [view]            │
└────────────────────────────────────────────────────────────────┘
```

**Key Logic:**

```
placeBet(matchId, outcome):
  1. Require match.status == OPEN
  2. Require block.timestamp < match.kickoffTime
  3. Require msg.value >= minStake && msg.value <= maxStake
  4. Require user hasn't already bet on this match
  5. Transfer msg.value from user to contract
  6. Update match.totalPool += msg.value
  7. Update match.outcomePools[outcome] += msg.value
  8. Store bet in bets mapping
  9. Emit BetPlaced event

claimWinnings(matchId):
  1. Require match.status == RESOLVED
  2. Require user has winning bet && !claimed
  3. Calculate winnings:
     - If only one outcome had bets → refund original stake
     - Else:
       winnerPool = match.outcomePools[result]
       loserPool = match.totalPool - winnerPool
       fee = match.totalPool * platformFeePercent / 10000
       distributablePool = match.totalPool - fee
       userShare = (userBet.amount / winnerPool) * distributablePool
  4. Mark bet as claimed
  5. Transfer ETH to user
  6. Emit WinningsClaimed event
```

---

#### 2. Bot Server Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Bot Server (Node.js)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Towns Client   │  │  Command Router │  │  Ethers.js      │  │
│  │  Connection     │─►│  & Parser       │─►│  Contract Calls │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Command Handlers                         ││
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────────────┐  ││
│  │  │ /matches  │ │ /bet      │ │ /mybets   │ │ /claim      │  ││
│  │  │           │ │           │ │           │ │             │  ││
│  │  │ List      │ │ Place a   │ │ Show      │ │ Claim       │  ││
│  │  │ today's   │ │ bet on    │ │ user's    │ │ winnings    │  ││
│  │  │ matches   │ │ a match   │ │ bets      │ │             │  ││
│  │  └───────────┘ └───────────┘ └───────────┘ └─────────────┘  ││
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐                  ││
│  │  │ /odds     │ │ /help     │ │ /leaderboard│                ││
│  │  │           │ │           │ │             │                ││
│  │  │ Show      │ │ Show      │ │ Top winners │                ││
│  │  │ current   │ │ commands  │ │ this week   │                ││
│  │  │ pool odds │ │           │ │             │                ││
│  │  └───────────┘ └───────────┘ └─────────────┘                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Scheduled Jobs (cron)                    ││
│  │                                                             ││
│  │  • 06:00 UTC — Fetch today's matches, create on-chain       ││
│  │  • Every 5 min — Check for matches starting soon, close     ││
│  │  • Every 15 min — Check for finished matches, resolve       ││
│  │  • 23:00 UTC — Post daily summary                           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

#### 3. User Interaction Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                        USER JOURNEY                                  │
└──────────────────────────────────────────────────────────────────────┘

Morning (Auto-posted by bot):
═══════════════════════════════════════════════════════════════════════
Bot: 🏆 Today's Matches — Sunday, Jan 4

     #1 Arsenal vs Chelsea (Premier League)
        ⏰ Kickoff: 14:00 UTC
        💰 Pool: 0 USDC

     #2 Barcelona vs Real Madrid (La Liga)
        ⏰ Kickoff: 20:00 UTC
        💰 Pool: 0 USDC

     Use /bet <match#> <home|draw|away> <amount> to place your bet!
═══════════════════════════════════════════════════════════════════════

User places bet:
═══════════════════════════════════════════════════════════════════════
User: /bet 1 home 25

Bot:  ⚽ Bet Confirmation
      ─────────────────────
      Match: Arsenal vs Chelsea
      Your pick: Arsenal Win (Home)
      Stake: 25 USDC

      ⚠️ This will transfer 25 USDC from your wallet.
      Reply "confirm" to proceed.

User: confirm

Bot:  ✅ Bet placed successfully!

      📊 Updated Odds for Arsenal vs Chelsea:
      • Arsenal: 1.8x (55 USDC in pool)
      • Draw: 3.2x (20 USDC in pool)
      • Chelsea: 2.4x (25 USDC in pool)

      Total Pool: 100 USDC
      TX: 0x123...abc [link]
═══════════════════════════════════════════════════════════════════════

Match ends — Auto-resolution:
═══════════════════════════════════════════════════════════════════════
Bot: 🏁 Match Result: Arsenal 2-1 Chelsea

     Winner: Arsenal (Home) ✅

     💰 Pool Distribution:
     • Total pool: 500 USDC
     • Platform fee (1%): 5 USDC
     • Winner pool: 275 USDC
     • Payout pool: 495 USDC

     Winners can claim using /claim 1

     TX: 0x456...def [link]
═══════════════════════════════════════════════════════════════════════

User claims:
═══════════════════════════════════════════════════════════════════════
User: /claim 1

Bot:  🎉 Congratulations!

      You bet 25 USDC on Arsenal
      Your winnings: 45 USDC
      Profit: +20 USDC (80% ROI)

      ✅ 45 USDC sent to your wallet
      TX: 0x789...ghi [link]
═══════════════════════════════════════════════════════════════════════
```

---

#### 4. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW                                   │
└─────────────────────────────────────────────────────────────────────┘

1. MATCH CREATION (Daily @ 06:00 UTC)
   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
   │ Football API │─────►│  Bot Server  │─────►│ Smart        │
   │ GET /matches │      │ Parse &      │      │ Contract     │
   │ ?dateFrom=   │      │ Filter       │      │ createMatch()│
   │  today       │      │              │      │              │
   └──────────────┘      └──────┬───────┘      └──────────────┘
                                │
                                ▼
                         ┌──────────────┐
                         │  Database    │
                         │  Store       │
                         │  matchId →   │
                         │  apiMatchId  │
                         └──────────────┘

2. BETTING (User-initiated)
   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
   │ User in      │─────►│  Bot Server  │─────►│ Smart        │
   │ Towns Space  │      │ Validate &   │      │ Contract     │
   │ "/bet 1      │      │ Format TX    │      │ placeBet()   │
   │  home 25"    │      │              │      │              │
   └──────────────┘      └──────────────┘      └──────┬───────┘
                                                      │
                                                      ▼
                                               ┌──────────────┐
                                               │ User Wallet  │
                                               │ Signs TX     │
                                               │ ETH Transfer │
                                               └──────────────┘

3. RESOLUTION (Auto @ match end + 2hrs)
   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
   │ Football API │─────►│  Bot Server  │─────►│ Smart        │
   │ GET /matches │      │ Check status │      │ Contract     │
   │ /{id}        │      │ == FINISHED  │      │ resolveMatch │
   │              │      │              │      │ (matchId,    │
   │ status:      │      │ Map result   │      │  result)     │
   │ "FINISHED"   │      │ to enum      │      │              │
   │ score:       │      │              │      │              │
   │ {home, away} │      │              │      │              │
   └──────────────┘      └──────────────┘      └──────────────┘

4. CLAIMING (User-initiated)
   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
   │ User in      │─────►│  Bot Server  │─────►│ Smart        │
   │ Towns Space  │      │ Generate TX  │      │ Contract     │
   │ "/claim 1"   │      │              │      │ claimWinnings│
   └──────────────┘      └──────────────┘      └──────┬───────┘
                                                      │
                                                      ▼
                                               ┌──────────────┐
                                               │ USDC sent to │
                                               │ user wallet  │
                                               └──────────────┘
```

---

#### 5. Database Schema

```sql
-- Matches table (links on-chain matchId to API data)
CREATE TABLE matches (
    id SERIAL PRIMARY KEY,
    on_chain_match_id INTEGER UNIQUE NOT NULL,
    api_match_id INTEGER NOT NULL,           -- Football-Data.org ID
    home_team VARCHAR(100) NOT NULL,
    away_team VARCHAR(100) NOT NULL,
    competition VARCHAR(100) NOT NULL,       -- Premier League, La Liga, etc.
    kickoff_time TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'SCHEDULED',  -- SCHEDULED, LIVE, FINISHED
    home_score INTEGER,
    away_score INTEGER,
    result VARCHAR(10),                      -- HOME, DRAW, AWAY
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

-- For tracking which matches we've posted to Towns
CREATE TABLE posted_matches (
    match_id INTEGER REFERENCES matches(id),
    towns_message_id VARCHAR(100),
    posted_at TIMESTAMP DEFAULT NOW()
);

-- Leaderboard / stats cache
CREATE TABLE user_stats (
    user_address VARCHAR(42) PRIMARY KEY,
    total_bets INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    total_wagered DECIMAL(18, 6) DEFAULT 0,
    total_won DECIMAL(18, 6) DEFAULT 0,
    profit DECIMAL(18, 6) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

#### 6. Tech Stack Summary

| Layer              | Technology                             | Purpose                                |
| ------------------ | -------------------------------------- | -------------------------------------- |
| **Chat Interface** | Towns Protocol (`@towns-protocol/bot`) | User interactions in Space             |
| **Smart Contract** | Solidity + OpenZeppelin                | On-chain betting logic, USDC handling  |
| **Backend**        | Node.js + TypeScript                   | Bot logic, scheduling, API integration |
| **Database**       | PostgreSQL                             | Match metadata, stats caching          |
| **Chain**          | Base (L2)                              | Low gas, fast transactions             |
| **Token**          | USDC                                   | Stable value for betting               |
| **External API**   | Football-Data.org                      | Match schedules & results              |
| **Deployment**     | Railway / Render / VPS                 | Bot hosting                            |

---

### Security Considerations

| Risk                       | Mitigation                                                               |
| -------------------------- | ------------------------------------------------------------------------ |
| Oracle manipulation        | Use reputable API (Football-Data.org), add delay before resolution       |
| Bot private key compromise | Use separate hot wallet with limited funds, multi-sig for fee withdrawal |
| Smart contract bugs        | Thorough testing, consider audit before mainnet                          |
| API downtime               | Fallback to manual resolution, grace period for claims                   |
| Front-running              | Not critical for parimutuel (no fixed odds to exploit)                   |

---

What would you like to dive into next?

1. **Smart contract code** — Start writing `MatchDayBet.sol`
2. **Bot command handlers** — Design the Towns bot interaction logic
3. **API integration** — Football-Data.org endpoints and data mapping
4. **Something else?**
