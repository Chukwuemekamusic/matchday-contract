import { Address, BigInt } from "@graphprotocol/graph-ts"
import {
  MatchCreated,
  BettingClosed,
  MatchResolved,
  MatchCancelled,
  MatchPaused,
  MatchUnpaused,
  BetPlaced,
  WinningsClaimed,
  RefundClaimed,
  FeesWithdrawn,
  StakeLimitsUpdated,
  PlatformFeeUpdated,
  MatchManagerAdded,
  MatchManagerRemoved,
  OwnershipTransferred,
  UpgradesLocked,
  EmergencyPausedByManager,
  Upgraded,
  MatchResolutionSkipped,
  BatchMatchesResolvedSummary,
  MatchCancellationSkipped,
  BatchMatchesCancellationSummary,
  GracePeriodUpdated
} from "../generated/MatchDayBet/MatchDayBet"
import {
  Match,
  Bet,
  User,
  MatchManager,
  ConfigUpdate,
  Upgraded as UpgradedEntity,
  MatchResolutionSkip as MatchResolutionSkipEntity,
  BatchResolutionSummary,
  MatchCancellationSkip as MatchCancellationSkipEntity,
  BatchCancellationSummary,
  GracePeriodUpdate
} from "../generated/schema"
import {
  getOrCreateUser,
  getOrCreateGlobalStats,
  outcomeToString,
  generateBetId,
  skipReasonToString
} from "./helpers"

// ============ Match Lifecycle Handlers ============

export function handleMatchCreated(event: MatchCreated): void {
  let matchId = event.params.matchId.toString()
  let match = new Match(matchId)

  match.matchId = event.params.matchId
  match.homeTeam = event.params.homeTeam
  match.awayTeam = event.params.awayTeam
  match.competition = event.params.competition
  match.kickoffTime = event.params.kickoffTime

  // Initialize pools
  match.totalPool = BigInt.fromI32(0)
  match.homePool = BigInt.fromI32(0)
  match.drawPool = BigInt.fromI32(0)
  match.awayPool = BigInt.fromI32(0)

  // Initialize bet counts
  match.homeBetCount = BigInt.fromI32(0)
  match.drawBetCount = BigInt.fromI32(0)
  match.awayBetCount = BigInt.fromI32(0)
  match.totalBetCount = BigInt.fromI32(0)

  // Initialize status
  match.status = "OPEN"
  match.result = "NONE"
  match.winnerPool = BigInt.fromI32(0)
  match.platformFeeAmount = BigInt.fromI32(0)
  match.isPaused = false
  match.totalClaimed = BigInt.fromI32(0)

  // Set timestamps
  match.createdAt = event.block.timestamp
  match.createdAtBlock = event.block.number

  match.save()

  // Update global stats
  let stats = getOrCreateGlobalStats()
  stats.totalMatches = stats.totalMatches.plus(BigInt.fromI32(1))
  stats.activeMatches = stats.activeMatches.plus(BigInt.fromI32(1))
  stats.lastUpdatedAt = event.block.timestamp
  stats.save()

}

export function handleBettingClosed(event: BettingClosed): void {
  let matchId = event.params.matchId.toString()
  let match = Match.load(matchId)

  if (match == null) {
    return
  }

  match.status = "CLOSED"
  match.closedAt = event.block.timestamp
  match.save()
}

export function handleMatchResolved(event: MatchResolved): void {
  let matchId = event.params.matchId.toString()
  let match = Match.load(matchId)

  if (match == null) {
    return
  }

  if (match.status == "RESOLVED" || match.status == "CANCELLED") {
    return
  }

  match.status = "RESOLVED"
  match.result = outcomeToString(event.params.result)
  match.winnerPool = event.params.winnerPool
  match.platformFeeAmount = event.params.platformFee
  match.resolvedAt = event.block.timestamp
  match.save()

  settleResolvedBets(
    match,
    event.params.totalPool,
    event.params.winnerPool,
    event.params.platformFee,
    event.block.timestamp
  )

  // Update global stats
  let stats = getOrCreateGlobalStats()
  stats.activeMatches = stats.activeMatches.minus(BigInt.fromI32(1))
  stats.resolvedMatches = stats.resolvedMatches.plus(BigInt.fromI32(1))
  stats.totalFeesCollected = stats.totalFeesCollected.plus(event.params.platformFee)
  stats.lastUpdatedAt = event.block.timestamp
  stats.save()

}

export function handleMatchCancelled(event: MatchCancelled): void {
  let matchId = event.params.matchId.toString()
  let match = Match.load(matchId)

  if (match == null) {
    return
  }

  if (match.status == "RESOLVED" || match.status == "CANCELLED") {
    return
  }

  match.status = "CANCELLED"
  match.cancelledAt = event.block.timestamp
  match.cancellationReason = event.params.reason
  match.save()

  settleCancelledBets(match, event.block.timestamp)

  // Update global stats
  let stats = getOrCreateGlobalStats()
  stats.activeMatches = stats.activeMatches.minus(BigInt.fromI32(1))
  stats.cancelledMatches = stats.cancelledMatches.plus(BigInt.fromI32(1))
  stats.lastUpdatedAt = event.block.timestamp
  stats.save()

}

// ============ Match Control Handlers (V2) ============

export function handleMatchPaused(event: MatchPaused): void {
  let matchId = event.params.matchId.toString()
  let match = Match.load(matchId)

  if (match == null) {
    return
  }

  match.isPaused = true
  match.save()
}

export function handleMatchUnpaused(event: MatchUnpaused): void {
  let matchId = event.params.matchId.toString()
  let match = Match.load(matchId)

  if (match == null) {
    return
  }

  match.isPaused = false
  match.save()
}

// ============ Betting Handlers ============

export function handleBetPlaced(event: BetPlaced): void {
  let matchId = event.params.matchId.toString()
  let match = Match.load(matchId)

  if (match == null) {
    return
  }

  // Create bet entity
  let betId = generateBetId(event.params.matchId, event.params.bettor)
  let bet = new Bet(betId)

  bet.match = matchId
  bet.amount = event.params.amount
  bet.prediction = outcomeToString(event.params.prediction)
  bet.result = "PENDING"
  bet.claimed = false
  bet.placedAt = event.block.timestamp
  bet.placedAtBlock = event.block.number
  bet.txHash = event.transaction.hash

  // Create/update user
  let user = getOrCreateUser(event.params.bettor, event.block.timestamp)
  bet.bettor = user.id

  user.totalBets = user.totalBets.plus(BigInt.fromI32(1))
  user.totalWagered = user.totalWagered.plus(event.params.amount)
  user.lastBetAt = event.block.timestamp
  user.lastActivityAt = event.block.timestamp
  user.save()

  bet.save()

  // Update match pools and counts
  match.totalPool = event.params.newPoolTotal
  match.totalBetCount = match.totalBetCount.plus(BigInt.fromI32(1))

  if (event.params.prediction == 1) {
    // HOME
    match.homePool = match.homePool.plus(event.params.amount)
    match.homeBetCount = match.homeBetCount.plus(BigInt.fromI32(1))
  } else if (event.params.prediction == 2) {
    // DRAW
    match.drawPool = match.drawPool.plus(event.params.amount)
    match.drawBetCount = match.drawBetCount.plus(BigInt.fromI32(1))
  } else if (event.params.prediction == 3) {
    // AWAY
    match.awayPool = match.awayPool.plus(event.params.amount)
    match.awayBetCount = match.awayBetCount.plus(BigInt.fromI32(1))
  }

  match.save()

  // Update global stats
  let stats = getOrCreateGlobalStats()
  stats.totalBets = stats.totalBets.plus(BigInt.fromI32(1))
  stats.totalVolume = stats.totalVolume.plus(event.params.amount)
  stats.lastUpdatedAt = event.block.timestamp
  stats.save()

}

// ============ Settlement ============

/**
 * Settle every bet on a resolved match, mirroring the contract's payout rules:
 * - nobody picked the winner  -> everyone is refunded (REFUND)
 * - everyone picked the winner -> stake returned, no fee (WON, profit 0)
 * - otherwise winners split totalPool - fee pro rata, others LOST
 */
function settleResolvedBets(
  match: Match,
  totalPool: BigInt,
  winnerPool: BigInt,
  platformFee: BigInt,
  timestamp: BigInt
): void {
  let zero = BigInt.fromI32(0)
  let one = BigInt.fromI32(1)
  let bets = match.bets.load()

  for (let i = 0; i < bets.length; i++) {
    let bet = bets[i]
    if (bet.result != "PENDING") {
      continue
    }

    let user = User.load(bet.bettor)
    if (user == null) {
      continue
    }

    let payout = zero
    if (winnerPool.equals(zero)) {
      bet.result = "REFUND"
      payout = bet.amount
      user.refundCount = user.refundCount.plus(one)
    } else if (bet.prediction == match.result) {
      bet.result = "WON"
      payout = winnerPool.equals(totalPool)
        ? bet.amount
        : bet.amount.times(totalPool.minus(platformFee)).div(winnerPool)
      user.winCount = user.winCount.plus(one)
      user.totalWon = user.totalWon.plus(payout)
    } else {
      bet.result = "LOST"
      user.lossCount = user.lossCount.plus(one)
    }

    let profit = payout.minus(bet.amount)
    bet.payout = payout
    bet.profit = profit
    bet.settledAt = timestamp
    bet.save()

    user.totalProfit = user.totalProfit.plus(profit)
    user.lastActivityAt = timestamp
    user.save()
  }
}

/**
 * Mark every bet on a cancelled match as a full refund
 */
function settleCancelledBets(match: Match, timestamp: BigInt): void {
  let bets = match.bets.load()

  for (let i = 0; i < bets.length; i++) {
    let bet = bets[i]
    if (bet.result != "PENDING") {
      continue
    }

    bet.result = "REFUND"
    bet.payout = bet.amount
    bet.profit = BigInt.fromI32(0)
    bet.settledAt = timestamp
    bet.save()

    let user = User.load(bet.bettor)
    if (user != null) {
      user.refundCount = user.refundCount.plus(BigInt.fromI32(1))
      user.save()
    }
  }
}

// ============ Claim Handlers ============
// Batch claims emit WinningsClaimed / RefundClaimed per match as well, so the
// BatchWinningsClaimed / BatchRefundsClaimed events are intentionally not indexed.

export function handleWinningsClaimed(event: WinningsClaimed): void {
  recordClaim(event.params.matchId, event.params.bettor, event.params.amount, event.block.timestamp)
}

export function handleRefundClaimed(event: RefundClaimed): void {
  recordClaim(event.params.matchId, event.params.bettor, event.params.amount, event.block.timestamp)
}

function recordClaim(matchIdParam: BigInt, bettor: Address, amount: BigInt, timestamp: BigInt): void {
  let match = Match.load(matchIdParam.toString())

  if (match == null) {
    return
  }

  let bet = Bet.load(generateBetId(matchIdParam, bettor))

  if (bet != null) {
    bet.claimed = true
    bet.payout = amount
    bet.profit = amount.minus(bet.amount)
    bet.claimedAt = timestamp
    bet.save()
  }

  let user = User.load(bettor.toHexString())

  if (user != null) {
    user.totalClaimed = user.totalClaimed.plus(amount)
    user.lastActivityAt = timestamp
    user.save()
  }

  match.totalClaimed = match.totalClaimed.plus(amount)
  match.save()

  let stats = getOrCreateGlobalStats()
  stats.totalPayouts = stats.totalPayouts.plus(amount)
  stats.lastUpdatedAt = timestamp
  stats.save()
}

// ============ Admin Event Handlers ============

export function handleFeesWithdrawn(event: FeesWithdrawn): void {
  // Fee withdrawal logged via event, no entity tracking needed
}

export function handleStakeLimitsUpdated(event: StakeLimitsUpdated): void {
  let configId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let config = new ConfigUpdate(configId)

  config.type = "STAKE_LIMITS"
  config.minStake = event.params.newMin
  config.maxStake = event.params.newMax
  config.blockNumber = event.block.number
  config.timestamp = event.block.timestamp
  config.transactionHash = event.transaction.hash
  config.save()
}

export function handlePlatformFeeUpdated(event: PlatformFeeUpdated): void {
  let configId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let config = new ConfigUpdate(configId)

  config.type = "PLATFORM_FEE"
  config.platformFeeBps = event.params.newFeeBps
  config.blockNumber = event.block.number
  config.timestamp = event.block.timestamp
  config.transactionHash = event.transaction.hash
  config.save()
}

export function handleMatchManagerAdded(event: MatchManagerAdded): void {
  let manager = new MatchManager(event.params.manager.toHexString())

  manager.address = event.params.manager
  manager.isActive = true
  manager.addedAt = event.block.timestamp
  manager.addedAtBlock = event.block.number
  manager.save()
}

export function handleMatchManagerRemoved(event: MatchManagerRemoved): void {
  let manager = MatchManager.load(event.params.manager.toHexString())

  if (manager != null) {
    manager.isActive = false
    manager.removedAt = event.block.timestamp
    manager.removedAtBlock = event.block.number
    manager.save()
  }
}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {
  // Log ownership transfer (could create an entity if needed)
}

export function handleUpgradesLocked(event: UpgradesLocked): void {
  // Log upgrade lock (could create an entity if needed)
}

export function handleEmergencyPausedByManager(event: EmergencyPausedByManager): void {
  // Log emergency pause (could create an entity if needed)
}

// ============ Proxy Upgrade Handler ============

export function handleUpgraded(event: Upgraded): void {
  let upgrade = new UpgradedEntity(event.transaction.hash)

  upgrade.implementation = event.params.implementation
  upgrade.blockNumber = event.block.number
  upgrade.blockTimestamp = event.block.timestamp
  upgrade.transactionHash = event.transaction.hash
  upgrade.save()
}

// ============ V3 Observability Event Handlers ============

/**
 * Handle MatchResolutionSkipped event (V3)
 * Tracks individual matches that were skipped during batch resolution
 */
export function handleMatchResolutionSkipped(event: MatchResolutionSkipped): void {
  let skipId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString() + "-" + event.params.matchId.toString()
  let skip = new MatchResolutionSkipEntity(skipId)

  // Load match (may not exist if MATCH_NOT_FOUND)
  let match = Match.load(event.params.matchId.toString())
  if (match != null) {
    skip.match = match.id
  }

  skip.skipReason = skipReasonToString(event.params.reason)
  skip.timestamp = event.block.timestamp
  skip.blockNumber = event.block.number
  skip.transactionHash = event.transaction.hash
  skip.save()

  // Update global stats
  let stats = getOrCreateGlobalStats()
  stats.totalSkippedResolutions = stats.totalSkippedResolutions.plus(BigInt.fromI32(1))
  stats.lastUpdatedAt = event.block.timestamp
  stats.save()
}

/**
 * Handle BatchMatchesResolvedSummary event (V3)
 * Tracks summary statistics for batch resolution operations
 */
export function handleBatchMatchesResolvedSummary(event: BatchMatchesResolvedSummary): void {
  let summaryId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let summary = new BatchResolutionSummary(summaryId)

  summary.matchIds = event.params.matchIds
  summary.results = event.params.results.map<string>((outcome) => outcomeToString(outcome))
  summary.resolvedCount = event.params.resolved
  summary.skippedCount = event.params.skipped
  summary.timestamp = event.block.timestamp
  summary.blockNumber = event.block.number
  summary.transactionHash = event.transaction.hash
  summary.save()

  // Update global stats
  let stats = getOrCreateGlobalStats()
  stats.totalBatchResolutions = stats.totalBatchResolutions.plus(BigInt.fromI32(1))
  stats.lastUpdatedAt = event.block.timestamp
  stats.save()
}

/**
 * Handle MatchCancellationSkipped event (V3)
 * Tracks individual matches that were skipped during batch cancellation
 */
export function handleMatchCancellationSkipped(event: MatchCancellationSkipped): void {
  let skipId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString() + "-" + event.params.matchId.toString()
  let skip = new MatchCancellationSkipEntity(skipId)

  // Load match (may not exist if MATCH_NOT_FOUND)
  let match = Match.load(event.params.matchId.toString())
  if (match != null) {
    skip.match = match.id
  }

  skip.skipReason = skipReasonToString(event.params.reason)
  skip.timestamp = event.block.timestamp
  skip.blockNumber = event.block.number
  skip.transactionHash = event.transaction.hash
  skip.save()

  // Update global stats
  let stats = getOrCreateGlobalStats()
  stats.totalSkippedCancellations = stats.totalSkippedCancellations.plus(BigInt.fromI32(1))
  stats.lastUpdatedAt = event.block.timestamp
  stats.save()
}

/**
 * Handle BatchMatchesCancellationSummary event (V3)
 * Tracks summary statistics for batch cancellation operations
 */
export function handleBatchMatchesCancellationSummary(event: BatchMatchesCancellationSummary): void {
  let summaryId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let summary = new BatchCancellationSummary(summaryId)

  summary.matchIds = event.params.matchIds
  summary.reason = event.params.reason
  summary.cancelledCount = event.params.cancelled
  summary.skippedCount = event.params.skipped
  summary.timestamp = event.block.timestamp
  summary.blockNumber = event.block.number
  summary.transactionHash = event.transaction.hash
  summary.save()

  // Update global stats
  let stats = getOrCreateGlobalStats()
  stats.totalBatchCancellations = stats.totalBatchCancellations.plus(BigInt.fromI32(1))
  stats.lastUpdatedAt = event.block.timestamp
  stats.save()
}

/**
 * Handle GracePeriodUpdated event (V3)
 * Tracks changes to the grace period configuration
 */
export function handleGracePeriodUpdated(event: GracePeriodUpdated): void {
  let updateId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString()
  let update = new GracePeriodUpdate(updateId)

  // Get previous grace period from global stats
  let stats = getOrCreateGlobalStats()
  update.previousGracePeriod = stats.currentGracePeriod
  update.newGracePeriod = event.params.newGracePeriod
  update.timestamp = event.block.timestamp
  update.blockNumber = event.block.number
  update.transactionHash = event.transaction.hash
  update.save()

  // Update global stats with new grace period
  stats.currentGracePeriod = event.params.newGracePeriod
  stats.lastUpdatedAt = event.block.timestamp
  stats.save()
}
