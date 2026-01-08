// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test} from "forge-std/Test.sol";
import {MatchDayBet} from "src/MatchDayBet.sol";

contract MatchDayBetTest is Test {
    MatchDayBet public betting;

    address public owner = address(this);
    address public alice = address(0x1);
    address public bob = address(0x2);
    address public charlie = address(0x3);

    uint256 public constant KICKOFF_TIME = 1704380400; // Some future timestamp

    function setUp() public {
        betting = new MatchDayBet();

        // Fund test accounts
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(charlie, 10 ether);

        // Warp to before kickoff
        vm.warp(KICKOFF_TIME - 1 hours);
    }

    // ============ Match Creation Tests ============

    function test_CreateMatch() public {
        uint256 matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        assertEq(matchId, 1);

        MatchDayBet.Match memory matchData = betting.getMatch(matchId);
        assertEq(matchData.matchId, 1);
        assertEq(matchData.kickoffTime, KICKOFF_TIME);
        assertEq(keccak256(bytes(matchData.homeTeam)), keccak256(bytes("Arsenal")));
        assertEq(keccak256(bytes(matchData.awayTeam)), keccak256(bytes("Chelsea")));
        assertEq(uint256(matchData.status), uint256(MatchDayBet.MatchStatus.OPEN));
    }

    function test_RevertCreateMatch_PastKickoff() public {
        vm.warp(KICKOFF_TIME + 1);

        vm.expectRevert(MatchDayBet.KickoffTimePassed.selector);
        betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);
    }

    function test_RevertCreateMatch_NotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);
    }

    // ============ Betting Tests ============

    function test_PlaceBet() public {
        uint256 matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        vm.prank(alice);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBet.Outcome.HOME);

        MatchDayBet.Bet memory bet = betting.getUserBet(matchId, alice);
        assertEq(bet.bettor, alice);
        assertEq(bet.amount, 0.01 ether);
        assertEq(uint256(bet.prediction), uint256(MatchDayBet.Outcome.HOME));
        assertFalse(bet.claimed);

        assertTrue(betting.hasUserBet(matchId, alice));
    }

    function test_PlaceBet_UpdatesPools() public {
        uint256 matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        vm.prank(alice);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBet.Outcome.HOME);

        vm.prank(bob);
        betting.placeBet{value: 0.02 ether}(matchId, MatchDayBet.Outcome.DRAW);

        (uint256 total, uint256 home, uint256 draw, uint256 away) = betting.getPools(matchId);

        assertEq(total, 0.03 ether);
        assertEq(home, 0.01 ether);
        assertEq(draw, 0.02 ether);
        assertEq(away, 0);
    }

    function test_RevertPlaceBet_BelowMin() public {
        uint256 matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        vm.prank(alice);
        vm.expectRevert(MatchDayBet.BelowMinStake.selector);
        betting.placeBet{value: 0.0001 ether}(matchId, MatchDayBet.Outcome.HOME);
    }

    function test_RevertPlaceBet_AboveMax() public {
        uint256 matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        vm.prank(alice);
        vm.expectRevert(MatchDayBet.AboveMaxStake.selector);
        betting.placeBet{value: 0.11 ether}(matchId, MatchDayBet.Outcome.HOME);
    }

    function test_RevertPlaceBet_AlreadyBet() public {
        uint256 matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        vm.startPrank(alice);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBet.Outcome.HOME);

        vm.expectRevert(MatchDayBet.AlreadyBet.selector);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBet.Outcome.DRAW);
        vm.stopPrank();
    }

    function test_RevertPlaceBet_AfterKickoff() public {
        uint256 matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        vm.warp(KICKOFF_TIME + 1);

        vm.prank(alice);
        vm.expectRevert(MatchDayBet.BettingIsClosed.selector);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBet.Outcome.HOME);
    }

    function test_RevertPlaceBet_InvalidOutcome() public {
        uint256 matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        vm.prank(alice);
        vm.expectRevert(MatchDayBet.InvalidOutcome.selector);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBet.Outcome.NONE);
    }

    // ============ Resolution Tests ============

    function test_ResolveMatch() public {
        uint256 matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        vm.prank(alice);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBet.Outcome.HOME);

        vm.warp(KICKOFF_TIME + 2 hours);

        betting.resolveMatch(matchId, MatchDayBet.Outcome.HOME);

        MatchDayBet.Match memory matchData = betting.getMatch(matchId);
        assertEq(uint256(matchData.status), uint256(MatchDayBet.MatchStatus.RESOLVED));
        assertEq(uint256(matchData.result), uint256(MatchDayBet.Outcome.HOME));
    }

    function test_ResolveMatch_AutoCloses() public {
        uint256 matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        vm.prank(alice);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBet.Outcome.HOME);

        // Don't manually close - resolveMatch should auto-close
        vm.warp(KICKOFF_TIME + 2 hours);
        betting.resolveMatch(matchId, MatchDayBet.Outcome.HOME);

        MatchDayBet.Match memory matchData = betting.getMatch(matchId);
        assertEq(uint256(matchData.status), uint256(MatchDayBet.MatchStatus.RESOLVED));
    }

    // ============ Claiming Tests ============

    function test_ClaimWinnings_SingleWinner() public {
        uint256 matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        // Alice bets on HOME
        vm.prank(alice);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBet.Outcome.HOME);

        // Bob bets on AWAY
        vm.prank(bob);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBet.Outcome.AWAY);

        // Resolve: HOME wins
        vm.warp(KICKOFF_TIME + 2 hours);
        betting.resolveMatch(matchId, MatchDayBet.Outcome.HOME);

        // Alice claims
        uint256 aliceBalanceBefore = alice.balance;

        vm.prank(alice);
        betting.claimWinnings(matchId);

        uint256 aliceBalanceAfter = alice.balance;

        // Total pool: 0.02 ETH
        // Platform fee: 0.02 * 1% = 0.0002 ETH
        // Distributable: 0.0198 ETH
        // Alice's share: 100% of winners = 0.0198 ETH
        assertEq(aliceBalanceAfter - aliceBalanceBefore, 0.0198 ether);
    }

    function test_ClaimWinnings_MultipleWinners() public {
        uint256 matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        // Alice and Charlie bet on HOME
        vm.prank(alice);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBet.Outcome.HOME);

        vm.prank(charlie);
        betting.placeBet{value: 0.03 ether}(matchId, MatchDayBet.Outcome.HOME);

        // Bob bets on AWAY
        vm.prank(bob);
        betting.placeBet{value: 0.02 ether}(matchId, MatchDayBet.Outcome.AWAY);

        // Resolve: HOME wins
        vm.warp(KICKOFF_TIME + 2 hours);
        betting.resolveMatch(matchId, MatchDayBet.Outcome.HOME);

        // Total pool: 0.06 ETH
        // Platform fee: 0.06 * 1% = 0.0006 ETH
        // Distributable: 0.0594 ETH
        // Home pool: 0.04 ETH
        // Alice's share: (0.01 / 0.04) * 0.0594 = 0.01485 ETH
        // Charlie's share: (0.03 / 0.04) * 0.0594 = 0.04455 ETH

        uint256 aliceBalanceBefore = alice.balance;
        vm.prank(alice);
        betting.claimWinnings(matchId);
        assertEq(alice.balance - aliceBalanceBefore, 0.01485 ether);

        uint256 charlieBalanceBefore = charlie.balance;
        vm.prank(charlie);
        betting.claimWinnings(matchId);
        assertEq(charlie.balance - charlieBalanceBefore, 0.04455 ether);
    }

    function test_ClaimWinnings_OnlyOneOutcome_NoFee() public {
        uint256 matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        // Everyone bets on HOME
        vm.prank(alice);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBet.Outcome.HOME);

        vm.prank(bob);
        betting.placeBet{value: 0.02 ether}(matchId, MatchDayBet.Outcome.HOME);

        // Resolve: HOME wins
        vm.warp(KICKOFF_TIME + 2 hours);
        betting.resolveMatch(matchId, MatchDayBet.Outcome.HOME);

        // No fee should be taken - users get exact refund
        uint256 aliceBalanceBefore = alice.balance;
        vm.prank(alice);
        betting.claimWinnings(matchId);
        assertEq(alice.balance - aliceBalanceBefore, 0.01 ether); // Exact refund

        // No fees accumulated
        assertEq(betting.accumulatedFees(), 0);
    }

    function test_RevertClaimWinnings_NotWinner() public {
        uint256 matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        vm.prank(alice);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBet.Outcome.HOME);

        vm.prank(bob);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBet.Outcome.AWAY);

        // HOME wins, Bob loses
        vm.warp(KICKOFF_TIME + 2 hours);
        betting.resolveMatch(matchId, MatchDayBet.Outcome.HOME);

        vm.prank(bob);
        vm.expectRevert(MatchDayBet.NotAWinner.selector);
        betting.claimWinnings(matchId);
    }

    function test_RevertClaimWinnings_AlreadyClaimed() public {
        uint256 matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        vm.prank(alice);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBet.Outcome.HOME);

        vm.prank(bob);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBet.Outcome.AWAY);

        vm.warp(KICKOFF_TIME + 2 hours);
        betting.resolveMatch(matchId, MatchDayBet.Outcome.HOME);

        vm.startPrank(alice);
        betting.claimWinnings(matchId);

        vm.expectRevert(MatchDayBet.AlreadyClaimed.selector);
        betting.claimWinnings(matchId);
        vm.stopPrank();
    }

    // ============ Cancellation & Refund Tests ============

    function test_CancelMatch() public {
        uint256 matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        vm.prank(alice);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBet.Outcome.HOME);

        betting.cancelMatch(matchId, "Match postponed");

        MatchDayBet.Match memory matchData = betting.getMatch(matchId);
        assertEq(uint256(matchData.status), uint256(MatchDayBet.MatchStatus.CANCELLED));
    }

    function test_ClaimRefund() public {
        uint256 matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        vm.prank(alice);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBet.Outcome.HOME);

        betting.cancelMatch(matchId, "Match postponed");

        uint256 aliceBalanceBefore = alice.balance;

        vm.prank(alice);
        betting.claimRefund(matchId);

        assertEq(alice.balance - aliceBalanceBefore, 0.01 ether);
    }

    // ============ Fee Withdrawal Tests ============

    function test_WithdrawFees() public {
        uint256 matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        vm.prank(alice);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBet.Outcome.HOME);

        vm.prank(bob);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBet.Outcome.AWAY);

        vm.warp(KICKOFF_TIME + 2 hours);
        betting.resolveMatch(matchId, MatchDayBet.Outcome.HOME);

        // Fee: 0.02 * 1% = 0.0002 ETH
        assertEq(betting.accumulatedFees(), 0.0002 ether);

        address feeRecipient = address(0x999);
        uint256 recipientBalanceBefore = feeRecipient.balance;

        betting.withdrawFees(feeRecipient);

        assertEq(feeRecipient.balance - recipientBalanceBefore, 0.0002 ether);
        assertEq(betting.accumulatedFees(), 0);
    }

    // ============ Odds Calculation Tests ============

    function test_GetOdds() public {
        uint256 matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        // 50% on HOME, 30% on DRAW, 20% on AWAY
        vm.prank(alice);
        betting.placeBet{value: 0.005 ether}(matchId, MatchDayBet.Outcome.HOME);

        vm.prank(bob);
        betting.placeBet{value: 0.003 ether}(matchId, MatchDayBet.Outcome.DRAW);

        vm.prank(charlie);
        betting.placeBet{value: 0.002 ether}(matchId, MatchDayBet.Outcome.AWAY);

        (uint256 homeOdds, uint256 drawOdds, uint256 awayOdds) = betting.getOdds(matchId);

        // Effective pool = 0.01 * 0.99 = 0.0099 ETH
        // Home odds = 0.0099 / 0.005 = 1.98x = 19800 bps
        // Draw odds = 0.0099 / 0.003 = 3.3x = 33000 bps
        // Away odds = 0.0099 / 0.002 = 4.95x = 49500 bps
        assertEq(homeOdds, 19800);
        assertEq(drawOdds, 33000);
        assertEq(awayOdds, 49500);
    }

    // ============ Admin Functions Tests ============

    function test_SetStakeLimits() public {
        betting.setStakeLimits(0.001 ether, 0.1 ether);

        assertEq(betting.minStake(), 0.001 ether);
        assertEq(betting.maxStake(), 0.1 ether);
    }

    function test_SetPlatformFee() public {
        betting.setPlatformFee(200); // 2%

        assertEq(betting.platformFeeBps(), 200);
    }

    function test_RevertSetPlatformFee_TooHigh() public {
        vm.expectRevert(MatchDayBet.InvalidFeeBps.selector);
        betting.setPlatformFee(600); // 6% > 5% max
    }

    function test_PauseUnpause() public {
        uint256 matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        betting.pause();

        vm.prank(alice);
        vm.expectRevert();
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBet.Outcome.HOME);

        betting.unpause();

        vm.prank(alice);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBet.Outcome.HOME);

        assertTrue(betting.hasUserBet(matchId, alice));
    }

    // ============ Potential Winnings Calculator Test ============

    function test_CalculatePotentialWinnings() public {
        uint256 matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        vm.prank(alice);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBet.Outcome.HOME);

        vm.prank(bob);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBet.Outcome.AWAY);

        // If charlie bets 0.01 on HOME:
        // New total: 0.03 ETH
        // New home pool: 0.02 ETH
        // Effective pool: 0.03 * 0.99 = 0.0297 ETH
        // Charlie's potential: (0.01 / 0.02) * 0.0297 = 0.01485 ETH

        uint256 potential = betting.calculatePotentialWinnings(matchId, MatchDayBet.Outcome.HOME, 0.01 ether);

        assertEq(potential, 0.01485 ether);
    }

    // ============ Batch Resolution Tests ============

    function test_BatchResolveMatches() public {
        // Create 3 matches
        uint256 matchId1 = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);
        uint256 matchId2 = betting.createMatch("Liverpool", "Man United", "Premier League", KICKOFF_TIME);
        uint256 matchId3 = betting.createMatch("Man City", "Tottenham", "Premier League", KICKOFF_TIME);

        // Place bets on all matches
        vm.prank(alice);
        betting.placeBet{value: 0.01 ether}(matchId1, MatchDayBet.Outcome.HOME);

        vm.prank(bob);
        betting.placeBet{value: 0.01 ether}(matchId2, MatchDayBet.Outcome.DRAW);

        vm.prank(charlie);
        betting.placeBet{value: 0.01 ether}(matchId3, MatchDayBet.Outcome.AWAY);

        // Warp to after matches finished
        vm.warp(KICKOFF_TIME + 2 hours);

        // Prepare batch resolution
        uint256[] memory matchIds = new uint256[](3);
        matchIds[0] = matchId1;
        matchIds[1] = matchId2;
        matchIds[2] = matchId3;

        MatchDayBet.Outcome[] memory results = new MatchDayBet.Outcome[](3);
        results[0] = MatchDayBet.Outcome.HOME;
        results[1] = MatchDayBet.Outcome.DRAW;
        results[2] = MatchDayBet.Outcome.AWAY;

        // Batch resolve
        betting.batchResolveMatches(matchIds, results);

        // Verify all matches resolved correctly
        MatchDayBet.Match memory match1 = betting.getMatch(matchId1);
        assertEq(uint256(match1.status), uint256(MatchDayBet.MatchStatus.RESOLVED));
        assertEq(uint256(match1.result), uint256(MatchDayBet.Outcome.HOME));

        MatchDayBet.Match memory match2 = betting.getMatch(matchId2);
        assertEq(uint256(match2.status), uint256(MatchDayBet.MatchStatus.RESOLVED));
        assertEq(uint256(match2.result), uint256(MatchDayBet.Outcome.DRAW));

        MatchDayBet.Match memory match3 = betting.getMatch(matchId3);
        assertEq(uint256(match3.status), uint256(MatchDayBet.MatchStatus.RESOLVED));
        assertEq(uint256(match3.result), uint256(MatchDayBet.Outcome.AWAY));
    }

    function test_BatchResolveMatches_EmitsEvents() public {
        // Create 2 matches
        uint256 matchId1 = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);
        uint256 matchId2 = betting.createMatch("Liverpool", "Man United", "Premier League", KICKOFF_TIME);

        // Place bets
        vm.prank(alice);
        betting.placeBet{value: 0.01 ether}(matchId1, MatchDayBet.Outcome.HOME);

        vm.prank(bob);
        betting.placeBet{value: 0.01 ether}(matchId2, MatchDayBet.Outcome.AWAY);

        vm.warp(KICKOFF_TIME + 2 hours);

        uint256[] memory matchIds = new uint256[](2);
        matchIds[0] = matchId1;
        matchIds[1] = matchId2;

        MatchDayBet.Outcome[] memory results = new MatchDayBet.Outcome[](2);
        results[0] = MatchDayBet.Outcome.HOME;
        results[1] = MatchDayBet.Outcome.AWAY;

        // Expect individual MatchResolved events for each match
        vm.expectEmit(true, false, false, true);
        emit MatchDayBet.MatchResolved(matchId1, MatchDayBet.Outcome.HOME, 0.01 ether, 0.01 ether, 0);

        vm.expectEmit(true, false, false, true);
        emit MatchDayBet.MatchResolved(matchId2, MatchDayBet.Outcome.AWAY, 0.01 ether, 0.01 ether, 0);

        // Expect batch event
        vm.expectEmit(false, false, false, true);
        emit MatchDayBet.BatchMatchesResolved(matchIds, results);

        betting.batchResolveMatches(matchIds, results);
    }

    function test_BatchResolveMatches_AutoCloses() public {
        // Create matches that are still OPEN
        uint256 matchId1 = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);
        uint256 matchId2 = betting.createMatch("Liverpool", "Man United", "Premier League", KICKOFF_TIME);

        vm.prank(alice);
        betting.placeBet{value: 0.01 ether}(matchId1, MatchDayBet.Outcome.HOME);

        vm.prank(bob);
        betting.placeBet{value: 0.01 ether}(matchId2, MatchDayBet.Outcome.AWAY);

        // Verify matches are OPEN
        assertEq(uint256(betting.getMatch(matchId1).status), uint256(MatchDayBet.MatchStatus.OPEN));
        assertEq(uint256(betting.getMatch(matchId2).status), uint256(MatchDayBet.MatchStatus.OPEN));

        vm.warp(KICKOFF_TIME + 2 hours);

        uint256[] memory matchIds = new uint256[](2);
        matchIds[0] = matchId1;
        matchIds[1] = matchId2;

        MatchDayBet.Outcome[] memory results = new MatchDayBet.Outcome[](2);
        results[0] = MatchDayBet.Outcome.HOME;
        results[1] = MatchDayBet.Outcome.AWAY;

        // Batch resolve should auto-close
        betting.batchResolveMatches(matchIds, results);

        // Verify both resolved (not just closed)
        assertEq(uint256(betting.getMatch(matchId1).status), uint256(MatchDayBet.MatchStatus.RESOLVED));
        assertEq(uint256(betting.getMatch(matchId2).status), uint256(MatchDayBet.MatchStatus.RESOLVED));
    }

    function test_BatchResolveMatches_CalculatesFees() public {
        // Create 2 matches
        uint256 matchId1 = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);
        uint256 matchId2 = betting.createMatch("Liverpool", "Man United", "Premier League", KICKOFF_TIME);

        // Place bets with winners and losers on both
        vm.prank(alice);
        betting.placeBet{value: 0.01 ether}(matchId1, MatchDayBet.Outcome.HOME);

        vm.prank(bob);
        betting.placeBet{value: 0.01 ether}(matchId1, MatchDayBet.Outcome.AWAY);

        vm.prank(alice);
        betting.placeBet{value: 0.02 ether}(matchId2, MatchDayBet.Outcome.HOME);

        vm.prank(charlie);
        betting.placeBet{value: 0.02 ether}(matchId2, MatchDayBet.Outcome.DRAW);

        vm.warp(KICKOFF_TIME + 2 hours);

        uint256 feesBefore = betting.accumulatedFees();

        uint256[] memory matchIds = new uint256[](2);
        matchIds[0] = matchId1;
        matchIds[1] = matchId2;

        MatchDayBet.Outcome[] memory results = new MatchDayBet.Outcome[](2);
        results[0] = MatchDayBet.Outcome.HOME;
        results[1] = MatchDayBet.Outcome.HOME;

        betting.batchResolveMatches(matchIds, results);

        uint256 feesAfter = betting.accumulatedFees();

        // Match 1: 0.02 ETH pool, fee = 0.0002 ETH
        // Match 2: 0.04 ETH pool, fee = 0.0004 ETH
        // Total fees: 0.0006 ETH
        assertEq(feesAfter - feesBefore, 0.0006 ether);
    }

    function test_RevertBatchResolveMatches_ArrayLengthMismatch() public {
        uint256 matchId1 = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        uint256[] memory matchIds = new uint256[](2);
        matchIds[0] = matchId1;
        matchIds[1] = 999; // Invalid

        MatchDayBet.Outcome[] memory results = new MatchDayBet.Outcome[](1);
        results[0] = MatchDayBet.Outcome.HOME;

        vm.expectRevert(MatchDayBet.ArrayLengthMismatch.selector);
        betting.batchResolveMatches(matchIds, results);
    }

    function test_RevertBatchResolveMatches_MatchNotFound() public {
        vm.warp(KICKOFF_TIME + 2 hours);

        uint256[] memory matchIds = new uint256[](1);
        matchIds[0] = 999; // Non-existent match

        MatchDayBet.Outcome[] memory results = new MatchDayBet.Outcome[](1);
        results[0] = MatchDayBet.Outcome.HOME;

        vm.expectRevert(MatchDayBet.MatchNotFound.selector);
        betting.batchResolveMatches(matchIds, results);
    }

    function test_RevertBatchResolveMatches_AlreadyResolved() public {
        uint256 matchId1 = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);
        uint256 matchId2 = betting.createMatch("Liverpool", "Man United", "Premier League", KICKOFF_TIME);

        vm.prank(alice);
        betting.placeBet{value: 0.01 ether}(matchId1, MatchDayBet.Outcome.HOME);

        vm.warp(KICKOFF_TIME + 2 hours);

        // Resolve matchId1 first
        betting.resolveMatch(matchId1, MatchDayBet.Outcome.HOME);

        // Try to batch resolve including already-resolved match
        uint256[] memory matchIds = new uint256[](2);
        matchIds[0] = matchId1; // Already resolved
        matchIds[1] = matchId2;

        MatchDayBet.Outcome[] memory results = new MatchDayBet.Outcome[](2);
        results[0] = MatchDayBet.Outcome.HOME;
        results[1] = MatchDayBet.Outcome.DRAW;

        vm.expectRevert(MatchDayBet.MatchAlreadyResolved.selector);
        betting.batchResolveMatches(matchIds, results);
    }

    function test_RevertBatchResolveMatches_NotOwner() public {
        uint256 matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        vm.warp(KICKOFF_TIME + 2 hours);

        uint256[] memory matchIds = new uint256[](1);
        matchIds[0] = matchId;

        MatchDayBet.Outcome[] memory results = new MatchDayBet.Outcome[](1);
        results[0] = MatchDayBet.Outcome.HOME;

        vm.prank(alice);
        vm.expectRevert();
        betting.batchResolveMatches(matchIds, results);
    }

    function test_RevertBatchResolveMatches_InvalidOutcome() public {
        uint256 matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        vm.warp(KICKOFF_TIME + 2 hours);

        uint256[] memory matchIds = new uint256[](1);
        matchIds[0] = matchId;

        MatchDayBet.Outcome[] memory results = new MatchDayBet.Outcome[](1);
        results[0] = MatchDayBet.Outcome.NONE;

        vm.expectRevert(MatchDayBet.InvalidOutcome.selector);
        betting.batchResolveMatches(matchIds, results);
    }

    function test_RevertBatchResolveMatches_TooSoon() public {
        uint256 matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", KICKOFF_TIME);

        // Warp to just before grace period ends
        vm.warp(KICKOFF_TIME + 30 minutes);

        uint256[] memory matchIds = new uint256[](1);
        matchIds[0] = matchId;

        MatchDayBet.Outcome[] memory results = new MatchDayBet.Outcome[](1);
        results[0] = MatchDayBet.Outcome.HOME;

        vm.expectRevert(MatchDayBet.KickoffNotReached.selector);
        betting.batchResolveMatches(matchIds, results);
    }
}
