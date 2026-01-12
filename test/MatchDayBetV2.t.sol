// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, console} from "forge-std/Test.sol";
import {MatchDayBetV2} from "../src/MatchDayBetV2.sol";

/**
 * @title MatchDayBetV2 Test Suite
 * @notice Comprehensive tests for V2 features and edge case fixes
 */
contract MatchDayBetV2Test is Test {
    MatchDayBetV2 public betting;

    address public owner = address(this);
    address public bot = makeAddr("bot");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");

    uint256 constant MIN_STAKE = 0.001 ether;
    uint256 constant MAX_STAKE = 0.1 ether;

    event MatchCreated(
        uint256 indexed matchId, string homeTeam, string awayTeam, string competition, uint256 kickoffTime
    );
    event BetPlaced(
        uint256 indexed matchId,
        address indexed bettor,
        MatchDayBetV2.Outcome prediction,
        uint256 amount,
        uint256 newPoolTotal
    );
    event MatchResolved(
        uint256 indexed matchId,
        MatchDayBetV2.Outcome result,
        uint256 totalPool,
        uint256 winnerPool,
        uint256 platformFee
    );
    event WinningsClaimed(uint256 indexed matchId, address indexed bettor, uint256 amount, uint256 profit);
    event BatchWinningsClaimed(address indexed user, uint256[] matchIds, uint256 totalPayout);
    event BatchRefundsClaimed(address indexed user, uint256[] matchIds, uint256 totalRefund);
    event MatchPaused(uint256 indexed matchId);
    event MatchUnpaused(uint256 indexed matchId);
    event BatchMatchesCancelled(uint256[] matchIds, string reason);

    function setUp() public {
        betting = new MatchDayBetV2();
        betting.initialize(owner);
        betting.addMatchManager(bot);

        // Fund users
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        vm.deal(user3, 10 ether);
    }

    // ============ Helper Functions ============

    function createTestMatch() internal returns (uint256 matchId) {
        uint256 kickoff = block.timestamp + 1 hours;
        vm.prank(bot);
        matchId = betting.createMatch("Arsenal", "Chelsea", "Premier League", kickoff);
    }

    function createAndResolveMatch(MatchDayBetV2.Outcome result) internal returns (uint256 matchId) {
        matchId = createTestMatch();

        // Place bets
        vm.prank(user1);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBetV2.Outcome.HOME);

        vm.prank(user2);
        betting.placeBet{value: 0.02 ether}(matchId, MatchDayBetV2.Outcome.DRAW);

        // Warp past kickoff + grace period
        vm.warp(block.timestamp + 2 hours);

        // Resolve
        vm.prank(bot);
        betting.resolveMatch(matchId, result);
    }

    // ============ V2 Feature Tests ============

    // ============ Test: No Winner Edge Case (CRITICAL FIX) ============

    function test_NoWinner_EveryoneGetsRefund() public {
        uint256 matchId = createTestMatch();

        // User1 bets HOME, User2 bets DRAW
        vm.prank(user1);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBetV2.Outcome.HOME);

        vm.prank(user2);
        betting.placeBet{value: 0.02 ether}(matchId, MatchDayBetV2.Outcome.DRAW);

        // Warp past kickoff
        vm.warp(block.timestamp + 2 hours);

        // Resolve with AWAY (nobody bet on it)
        vm.prank(bot);
        betting.resolveMatch(matchId, MatchDayBetV2.Outcome.AWAY);

        // Both users should be able to claim refunds (no fee)
        uint256 user1BalBefore = user1.balance;
        vm.prank(user1);
        betting.claimWinnings(matchId);
        assertEq(user1.balance - user1BalBefore, 0.01 ether, "User1 should get full refund");

        uint256 user2BalBefore = user2.balance;
        vm.prank(user2);
        betting.claimWinnings(matchId);
        assertEq(user2.balance - user2BalBefore, 0.02 ether, "User2 should get full refund");

        // Verify no fees were collected
        assertEq(betting.accumulatedFees(), 0, "No fees should be collected when no winners");
    }

    function test_NoWinner_GetClaimStatus() public {
        uint256 matchId = createTestMatch();

        vm.prank(user1);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBetV2.Outcome.HOME);

        vm.warp(block.timestamp + 2 hours);

        // Resolve with AWAY (user1 bet HOME, so lost)
        vm.prank(bot);
        betting.resolveMatch(matchId, MatchDayBetV2.Outcome.AWAY);

        // User1 should be able to claim (refund case)
        MatchDayBetV2.ClaimStatus memory status = betting.getClaimStatus(matchId, user1);
        assertTrue(status.canClaim, "User should be able to claim refund");
        assertEq(status.claimType, 1, "Should be winnings type (refund)");
        assertEq(status.amount, 0.01 ether, "Amount should be original stake");
    }

    // ============ Test: Everyone Bets Same (Existing Feature, Should Still Work) ============

    function test_EveryoneBetsSame_NoFee() public {
        uint256 matchId = createTestMatch();

        // Everyone bets HOME
        vm.prank(user1);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBetV2.Outcome.HOME);

        vm.prank(user2);
        betting.placeBet{value: 0.02 ether}(matchId, MatchDayBetV2.Outcome.HOME);

        vm.warp(block.timestamp + 2 hours);

        // Resolve with HOME
        vm.prank(bot);
        betting.resolveMatch(matchId, MatchDayBetV2.Outcome.HOME);

        // Both should get refunds (no fee)
        uint256 user1BalBefore = user1.balance;
        vm.prank(user1);
        betting.claimWinnings(matchId);
        assertEq(user1.balance - user1BalBefore, 0.01 ether);

        uint256 user2BalBefore = user2.balance;
        vm.prank(user2);
        betting.claimWinnings(matchId);
        assertEq(user2.balance - user2BalBefore, 0.02 ether);

        assertEq(betting.accumulatedFees(), 0, "No fees when everyone bets same");
    }

    // ============ Test: Batch Claim Winnings ============

    function test_BatchClaimWinnings_Success() public {
        // Create 3 matches
        uint256 match1 = createAndResolveMatch(MatchDayBetV2.Outcome.HOME);
        uint256 match2 = createAndResolveMatch(MatchDayBetV2.Outcome.HOME);
        uint256 match3 = createAndResolveMatch(MatchDayBetV2.Outcome.HOME);

        // User1 should have winnings from all 3 matches
        uint256[] memory matchIds = new uint256[](3);
        matchIds[0] = match1;
        matchIds[1] = match2;
        matchIds[2] = match3;

        uint256 balBefore = user1.balance;

        vm.prank(user1);
        vm.expectEmit(true, false, false, false);
        emit BatchWinningsClaimed(user1, matchIds, 0); // Amount checked separately
        uint256 totalPayout = betting.batchClaimWinnings(matchIds);

        assertGt(totalPayout, 0, "Should have received payout");
        assertEq(user1.balance - balBefore, totalPayout, "Balance should increase by payout");

        // Verify all bets are marked as claimed
        for (uint256 i; i < 3; i++) {
            MatchDayBetV2.Bet memory bet = betting.getUserBet(matchIds[i], user1);
            assertTrue(bet.claimed, "Bet should be marked as claimed");
        }
    }

    function test_BatchClaimWinnings_SkipsNonClaimable() public {
        uint256 match1 = createAndResolveMatch(MatchDayBetV2.Outcome.HOME); // User1 won
        uint256 match2 = createAndResolveMatch(MatchDayBetV2.Outcome.DRAW); // User1 lost

        uint256[] memory matchIds = new uint256[](2);
        matchIds[0] = match1;
        matchIds[1] = match2;

        uint256 balBefore = user1.balance;

        vm.prank(user1);
        uint256 totalPayout = betting.batchClaimWinnings(matchIds);

        assertGt(totalPayout, 0, "Should get payout from match1");
        assertEq(user1.balance - balBefore, totalPayout);

        // Match1 should be claimed, Match2 should not
        MatchDayBetV2.Bet memory bet1 = betting.getUserBet(match1, user1);
        assertTrue(bet1.claimed);

        MatchDayBetV2.Bet memory bet2 = betting.getUserBet(match2, user1);
        assertFalse(bet2.claimed, "Losing bet should not be claimed");
    }

    function test_BatchClaimWinnings_RevertsOnEmptyArray() public {
        uint256[] memory emptyArray = new uint256[](0);

        vm.prank(user1);
        vm.expectRevert(MatchDayBetV2.EmptyArray.selector);
        betting.batchClaimWinnings(emptyArray);
    }

    function test_BatchClaimWinnings_RevertsOnBatchTooLarge() public {
        uint256[] memory hugeArray = new uint256[](51); // MAX is 50

        vm.prank(user1);
        vm.expectRevert(MatchDayBetV2.BatchTooLarge.selector);
        betting.batchClaimWinnings(hugeArray);
    }

    function test_BatchClaimWinnings_RevertsWhenNothingToClaim() public {
        uint256 matchId = createTestMatch();

        // Don't place any bets

        vm.warp(block.timestamp + 2 hours);
        vm.prank(bot);
        betting.resolveMatch(matchId, MatchDayBetV2.Outcome.HOME);

        uint256[] memory matchIds = new uint256[](1);
        matchIds[0] = matchId;

        vm.prank(user1);
        vm.expectRevert(MatchDayBetV2.NothingToClaim.selector);
        betting.batchClaimWinnings(matchIds);
    }

    // ============ Test: Batch Claim Refunds ============

    function test_BatchClaimRefunds_Success() public {
        // Create 3 matches and cancel them
        uint256[] memory matchIds = new uint256[](3);
        for (uint256 i; i < 3; i++) {
            matchIds[i] = createTestMatch();
            vm.prank(user1);
            betting.placeBet{value: 0.01 ether}(matchIds[i], MatchDayBetV2.Outcome.HOME);

            vm.prank(bot);
            betting.cancelMatch(matchIds[i], "Weather");
        }

        uint256 balBefore = user1.balance;

        vm.prank(user1);
        vm.expectEmit(true, false, false, false);
        emit BatchRefundsClaimed(user1, matchIds, 0.03 ether);
        uint256 totalRefund = betting.batchClaimRefunds(matchIds);

        assertEq(totalRefund, 0.03 ether, "Should refund 3x 0.01 ETH");
        assertEq(user1.balance - balBefore, 0.03 ether);
    }

    // ============ Test: View Functions ============

    function test_GetUnclaimedWinnings() public {
        // Create matches with different outcomes
        uint256 match1 = createAndResolveMatch(MatchDayBetV2.Outcome.HOME); // User1 won
        uint256 match2 = createAndResolveMatch(MatchDayBetV2.Outcome.DRAW); // User1 lost
        uint256 match3 = createAndResolveMatch(MatchDayBetV2.Outcome.HOME); // User1 won

        uint256[] memory checkMatches = new uint256[](3);
        checkMatches[0] = match1;
        checkMatches[1] = match2;
        checkMatches[2] = match3;

        (uint256[] memory claimable, uint256[] memory payouts) = betting.getUnclaimedWinnings(user1, checkMatches);

        assertEq(claimable.length, 2, "Should have 2 claimable matches");
        assertEq(claimable[0], match1);
        assertEq(claimable[1], match3);
        assertGt(payouts[0], 0, "Should have payout for match1");
        assertGt(payouts[1], 0, "Should have payout for match3");
    }

    function test_GetClaimStatus_Winning() public {
        uint256 matchId = createAndResolveMatch(MatchDayBetV2.Outcome.HOME);

        MatchDayBetV2.ClaimStatus memory status = betting.getClaimStatus(matchId, user1);

        assertTrue(status.canClaim, "Should be able to claim");
        assertEq(status.claimType, 1, "Type should be winnings");
        assertGt(status.amount, 0, "Should have payout amount");
    }

    function test_GetClaimStatus_Refund() public {
        uint256 matchId = createTestMatch();

        vm.prank(user1);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBetV2.Outcome.HOME);

        vm.prank(bot);
        betting.cancelMatch(matchId, "Postponed");

        MatchDayBetV2.ClaimStatus memory status = betting.getClaimStatus(matchId, user1);

        assertTrue(status.canClaim, "Should be able to claim refund");
        assertEq(status.claimType, 2, "Type should be refund");
        assertEq(status.amount, 0.01 ether, "Refund should be original stake");
    }

    function test_GetClaimStatus_NoBet() public {
        uint256 matchId = createTestMatch();

        MatchDayBetV2.ClaimStatus memory status = betting.getClaimStatus(matchId, user1);

        assertFalse(status.canClaim, "Should not be able to claim");
        assertEq(status.claimType, 0);
        assertEq(status.amount, 0);
    }

    // ============ Test: Match Pausing ============

    function test_PauseMatch_PreventsBetting() public {
        uint256 matchId = createTestMatch();

        vm.prank(bot);
        vm.expectEmit(true, false, false, false);
        emit MatchPaused(matchId);
        betting.pauseMatch(matchId);

        assertTrue(betting.matchPaused(matchId), "Match should be paused");

        vm.prank(user1);
        vm.expectRevert(MatchDayBetV2.MatchIsPaused.selector);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBetV2.Outcome.HOME);
    }

    function test_UnpauseMatch_AllowsBetting() public {
        uint256 matchId = createTestMatch();

        vm.prank(bot);
        betting.pauseMatch(matchId);

        vm.prank(owner);
        vm.expectEmit(true, false, false, false);
        emit MatchUnpaused(matchId);
        betting.unpauseMatch(matchId);

        assertFalse(betting.matchPaused(matchId), "Match should be unpaused");

        vm.prank(user1);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBetV2.Outcome.HOME);
    }

    // ============ Test: Batch Cancel Matches ============

    function test_BatchCancelMatches() public {
        uint256[] memory matchIds = new uint256[](3);
        for (uint256 i; i < 3; i++) {
            matchIds[i] = createTestMatch();
        }

        vm.prank(bot);
        vm.expectEmit(false, false, false, true);
        emit BatchMatchesCancelled(matchIds, "Storm");
        betting.batchCancelMatches(matchIds, "Storm");

        for (uint256 i; i < 3; i++) {
            MatchDayBetV2.Match memory m = betting.getMatch(matchIds[i]);
            assertEq(uint8(m.status), uint8(MatchDayBetV2.MatchStatus.CANCELLED));
        }
    }

    // ============ Test: String Length Validation ============

    function test_CreateMatch_RevertsOnLongTeamName() public {
        string memory longName = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"; // 65 chars

        vm.prank(bot);
        vm.expectRevert(MatchDayBetV2.StringTooLong.selector);
        betting.createMatch(longName, "Chelsea", "Premier League", block.timestamp + 1 hours);
    }

    // ============ Test: V2 Storage Variables ============

    function test_UserTotalClaimed_Tracking() public {
        uint256 matchId = createAndResolveMatch(MatchDayBetV2.Outcome.HOME);

        assertEq(betting.userTotalClaimed(user1), 0, "Initial claimed should be 0");

        uint256 balBefore = user1.balance;
        vm.prank(user1);
        betting.claimWinnings(matchId);
        uint256 payout = user1.balance - balBefore;

        assertEq(betting.userTotalClaimed(user1), payout, "Should track total claimed");
    }

    function test_BatchClaim_UpdatesTotalClaimed() public {
        uint256 match1 = createAndResolveMatch(MatchDayBetV2.Outcome.HOME);
        uint256 match2 = createAndResolveMatch(MatchDayBetV2.Outcome.HOME);

        uint256[] memory matchIds = new uint256[](2);
        matchIds[0] = match1;
        matchIds[1] = match2;

        vm.prank(user1);
        uint256 totalPayout = betting.batchClaimWinnings(matchIds);

        assertEq(betting.userTotalClaimed(user1), totalPayout, "Should track batch claimed amount");
    }

    // ============ Test: Version ============

    function test_Version() public view {
        assertEq(betting.version(), "2.0.0", "Should be version 2.0.0");
    }

    // ============ Regression Tests (Ensure V1 Features Still Work) ============

    function test_V1_BasicBetting() public {
        uint256 matchId = createTestMatch();

        vm.prank(user1);
        vm.expectEmit(true, true, false, false);
        emit BetPlaced(matchId, user1, MatchDayBetV2.Outcome.HOME, 0.01 ether, 0.01 ether);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBetV2.Outcome.HOME);

        MatchDayBetV2.Bet memory bet = betting.getUserBet(matchId, user1);
        assertEq(bet.amount, 0.01 ether);
        assertEq(uint8(bet.prediction), uint8(MatchDayBetV2.Outcome.HOME));
    }

    function test_V1_ParimutuelDistribution() public {
        uint256 matchId = createTestMatch();

        // User1 bets 0.01 ETH on HOME
        vm.prank(user1);
        betting.placeBet{value: 0.01 ether}(matchId, MatchDayBetV2.Outcome.HOME);

        // User2 bets 0.02 ETH on DRAW
        vm.prank(user2);
        betting.placeBet{value: 0.02 ether}(matchId, MatchDayBetV2.Outcome.DRAW);

        // Total pool: 0.03 ETH
        // Home pool: 0.01 ETH
        // Draw pool: 0.02 ETH

        vm.warp(block.timestamp + 2 hours);
        vm.prank(bot);
        betting.resolveMatch(matchId, MatchDayBetV2.Outcome.HOME);

        // User1 should get share of (0.03 - 1% fee) = 0.0297 ETH
        uint256 balBefore = user1.balance;
        vm.prank(user1);
        betting.claimWinnings(matchId);

        uint256 payout = user1.balance - balBefore;
        assertApproxEqRel(payout, 0.0297 ether, 0.01e18, "Payout should be ~0.0297 ETH");
    }
}
