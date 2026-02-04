# Subgraph V3 Update Documentation

> **Date:** January 21, 2025
> **Contract Version:** MatchDayBetV3
> **Subgraph Version:** Updated for V3 compatibility
> **Deployment:** Pending (ready to deploy)

## Overview

This document details the changes made to the MatchDayBet subgraph to support V3 contract features. The subgraph has been updated to track V3's idempotent batch operations and configurable grace period while maintaining full backward compatibility with V2 events.

## Key Changes Summary

### 1. ABI & Configuration Updates

**File:** `subgraph.yaml`
- Changed datasource name from `MatchDayBetV2` to `MatchDayBet` (version-agnostic)
- Updated ABI reference from `MatchDayBetV2.json` to `MatchDayBet.json`
- Added 5 new V3 event handlers
- Contract address and startBlock remain unchanged (UUPS upgrade)

**File:** `abis/MatchDayBet.json`
- Generated from MatchDayBetV3 contract
- Includes all V2 events + 5 new V3 events
- Properly formatted as JSON (not table format)

### 2. Schema Additions

**New Enum:** `SkipReason`
```graphql
enum SkipReason {
  NONE
  ALREADY_RESOLVED_SAME_RESULT
  ALREADY_RESOLVED_DIFFERENT_RESULT
  ALREADY_CLOSED
  ALREADY_CANCELLED
  MATCH_NOT_FOUND
  MATCH_IS_RESOLVED
  MATCH_IS_CANCELLED
  KICKOFF_NOT_REACHED
  INVALID_OUTCOME
}
```

**New Entities:**

1. **MatchResolutionSkip** - Tracks individual skipped match resolutions
   - `id`: txHash-logIndex-matchId
   - `match`: Reference to Match entity (may be null if MATCH_NOT_FOUND)
   - `skipReason`: Why the match was skipped
   - `timestamp`, `blockNumber`, `transactionHash`

2. **BatchResolutionSummary** - Aggregated batch resolution statistics
   - `id`: txHash-logIndex
   - `matchIds`: Array of match IDs in batch
   - `results`: Array of outcomes attempted
   - `resolvedCount`: Number of matches successfully resolved
   - `skippedCount`: Number of matches skipped
   - `timestamp`, `blockNumber`, `transactionHash`

3. **MatchCancellationSkip** - Tracks individual skipped cancellations
   - `id`: txHash-logIndex-matchId
   - `match`: Reference to Match entity (may be null)
   - `skipReason`: Why cancellation was skipped
   - `timestamp`, `blockNumber`, `transactionHash`

4. **BatchCancellationSummary** - Aggregated batch cancellation statistics
   - `id`: txHash-logIndex
   - `matchIds`: Array of match IDs in batch
   - `reason`: Cancellation reason
   - `cancelledCount`: Number successfully cancelled
   - `skippedCount`: Number skipped
   - `timestamp`, `blockNumber`, `transactionHash`

5. **GracePeriodUpdate** - Tracks grace period configuration changes
   - `id`: txHash-logIndex
   - `newGracePeriod`: New grace period value (seconds)
   - `previousGracePeriod`: Previous value
   - `timestamp`, `blockNumber`, `transactionHash`

**Updated Entity:** `GlobalStats`

New V3 fields added:
- `currentGracePeriod: BigInt!` - Current grace period (initialized to 6300 = 105 minutes)
- `totalBatchResolutions: BigInt!` - Number of batch resolution operations
- `totalBatchCancellations: BigInt!` - Number of batch cancellation operations
- `totalSkippedResolutions: BigInt!` - Total matches skipped during resolution
- `totalSkippedCancellations: BigInt!` - Total matches skipped during cancellation

### 3. Event Handlers Added

**File:** `src/match-day-bet-v-2.ts`

Five new event handlers implemented:

1. **handleMatchResolutionSkipped**
   - Creates MatchResolutionSkip entity
   - Increments GlobalStats.totalSkippedResolutions
   - Handles missing match references gracefully

2. **handleBatchMatchesResolvedSummary**
   - Creates BatchResolutionSummary entity
   - Converts outcome enums to strings
   - Increments GlobalStats.totalBatchResolutions

3. **handleMatchCancellationSkipped**
   - Creates MatchCancellationSkip entity
   - Increments GlobalStats.totalSkippedCancellations
   - Handles missing match references gracefully

4. **handleBatchMatchesCancellationSummary**
   - Creates BatchCancellationSummary entity
   - Tracks batch cancellation efficiency
   - Increments GlobalStats.totalBatchCancellations

5. **handleGracePeriodUpdated**
   - Creates GracePeriodUpdate entity
   - Updates GlobalStats.currentGracePeriod
   - Tracks previous value for history

### 4. Helper Functions

**File:** `src/helpers.ts`

Added:
- `skipReasonToString(reason: i32): string` - Converts SkipReason enum to string

Updated:
- `getOrCreateGlobalStats()` - Now initializes V3 fields with defaults:
  - `currentGracePeriod = 6300` (105 minutes)
  - All counters initialized to 0

## V3 Events Indexed

| Event Name | Signature | Purpose |
|------------|-----------|---------|
| MatchResolutionSkipped | `(uint256,uint8)` | Emitted when a match is skipped in batch resolution |
| BatchMatchesResolvedSummary | `(uint256[],uint8[],uint256,uint256)` | Summary stats for batch resolution |
| MatchCancellationSkipped | `(uint256,uint8)` | Emitted when a match is skipped in batch cancellation |
| BatchMatchesCancellationSummary | `(uint256[],string,uint256,uint256)` | Summary stats for batch cancellation |
| GracePeriodUpdated | `(uint256)` | Emitted when grace period is changed |

## Deployment Information

### Contract Details
- **Contract Address:** `0x1b048C7323C7c7FE910a5F0e08B36b0c715e8947` (unchanged - UUPS proxy)
- **Network:** Base L2
- **Start Block:** 40551839 (V2 deployment block - maintained for complete history)

### Deployment Commands

```bash
# Navigate to subgraph directory
cd matchdaybet/subgraph

# Generate types (already done)
yarn codegen

# Build subgraph (already done)
yarn build

# Deploy to Graph Studio
graph deploy --studio matchdaybet-v2

# After deploying, test the new version in Studio UI
# Then publish when ready
```

### Important Notes

- **Same Subgraph URL** - Deployment creates a new version, not a new subgraph
- **Backward Compatible** - All V2 queries continue to work
- **Incremental Sync** - Will start indexing from block 40551839 (may take time to catch up)
- **No Breaking Changes** - Existing bot integration doesn't need updates

## Example Queries

### 1. Check Batch Resolution Efficiency

```graphql
query BatchResolutionStats {
  batchResolutionSummaries(
    first: 10
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    matchIds
    resolvedCount
    skippedCount
    timestamp
    transactionHash
  }
}
```

### 2. Investigate Skipped Matches

```graphql
query SkippedResolutions {
  matchResolutionSkips(
    first: 20
    orderBy: timestamp
    orderDirection: desc
  ) {
    match {
      id
      homeTeam
      awayTeam
      status
    }
    skipReason
    timestamp
    blockNumber
  }
}
```

### 3. Track Grace Period Changes

```graphql
query GracePeriodHistory {
  gracePeriodUpdates(orderBy: timestamp, orderDirection: asc) {
    previousGracePeriod
    newGracePeriod
    timestamp
    transactionHash
  }

  globalStats(id: "1") {
    currentGracePeriod
  }
}
```

### 4. Global V3 Statistics

```graphql
query V3Stats {
  globalStats(id: "1") {
    # V3 specific stats
    currentGracePeriod
    totalBatchResolutions
    totalBatchCancellations
    totalSkippedResolutions
    totalSkippedCancellations

    # General stats (existing)
    totalMatches
    resolvedMatches
    totalBets
    totalVolume
  }
}
```

### 5. Batch Cancellation Analysis

```graphql
query BatchCancellations {
  batchCancellationSummaries(first: 10, orderBy: timestamp, orderDirection: desc) {
    matchIds
    reason
    cancelledCount
    skippedCount
    timestamp
  }

  matchCancellationSkips(first: 20) {
    match {
      id
      homeTeam
      awayTeam
    }
    skipReason
    timestamp
  }
}
```

### 6. Combined Match Analysis

```graphql
query MatchWithSkipInfo($matchId: String!) {
  match(id: $matchId) {
    id
    homeTeam
    awayTeam
    status
    result

    # Check if this match has skip history
    resolutionSkips: matchResolutionSkips(where: { match: $matchId }) {
      skipReason
      timestamp
    }

    cancellationSkips: matchCancellationSkips(where: { match: $matchId }) {
      skipReason
      timestamp
    }
  }
}
```

## Bot Integration Considerations

### No Changes Required
The bot **does not need** any updates to continue functioning. All existing V2 queries and subscriptions will work unchanged.

### Optional Enhancements
If you want to leverage V3 observability features in the bot, consider:

1. **Monitor Batch Operations**
   - Subscribe to `BatchResolutionSummary` to track resolution efficiency
   - Alert on high skip rates (may indicate issues)

2. **Debug Match Issues**
   - Query `MatchResolutionSkip` when matches aren't resolving
   - Display skip reasons to users for transparency

3. **Track Configuration**
   - Display current grace period from `GlobalStats.currentGracePeriod`
   - Show grace period history to explain timing changes

4. **Analytics Dashboard**
   - Use new V3 stats for admin dashboard
   - Show batch operation efficiency metrics
   - Track skip rate trends over time

### Example Bot Queries

```typescript
// Get current grace period for user info
const gracePeriod = await subgraphClient.query({
  query: gql`
    query {
      globalStats(id: "1") {
        currentGracePeriod
      }
    }
  `
});

// Check if a match had resolution issues
const matchIssues = await subgraphClient.query({
  query: gql`
    query($matchId: String!) {
      matchResolutionSkips(where: { match: $matchId }) {
        skipReason
        timestamp
      }
    }
  `,
  variables: { matchId: matchIdStr }
});

// Monitor batch operation health
const batchHealth = await subgraphClient.query({
  query: gql`
    query {
      batchResolutionSummaries(first: 1, orderBy: timestamp, orderDirection: desc) {
        resolvedCount
        skippedCount
      }
    }
  `
});
```

## Testing Checklist

After deployment, verify:

- [ ] All existing V2 queries still work
- [ ] New V3 entities are being created
- [ ] `GlobalStats.currentGracePeriod` is set correctly
- [ ] Skip events are being indexed when they occur
- [ ] Batch summary events are captured
- [ ] Grace period updates are tracked
- [ ] All counters are incrementing correctly
- [ ] Match references in skip entities work (even when null)
- [ ] Enum string conversions are correct

## Troubleshooting

### Subgraph Not Syncing
- Check Graph Studio for indexing errors
- Verify ABI matches deployed contract
- Ensure contract address is correct

### Missing V3 Events
- Confirm contract has been upgraded to V3
- Check if `initializeV3()` was called
- Verify events are being emitted on-chain

### Query Errors
- Run `yarn codegen` and `yarn build` after schema changes
- Check entity relationships are correct
- Verify enum values match contract

## Version History

| Version | Date | Changes |
|---------|------|---------|
| V3 | 2025-01-21 | Added V3 observability features, batch operation tracking, grace period config |
| V2 | 2025-01-12 | Initial deployment with V2 contract support |

## Related Files

- Contract: `../src/MatchDayBetV3.sol`
- Schema: `schema.graphql`
- Mappings: `src/match-day-bet-v-2.ts`
- Helpers: `src/helpers.ts`
- Config: `subgraph.yaml`
- ABI: `abis/MatchDayBet.json`

## Notes

- The subgraph uses version-agnostic naming (`MatchDayBet` instead of `MatchDayBetV3`) to avoid future renames
- All new entities are immutable for gas efficiency and data integrity
- Skip events may have null match references if the match doesn't exist in the subgraph
- Grace period is tracked in seconds (6300 = 105 minutes default)
- Batch summaries provide aggregate stats while individual skip events provide detail

---

**Status:** ✅ Ready for deployment
**Build:** ✅ Compiled successfully
**Types:** ✅ Generated successfully
**Tests:** ⏳ Pending deployment for integration testing
