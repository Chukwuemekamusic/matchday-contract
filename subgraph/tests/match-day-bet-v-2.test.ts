import {
  assert,
  describe,
  test,
  clearStore,
  beforeEach,
  afterEach
} from "matchstick-as/assembly/index"
import { Address, BigInt } from "@graphprotocol/graph-ts"
import {
  handleUpgraded,
  handleMatchCreated,
  handleBetPlaced,
  handleMatchResolved,
  handleMatchCancelled,
  handleWinningsClaimed,
  handleRefundClaimed
} from "../src/match-day-bet-v-2"
import {
  createUpgradedEvent,
  createMatchCreatedEvent,
  createBetPlacedEvent,
  createMatchResolvedEvent,
  createMatchCancelledEvent,
  createWinningsClaimedEvent,
  createRefundClaimedEvent
} from "./match-day-bet-v-2-utils"

const HOME = 1
const DRAW = 2
const AWAY = 3

const ALICE = Address.fromString("0x00000000000000000000000000000000000000a1")
const BOB = Address.fromString("0x00000000000000000000000000000000000000b0")
const CAROL = Address.fromString("0x00000000000000000000000000000000000000c0")

function eth(milli: i32): BigInt {
  // milli-ether to wei
  return BigInt.fromI32(milli).times(BigInt.fromString("1000000000000000"))
}

function betId(matchId: i32, bettor: Address): string {
  return matchId.toString() + "-" + bettor.toHexString()
}

let pool = BigInt.fromI32(0)

function bet(matchId: i32, bettor: Address, prediction: i32, amount: BigInt): void {
  pool = pool.plus(amount)
  handleBetPlaced(createBetPlacedEvent(matchId, bettor, prediction, amount, pool))
}

describe("Upgraded", () => {
  afterEach(() => {
    clearStore()
  })

  test("Upgraded is stored by transaction hash", () => {
    let implementation = Address.fromString("0x0000000000000000000000000000000000000001")
    handleUpgraded(createUpgradedEvent(implementation))

    assert.entityCount("Upgraded", 1)
    assert.fieldEquals(
      "Upgraded",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a",
      "implementation",
      "0x0000000000000000000000000000000000000001"
    )
  })
})

describe("Match settlement", () => {
  beforeEach(() => {
    pool = BigInt.fromI32(0)
    handleMatchCreated(createMatchCreatedEvent(1, 1000))
  })

  afterEach(() => {
    clearStore()
  })

  test("winners split the pool after fee, losers are marked LOST", () => {
    bet(1, ALICE, HOME, eth(10))
    bet(1, BOB, HOME, eth(30))
    bet(1, CAROL, AWAY, eth(40))
    // total 80, 1% fee = 0.8, distributable 79.2, winner pool 40
    handleMatchResolved(createMatchResolvedEvent(1, HOME, eth(80), eth(40), BigInt.fromString("800000000000000")))

    assert.fieldEquals("Match", "1", "status", "RESOLVED")
    assert.fieldEquals("Match", "1", "winnerPool", eth(40).toString())

    assert.fieldEquals("Bet", betId(1, ALICE), "result", "WON")
    assert.fieldEquals("Bet", betId(1, ALICE), "payout", "19800000000000000")
    assert.fieldEquals("Bet", betId(1, ALICE), "profit", "9800000000000000")
    assert.fieldEquals("Bet", betId(1, BOB), "payout", "59400000000000000")
    assert.fieldEquals("Bet", betId(1, CAROL), "result", "LOST")
    assert.fieldEquals("Bet", betId(1, CAROL), "payout", "0")
    assert.fieldEquals("Bet", betId(1, CAROL), "profit", eth(-40).toString())

    assert.fieldEquals("User", ALICE.toHexString(), "winCount", "1")
    assert.fieldEquals("User", ALICE.toHexString(), "totalWon", "19800000000000000")
    assert.fieldEquals("User", CAROL.toHexString(), "lossCount", "1")
    assert.fieldEquals("User", CAROL.toHexString(), "winCount", "0")
    assert.fieldEquals("User", CAROL.toHexString(), "totalProfit", eth(-40).toString())

    assert.fieldEquals("GlobalStats", "1", "activeMatches", "0")
    assert.fieldEquals("GlobalStats", "1", "resolvedMatches", "1")
  })

  test("a repeated resolution does not overwrite the result or double count", () => {
    bet(1, ALICE, HOME, eth(10))
    bet(1, CAROL, AWAY, eth(10))
    handleMatchResolved(createMatchResolvedEvent(1, HOME, eth(20), eth(10), BigInt.fromString("200000000000000")))
    handleMatchResolved(createMatchResolvedEvent(1, AWAY, eth(20), eth(10), BigInt.fromString("200000000000000")))

    assert.fieldEquals("Match", "1", "result", "HOME")
    assert.fieldEquals("Bet", betId(1, ALICE), "result", "WON")
    assert.fieldEquals("User", ALICE.toHexString(), "winCount", "1")
    assert.fieldEquals("GlobalStats", "1", "resolvedMatches", "1")
    assert.fieldEquals("GlobalStats", "1", "activeMatches", "0")
  })

  test("nobody on the winning outcome refunds everyone", () => {
    bet(1, ALICE, HOME, eth(10))
    bet(1, BOB, DRAW, eth(20))
    handleMatchResolved(createMatchResolvedEvent(1, AWAY, eth(30), BigInt.fromI32(0), BigInt.fromI32(0)))

    assert.fieldEquals("Bet", betId(1, ALICE), "result", "REFUND")
    assert.fieldEquals("Bet", betId(1, ALICE), "payout", eth(10).toString())
    assert.fieldEquals("Bet", betId(1, BOB), "profit", "0")
    assert.fieldEquals("User", BOB.toHexString(), "refundCount", "1")
    assert.fieldEquals("User", BOB.toHexString(), "lossCount", "0")
  })

  test("everyone on the winning outcome gets their stake back without fee", () => {
    bet(1, ALICE, HOME, eth(10))
    bet(1, BOB, HOME, eth(20))
    handleMatchResolved(createMatchResolvedEvent(1, HOME, eth(30), eth(30), BigInt.fromI32(0)))

    assert.fieldEquals("Bet", betId(1, BOB), "result", "WON")
    assert.fieldEquals("Bet", betId(1, BOB), "payout", eth(20).toString())
    assert.fieldEquals("Bet", betId(1, BOB), "profit", "0")
  })

  test("cancellation refunds every bet and ignores later cancels", () => {
    bet(1, ALICE, HOME, eth(10))
    handleMatchCancelled(createMatchCancelledEvent(1, "Postponed"))
    handleMatchCancelled(createMatchCancelledEvent(1, "Postponed"))

    assert.fieldEquals("Match", "1", "status", "CANCELLED")
    assert.fieldEquals("Bet", betId(1, ALICE), "result", "REFUND")
    assert.fieldEquals("Bet", betId(1, ALICE), "payout", eth(10).toString())
    assert.fieldEquals("User", ALICE.toHexString(), "refundCount", "1")
    assert.fieldEquals("GlobalStats", "1", "cancelledMatches", "1")
    assert.fieldEquals("GlobalStats", "1", "activeMatches", "0")
  })

  test("a resolved match is not flipped to cancelled", () => {
    bet(1, ALICE, HOME, eth(10))
    handleMatchResolved(createMatchResolvedEvent(1, HOME, eth(10), eth(10), BigInt.fromI32(0)))
    handleMatchCancelled(createMatchCancelledEvent(1, "late cancel"))

    assert.fieldEquals("Match", "1", "status", "RESOLVED")
    assert.fieldEquals("Bet", betId(1, ALICE), "result", "WON")
    assert.fieldEquals("GlobalStats", "1", "cancelledMatches", "0")
  })
})

describe("Claims", () => {
  beforeEach(() => {
    pool = BigInt.fromI32(0)
    handleMatchCreated(createMatchCreatedEvent(1, 1000))
    handleMatchCreated(createMatchCreatedEvent(2, 1000))
  })

  afterEach(() => {
    clearStore()
  })

  test("per-match claim events from a batch claim are counted once", () => {
    bet(1, ALICE, HOME, eth(10))
    pool = BigInt.fromI32(0)
    bet(2, ALICE, AWAY, eth(20))
    handleMatchResolved(createMatchResolvedEvent(1, HOME, eth(10), eth(10), BigInt.fromI32(0)))
    handleMatchResolved(createMatchResolvedEvent(2, AWAY, eth(20), eth(20), BigInt.fromI32(0)))

    // batchClaimWinnings([1, 2]) emits one WinningsClaimed per match
    handleWinningsClaimed(createWinningsClaimedEvent(1, ALICE, eth(10), BigInt.fromI32(0)))
    handleWinningsClaimed(createWinningsClaimedEvent(2, ALICE, eth(20), BigInt.fromI32(0)))

    assert.fieldEquals("User", ALICE.toHexString(), "totalClaimed", eth(30).toString())
    assert.fieldEquals("User", ALICE.toHexString(), "winCount", "2")
    assert.fieldEquals("Bet", betId(1, ALICE), "claimed", "true")
    assert.fieldEquals("Match", "2", "totalClaimed", eth(20).toString())
    assert.fieldEquals("GlobalStats", "1", "totalPayouts", eth(30).toString())
  })

  test("refund claims do not change the refund count", () => {
    bet(1, ALICE, HOME, eth(10))
    handleMatchCancelled(createMatchCancelledEvent(1, "Postponed"))
    handleRefundClaimed(createRefundClaimedEvent(1, ALICE, eth(10)))

    assert.fieldEquals("User", ALICE.toHexString(), "refundCount", "1")
    assert.fieldEquals("User", ALICE.toHexString(), "totalClaimed", eth(10).toString())
    assert.fieldEquals("Bet", betId(1, ALICE), "claimed", "true")
    assert.fieldEquals("Bet", betId(1, ALICE), "profit", "0")
  })
})
