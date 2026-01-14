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
 * Generate bet ID from matchId and bettor address
 */
export function generateBetId(matchId: BigInt, bettorAddress: Bytes): string {
  return matchId.toString() + "-" + bettorAddress.toHexString()
}
