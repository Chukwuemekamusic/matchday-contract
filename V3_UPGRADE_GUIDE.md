# MatchDayBet V3 Upgrade Guide

## Overview

V3 introduces **idempotent batch resolution** to prevent entire batches from failing when one match is already resolved on-chain.

## What Changed

### Contract Changes (`MatchDayBetV3.sol`)

1. **New Event:**
   ```solidity
   event MatchResolutionSkipped(uint256 indexed matchId, Outcome attemptedResult);
   ```

2. **Modified `_resolveMatch()` function:**
   - Now checks if match is already resolved **before** validation
   - Returns early with event emission instead of reverting
   - Makes batch operations idempotent

3. **Modified `_validateResolution()` function:**
   - Removed `MatchAlreadyResolved` revert check
   - Check moved to `_resolveMatch()` for better control flow

4. **Version updated:**
   - `version()` now returns `"3.0.0"`

5. **New initializer:**
   - `initializeV3()` function (currently empty, for future use)

### Bot Changes (`matchday_bet_bot/src/scheduler.ts`)

1. **Simplified retry logic:**
   - Removed pre-filtering of already-resolved matches
   - Removed individual `getMatch()` RPC calls
   - Contract now handles skipping internally

2. **Performance improvement:**
   - Before: N+1 RPC calls (N reads + 1 write)
   - After: 1 RPC call (1 write only)

## Why This Matters

### Problem Before V3:
```
14 matches need resolution → Batch resolve all 14
↓
Match 5 already resolved externally → ENTIRE BATCH REVERTS ❌
↓
All 14 matches stay unresolved → Retry fails again → Infinite loop
```

### Solution in V3:
```
14 matches need resolution → Batch resolve all 14
↓
Match 5 already resolved → SKIP with event ✅
↓
Matches 1-4, 6-14 get resolved → Success! 🎉
```

## Deployment Steps

### 1. Deploy V3 Implementation

```bash
cd matchdaybet

# Deploy new implementation
forge create --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  src/MatchDayBetV3.sol:MatchDayBetV3
```

### 2. Upgrade Proxy

```bash
# Using cast (replace addresses)
cast send <PROXY_ADDRESS> \
  "upgradeToAndCall(address,bytes)" \
  <V3_IMPLEMENTATION_ADDRESS> \
  $(cast calldata "initializeV3()") \
  --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY
```

### 3. Verify Upgrade

```bash
# Check version
cast call <PROXY_ADDRESS> "version()" --rpc-url https://mainnet.base.org
# Should return: "3.0.0"

# Check implementation
cast call <PROXY_ADDRESS> "implementation()" --rpc-url https://mainnet.base.org
# Should return: <V3_IMPLEMENTATION_ADDRESS>
```

### 4. Update Bot Configuration

Update `.env` to point to the proxy (no change needed if already using proxy):
```bash
CONTRACT_ADDRESS=<PROXY_ADDRESS>
```

### 5. Restart Bot

```bash
cd ../matchday_bet_bot
bun run start
```

## Testing the Upgrade

### Test Idempotent Resolution

1. Create a test match
2. Resolve it once
3. Try to resolve it again in a batch
4. Verify:
   - No revert occurs
   - `MatchResolutionSkipped` event is emitted
   - Other matches in batch are resolved

### Monitor Retry Logic

Watch the bot logs for:
```
🔄 Found X matches needing on-chain resolution (retry)
   Retrying: Team A vs Team B (on-chain ID: Y)
✅ Successfully retried X matches (tx: 0x...)
```

## Rollback Plan

If issues arise, you can rollback to V2:

```bash
cast send <PROXY_ADDRESS> \
  "upgradeTo(address)" \
  <V2_IMPLEMENTATION_ADDRESS> \
  --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY
```

## Breaking Changes

**None!** V3 is fully backward compatible with V2.

- All V2 functions work identically
- Storage layout unchanged
- ABI additions only (new event)

## Gas Impact

- **Batch resolution:** Slightly cheaper (early return vs full validation)
- **Single resolution:** No change
- **Bot operations:** Much cheaper (1 RPC call instead of N+1)

## Security Considerations

1. ✅ No new attack vectors
2. ✅ Maintains all V2 security properties
3. ✅ `cancelMatch()` still reverts on resolved matches (unchanged)
4. ✅ Pull payment pattern unchanged
5. ✅ ReentrancyGuard unchanged

## Next Steps

After successful upgrade:

1. Monitor bot logs for 24 hours
2. Verify all stuck matches get resolved
3. Check `MatchResolutionSkipped` events on Basescan
4. Update documentation if needed

