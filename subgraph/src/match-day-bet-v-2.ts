import { BigInt } from "@graphprotocol/graph-ts"
import {
  MatchCreated,
  BettingClosed,
  MatchResolved,
  BatchMatchesResolved,
  MatchCancelled,
  BatchMatchesCancelled,
  MatchPaused,
  MatchUnpaused,
  BetPlaced,
  WinningsClaimed,
  RefundClaimed,
  BatchWinningsClaimed,
  BatchRefundsClaimed,
  FeesWithdrawn,
  StakeLimitsUpdated,
  PlatformFeeUpdated,
  MatchManagerAdded,
  MatchManagerRemoved,
  OwnershipTransferred,
  UpgradesLocked,
  EmergencyPausedByManager,
  Upgraded
} from "../generated/MatchDayBetV2/MatchDayBetV2"
import {
  Match,
  Bet,
  User,
  GlobalStats,
  MatchManager,
  ConfigUpdate,
  Upgraded as UpgradedEntity
} from "../generated/schema"
import {
  getOrCreateUser,
  getOrCreateGlobalStats,
  outcomeToString,
  generateBetId
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

  match.status = "RESOLVED"
  match.result = outcomeToString(event.params.result)
  match.platformFeeAmount = event.params.platformFee
  match.resolvedAt = event.block.timestamp
  match.save()

  // Update global stats
  let stats = getOrCreateGlobalStats()
  stats.activeMatches = stats.activeMatches.minus(BigInt.fromI32(1))
  stats.resolvedMatches = stats.resolvedMatches.plus(BigInt.fromI32(1))
  stats.totalFeesCollected = stats.totalFeesCollected.plus(event.params.platformFee)
  stats.lastUpdatedAt = event.block.timestamp
  stats.save()

}

export function handleBatchMatchesResolved(event: BatchMatchesResolved): void {
  let matchIds = event.params.matchIds
  let results = event.params.results

  for (let i = 0; i < matchIds.length; i++) {
    let matchId = matchIds[i].toString()
    let match = Match.load(matchId)

    if (match != null) {
      match.status = "RESOLVED"
      match.result = outcomeToString(results[i])
      match.resolvedAt = event.block.timestamp
      match.save()

      // Update global stats
      let stats = getOrCreateGlobalStats()
      stats.activeMatches = stats.activeMatches.minus(BigInt.fromI32(1))
      stats.resolvedMatches = stats.resolvedMatches.plus(BigInt.fromI32(1))
      stats.lastUpdatedAt = event.block.timestamp
      stats.save()
    }
  }

}

export function handleMatchCancelled(event: MatchCancelled): void {
  let matchId = event.params.matchId.toString()
  let match = Match.load(matchId)

  if (match == null) {
    return
  }

  match.status = "CANCELLED"
  match.cancelledAt = event.block.timestamp
  match.cancellationReason = event.params.reason
  match.save()

  // Update global stats
  let stats = getOrCreateGlobalStats()
  stats.activeMatches = stats.activeMatches.minus(BigInt.fromI32(1))
  stats.cancelledMatches = stats.cancelledMatches.plus(BigInt.fromI32(1))
  stats.lastUpdatedAt = event.block.timestamp
  stats.save()

}

export function handleBatchMatchesCancelled(event: BatchMatchesCancelled): void {
  let matchIds = event.params.matchIds

  for (let i = 0; i < matchIds.length; i++) {
    let matchId = matchIds[i].toString()
    let match = Match.load(matchId)

    if (match != null) {
      match.status = "CANCELLED"
      match.cancelledAt = event.block.timestamp
      match.cancellationReason = event.params.reason
      match.save()

      // Update global stats
      let stats = getOrCreateGlobalStats()
      stats.activeMatches = stats.activeMatches.minus(BigInt.fromI32(1))
      stats.cancelledMatches = stats.cancelledMatches.plus(BigInt.fromI32(1))
      stats.lastUpdatedAt = event.block.timestamp
      stats.save()
    }
  }

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

// ============ Claim Handlers ============

export function handleWinningsClaimed(event: WinningsClaimed): void {
  let matchId = event.params.matchId.toString()
  let match = Match.load(matchId)

  if (match == null) {
    return
  }

  // Update bet
  let betId = generateBetId(event.params.matchId, event.params.bettor)
  let bet = Bet.load(betId)

  if (bet != null) {
    bet.claimed = true
    bet.payout = event.params.amount
    bet.profit = event.params.profit
    bet.claimedAt = event.block.timestamp
    bet.save()
  }

  // Update user stats
  let user = User.load(event.params.bettor.toHexString())

  if (user != null) {
    user.totalWon = user.totalWon.plus(event.params.amount)
    user.totalClaimed = user.totalClaimed.plus(event.params.amount)
    user.totalProfit = user.totalProfit.plus(event.params.profit)
    user.lastActivityAt = event.block.timestamp

    if (event.params.profit.gt(BigInt.fromI32(0))) {
      user.winCount = user.winCount.plus(BigInt.fromI32(1))
    } else {
      user.lossCount = user.lossCount.plus(BigInt.fromI32(1))
    }

    user.save()
  }

  // Update match total claimed
  match.totalClaimed = match.totalClaimed.plus(event.params.amount)
  match.save()

  // Update global stats
  let stats = getOrCreateGlobalStats()
  stats.totalPayouts = stats.totalPayouts.plus(event.params.amount)
  stats.lastUpdatedAt = event.block.timestamp
  stats.save()

}

export function handleRefundClaimed(event: RefundClaimed): void {
  let matchId = event.params.matchId.toString()
  let match = Match.load(matchId)

  if (match == null) {
    return
  }

  // Update bet
  let betId = generateBetId(event.params.matchId, event.params.bettor)
  let bet = Bet.load(betId)

  if (bet != null) {
    bet.claimed = true
    bet.payout = event.params.amount
    bet.profit = BigInt.fromI32(0) // Refunds don't have profit
    bet.claimedAt = event.block.timestamp
    bet.save()
  }

  // Update user stats
  let user = User.load(event.params.bettor.toHexString())

  if (user != null) {
    user.totalClaimed = user.totalClaimed.plus(event.params.amount)
    user.refundCount = user.refundCount.plus(BigInt.fromI32(1))
    user.lastActivityAt = event.block.timestamp
    user.save()
  }

  // Update match total claimed
  match.totalClaimed = match.totalClaimed.plus(event.params.amount)
  match.save()

  // Update global stats
  let stats = getOrCreateGlobalStats()
  stats.totalPayouts = stats.totalPayouts.plus(event.params.amount)
  stats.lastUpdatedAt = event.block.timestamp
  stats.save()
}

export function handleBatchWinningsClaimed(event: BatchWinningsClaimed): void {
  let matchIds = event.params.matchIds
  let user = User.load(event.params.user.toHexString())

  if (user == null) {
    return
  }

  // Update user stats
  user.totalClaimed = user.totalClaimed.plus(event.params.totalPayout)
  user.lastActivityAt = event.block.timestamp
  user.save()

  // Update each match and bet
  for (let i = 0; i < matchIds.length; i++) {
    let matchId = matchIds[i].toString()
    let betId = generateBetId(matchIds[i], event.params.user)
    let bet = Bet.load(betId)

    if (bet != null && !bet.claimed) {
      bet.claimed = true
      bet.claimedAt = event.block.timestamp
      // Note: Individual payout amounts not available in batch event
      bet.save()
    }
  }

  // Update global stats
  let stats = getOrCreateGlobalStats()
  stats.totalPayouts = stats.totalPayouts.plus(event.params.totalPayout)
  stats.lastUpdatedAt = event.block.timestamp
  stats.save()
}

export function handleBatchRefundsClaimed(event: BatchRefundsClaimed): void {
  let matchIds = event.params.matchIds
  let user = User.load(event.params.user.toHexString())

  if (user == null) {
    return
  }

  // Update user stats
  user.totalClaimed = user.totalClaimed.plus(event.params.totalRefund)
  user.refundCount = user.refundCount.plus(BigInt.fromI32(matchIds.length))
  user.lastActivityAt = event.block.timestamp
  user.save()

  // Update each bet
  for (let i = 0; i < matchIds.length; i++) {
    let betId = generateBetId(matchIds[i], event.params.user)
    let bet = Bet.load(betId)

    if (bet != null && !bet.claimed) {
      bet.claimed = true
      bet.claimedAt = event.block.timestamp
      bet.profit = BigInt.fromI32(0)
      bet.save()
    }
  }

  // Update global stats
  let stats = getOrCreateGlobalStats()
  stats.totalPayouts = stats.totalPayouts.plus(event.params.totalRefund)
  stats.lastUpdatedAt = event.block.timestamp
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
