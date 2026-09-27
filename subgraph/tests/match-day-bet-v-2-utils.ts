import { newMockEvent } from "matchstick-as"
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts"
import {
  Upgraded,
  MatchCreated,
  BetPlaced,
  MatchResolved,
  MatchCancelled,
  WinningsClaimed,
  RefundClaimed
} from "../generated/MatchDayBet/MatchDayBet"

function uintParam(name: string, value: BigInt): ethereum.EventParam {
  return new ethereum.EventParam(name, ethereum.Value.fromUnsignedBigInt(value))
}

function u8Param(name: string, value: i32): ethereum.EventParam {
  return new ethereum.EventParam(name, ethereum.Value.fromI32(value))
}

function stringParam(name: string, value: string): ethereum.EventParam {
  return new ethereum.EventParam(name, ethereum.Value.fromString(value))
}

function addressParam(name: string, value: Address): ethereum.EventParam {
  return new ethereum.EventParam(name, ethereum.Value.fromAddress(value))
}

export function createUpgradedEvent(implementation: Address): Upgraded {
  let upgradedEvent = changetype<Upgraded>(newMockEvent())

  upgradedEvent.parameters = new Array()

  upgradedEvent.parameters.push(addressParam("implementation", implementation))

  return upgradedEvent
}

export function createMatchCreatedEvent(matchId: i32, kickoffTime: i32): MatchCreated {
  let event = changetype<MatchCreated>(newMockEvent())
  event.parameters = new Array()
  event.parameters.push(uintParam("matchId", BigInt.fromI32(matchId)))
  event.parameters.push(stringParam("homeTeam", "Arsenal"))
  event.parameters.push(stringParam("awayTeam", "Chelsea"))
  event.parameters.push(stringParam("competition", "Premier League"))
  event.parameters.push(uintParam("kickoffTime", BigInt.fromI32(kickoffTime)))
  return event
}

export function createBetPlacedEvent(
  matchId: i32,
  bettor: Address,
  prediction: i32,
  amount: BigInt,
  newPoolTotal: BigInt
): BetPlaced {
  let event = changetype<BetPlaced>(newMockEvent())
  event.parameters = new Array()
  event.parameters.push(uintParam("matchId", BigInt.fromI32(matchId)))
  event.parameters.push(addressParam("bettor", bettor))
  event.parameters.push(u8Param("prediction", prediction))
  event.parameters.push(uintParam("amount", amount))
  event.parameters.push(uintParam("newPoolTotal", newPoolTotal))
  return event
}

export function createMatchResolvedEvent(
  matchId: i32,
  result: i32,
  totalPool: BigInt,
  winnerPool: BigInt,
  platformFee: BigInt
): MatchResolved {
  let event = changetype<MatchResolved>(newMockEvent())
  event.parameters = new Array()
  event.parameters.push(uintParam("matchId", BigInt.fromI32(matchId)))
  event.parameters.push(u8Param("result", result))
  event.parameters.push(uintParam("totalPool", totalPool))
  event.parameters.push(uintParam("winnerPool", winnerPool))
  event.parameters.push(uintParam("platformFee", platformFee))
  return event
}

export function createMatchCancelledEvent(matchId: i32, reason: string): MatchCancelled {
  let event = changetype<MatchCancelled>(newMockEvent())
  event.parameters = new Array()
  event.parameters.push(uintParam("matchId", BigInt.fromI32(matchId)))
  event.parameters.push(stringParam("reason", reason))
  return event
}

export function createWinningsClaimedEvent(
  matchId: i32,
  bettor: Address,
  amount: BigInt,
  profit: BigInt
): WinningsClaimed {
  let event = changetype<WinningsClaimed>(newMockEvent())
  event.parameters = new Array()
  event.parameters.push(uintParam("matchId", BigInt.fromI32(matchId)))
  event.parameters.push(addressParam("bettor", bettor))
  event.parameters.push(uintParam("amount", amount))
  event.parameters.push(uintParam("profit", profit))
  return event
}

export function createRefundClaimedEvent(matchId: i32, bettor: Address, amount: BigInt): RefundClaimed {
  let event = changetype<RefundClaimed>(newMockEvent())
  event.parameters = new Array()
  event.parameters.push(uintParam("matchId", BigInt.fromI32(matchId)))
  event.parameters.push(addressParam("bettor", bettor))
  event.parameters.push(uintParam("amount", amount))
  return event
}
