import { BigInt, Bytes } from "@graphprotocol/graph-ts"
import {
  User,
  GlobalStats
} from "../generated/schema"

/**
 * Get or create a User entity
 */
export function getOrCreateUser(
  address: Bytes,
  timestamp: BigInt
): User {
  let user = User.load(address.toHexString())
  let isNew = false

  if (user == null) {
    user = new User(address.toHexString())
    user.address = address
    user.totalBets = BigInt.fromI32(0)
    user.totalWagered = BigInt.fromI32(0)
    user.totalWon = BigInt.fromI32(0)
    user.totalClaimed = BigInt.fromI32(0)
    user.totalProfit = BigInt.fromI32(0)
    user.winCount = BigInt.fromI32(0)
    user.lossCount = BigInt.fromI32(0)
    user.refundCount = BigInt.fromI32(0)
    user.firstBetAt = timestamp
    user.lastBetAt = timestamp
    user.lastActivityAt = timestamp
    isNew = true
  }

  if (isNew) {
    let stats = getOrCreateGlobalStats()
    stats.uniqueBettors = stats.uniqueBettors.plus(BigInt.fromI32(1))
    stats.lastUpdatedAt = timestamp
    stats.save()
  }

  return user
}

/**
 * Get or create GlobalStats entity (singleton)
 */
export function getOrCreateGlobalStats(): GlobalStats {
  let stats = GlobalStats.load("1")

  if (stats == null) {
    stats = new GlobalStats("1")
    stats.totalMatches = BigInt.fromI32(0)
    stats.activeMatches = BigInt.fromI32(0)
    stats.resolvedMatches = BigInt.fromI32(0)
    stats.cancelledMatches = BigInt.fromI32(0)
    stats.totalBets = BigInt.fromI32(0)
    stats.totalVolume = BigInt.fromI32(0)
    stats.totalFeesCollected = BigInt.fromI32(0)
    stats.totalPayouts = BigInt.fromI32(0)
    stats.uniqueBettors = BigInt.fromI32(0)

    // V3 fields - Initialize with defaults
    stats.currentGracePeriod = BigInt.fromI32(6300) // 105 minutes (MIN_GRACE_PERIOD)
    stats.totalBatchResolutions = BigInt.fromI32(0)
    stats.totalBatchCancellations = BigInt.fromI32(0)
    stats.totalSkippedResolutions = BigInt.fromI32(0)
    stats.totalSkippedCancellations = BigInt.fromI32(0)

    stats.lastUpdatedAt = BigInt.fromI32(0)
    stats.save()
  }

  return stats
}


/**
 * Convert Outcome enum value to string
 */
export function outcomeToString(outcome: i32): string {
  if (outcome == 0) return "NONE"
  if (outcome == 1) return "HOME"
  if (outcome == 2) return "DRAW"
  if (outcome == 3) return "AWAY"
  return "NONE"
}

/**
 * Convert MatchStatus enum value to string
 */
export function matchStatusToString(status: i32): string {
  if (status == 0) return "OPEN"
  if (status == 1) return "CLOSED"
  if (status == 2) return "RESOLVED"
  if (status == 3) return "CANCELLED"
  return "OPEN"
}

/**
 * Convert SkipReason enum value to string (V3)
 */
export function skipReasonToString(reason: i32): string {
  if (reason == 0) return "NONE"
  if (reason == 1) return "ALREADY_RESOLVED_SAME_RESULT"
  if (reason == 2) return "ALREADY_RESOLVED_DIFFERENT_RESULT"
  if (reason == 3) return "ALREADY_CLOSED"
  if (reason == 4) return "ALREADY_CANCELLED"
  if (reason == 5) return "MATCH_NOT_FOUND"
  if (reason == 6) return "MATCH_IS_RESOLVED"
  if (reason == 7) return "MATCH_IS_CANCELLED"
  if (reason == 8) return "KICKOFF_NOT_REACHED"
  if (reason == 9) return "INVALID_OUTCOME"
  return "NONE"
}

/**
 * Generate bet ID from matchId and bettor address
 */
export function generateBetId(matchId: BigInt, bettorAddress: Bytes): string {
  return matchId.toString() + "-" + bettorAddress.toHexString()
}
