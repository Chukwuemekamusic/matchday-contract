// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Test, console} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MatchDayBetV1} from "../src/MatchDayBetV1.sol";

contract MatchDayBetV1Test is Test {
    MatchDayBetV1 public implementation;
    MatchDayBetV1 public matchDayBet;
    ERC1967Proxy public proxy;

    address public owner = address(0x1);
    address public bot = address(0x2);
    address public user1 = address(0x3);
    address public user2 = address(0x4);
    address public user3 = address(0x5);

    uint256 public constant MIN_STAKE = 0.001 ether;
    uint256 public constant MAX_STAKE = 0.1 ether;

    event MatchCreated(
        uint256 indexed matchId, string homeTeam, string awayTeam, string competition, uint256 kickoffTime
    );
    event BetPlaced(
        uint256 indexed matchId,
        address indexed bettor,
        MatchDayBetV1.Outcome prediction,
        uint256 amount,
        uint256 newPoolTotal
    );
    event MatchManagerAdded(address indexed manager);
    event MatchManagerRemoved(address indexed manager);
    event UpgradesLocked();
    event EmergencyPausedByManager(address indexed manager);

    function setUp() public {
        // Deploy implementation
        implementation = new MatchDayBetV1();

        // Deploy proxy with initialization
        bytes memory initData = abi.encodeWithSelector(MatchDayBetV1.initialize.selector, owner);
        proxy = new ERC1967Proxy(address(implementation), initData);

        // Get proxy as MatchDayBetV1
        matchDayBet = MatchDayBetV1(payable(address(proxy)));

        // Add bot as match manager
        vm.prank(owner);
        matchDayBet.addMatchManager(bot);

        // Fund test accounts
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        vm.deal(user3, 10 ether);
        vm.deal(bot, 1 ether);
    }

    // ============ Initialization Tests ============

    function test_Initialize() public view {
        assertEq(matchDayBet.owner(), owner);
        assertEq(matchDayBet.isMatchManager(owner), true);
        assertEq(matchDayBet.isMatchManager(bot), true);
        assertEq(matchDayBet.upgradesLocked(), false);
        assertEq(matchDayBet.platformFeeBps(), 100);
        assertEq(matchDayBet.minStake(), MIN_STAKE);
        assertEq(matchDayBet.maxStake(), MAX_STAKE);
        assertEq(matchDayBet.nextMatchId(), 1);
        assertEq(matchDayBet.version(), "1.0.0");
    }

    function test_CannotInitializeTwice() public {
        vm.expectRevert();
        matchDayBet.initialize(address(0x999));
    }

    function test_CannotInitializeImplementation() public {
        vm.expectRevert();
        implementation.initialize(owner);
    }

    // ============ Access Control Tests ============

    function test_OnlyOwnerCanAddMatchManager() public {
        address newManager = address(0x999);

        vm.prank(user1);
        vm.expectRevert(MatchDayBetV1.NotOwner.selector);
        matchDayBet.addMatchManager(newManager);

        vm.prank(bot);
        vm.expectRevert(MatchDayBetV1.NotOwner.selector);
        matchDayBet.addMatchManager(newManager);

        vm.prank(owner);
        vm.expectEmit(true, false, false, false);
        emit MatchManagerAdded(newManager);
        matchDayBet.addMatchManager(newManager);

        assertTrue(matchDayBet.isMatchManager(newManager));
    }

    function test_OnlyOwnerCanRemoveMatchManager() public {
        vm.prank(owner);
        vm.expectEmit(true, false, false, false);
        emit MatchManagerRemoved(bot);
        matchDayBet.removeMatchManager(bot);

        assertFalse(matchDayBet.isMatchManager(bot));
    }

    function test_OwnerIsAlsoMatchManager() public {
        // Owner can call match manager functions
        vm.prank(owner);
        uint256 matchId = matchDayBet.createMatch("Arsenal", "Chelsea", "Premier League", block.timestamp + 1 days);
        assertEq(matchId, 1);
    }

    // ============ Match Manager Function Tests ============

    function test_BotCanCreateMatch() public {
        vm.prank(bot);
        vm.expectEmit(true, false, false, true);
        emit MatchCreated(1, "Arsenal", "Chelsea", "Premier League", block.timestamp + 1 days);

        uint256 matchId = matchDayBet.createMatch("Arsenal", "Chelsea", "Premier League", block.timestamp + 1 days);

        assertEq(matchId, 1);

        MatchDayBetV1.Match memory matchData = matchDayBet.getMatch(matchId);
        assertEq(matchData.homeTeam, "Arsenal");
        assertEq(matchData.awayTeam, "Chelsea");
        assertEq(uint8(matchData.status), uint8(MatchDayBetV1.MatchStatus.OPEN));
    }

    function test_NonManagerCannotCreateMatch() public {
        vm.prank(user1);
        vm.expectRevert(MatchDayBetV1.NotMatchManager.selector);
        matchDayBet.createMatch("Arsenal", "Chelsea", "Premier League", block.timestamp + 1 days);
    }

    function test_BotCanCloseBetting() public {
        // Create match
        vm.prank(bot);
        uint256 matchId = matchDayBet.createMatch("Arsenal", "Chelsea", "Premier League", block.timestamp + 1 days);

        // Close betting
        vm.prank(bot);
        matchDayBet.closeBetting(matchId);

        MatchDayBetV1.Match memory matchData = matchDayBet.getMatch(matchId);
        assertEq(uint8(matchData.status), uint8(MatchDayBetV1.MatchStatus.CLOSED));
    }

    function test_BotCanResolveMatch() public {
        // Create match
        vm.prank(bot);
        uint256 matchId = matchDayBet.createMatch("Arsenal", "Chelsea", "Premier League", block.timestamp + 1 days);

        // Place bet
        vm.prank(user1);
        matchDayBet.placeBet{value: 0.01 ether}(matchId, MatchDayBetV1.Outcome.HOME);

        // Warp past grace period
        vm.warp(block.timestamp + 1 days + 2 hours);

        // Resolve
        vm.prank(bot);
        matchDayBet.resolveMatch(matchId, MatchDayBetV1.Outcome.HOME);

        MatchDayBetV1.Match memory matchData = matchDayBet.getMatch(matchId);
        assertEq(uint8(matchData.status), uint8(MatchDayBetV1.MatchStatus.RESOLVED));
        assertEq(uint8(matchData.result), uint8(MatchDayBetV1.Outcome.HOME));
    }

    function test_BotCanCancelMatch() public {
        vm.prank(bot);
        uint256 matchId = matchDayBet.createMatch("Arsenal", "Chelsea", "Premier League", block.timestamp + 1 days);

        vm.prank(bot);
        matchDayBet.cancelMatch(matchId, "Weather conditions");

        MatchDayBetV1.Match memory matchData = matchDayBet.getMatch(matchId);
        assertEq(uint8(matchData.status), uint8(MatchDayBetV1.MatchStatus.CANCELLED));
    }

    // ============ Emergency Pause Tests ============

    function test_BotCanEmergencyPause() public {
        vm.prank(bot);
        vm.expectEmit(true, false, false, false);
        emit EmergencyPausedByManager(bot);
        matchDayBet.emergencyPause();

        assertTrue(matchDayBet.paused());
    }

    function test_BotCannotUnpause() public {
        vm.prank(bot);
        matchDayBet.emergencyPause();

        vm.prank(bot);
        vm.expectRevert(MatchDayBetV1.NotOwner.selector);
        matchDayBet.unpause();
    }

    function test_OnlyOwnerCanUnpause() public {
        vm.prank(bot);
        matchDayBet.emergencyPause();

        vm.prank(owner);
        matchDayBet.unpause();

        assertFalse(matchDayBet.paused());
    }

    function test_CannotCreateMatchWhenPaused() public {
        vm.prank(bot);
        matchDayBet.emergencyPause();

        vm.prank(bot);
        vm.expectRevert();
        matchDayBet.createMatch("Arsenal", "Chelsea", "Premier League", block.timestamp + 1 days);
    }

    // ============ Owner-Only Admin Function Tests ============

    function test_OnlyOwnerCanWithdrawFees() public {
        // Setup: create match, place bets, resolve
        _setupResolvedMatchWithFees();

        uint256 fees = matchDayBet.accumulatedFees();
        assertTrue(fees > 0);

        // Bot cannot withdraw
        vm.prank(bot);
        vm.expectRevert(MatchDayBetV1.NotOwner.selector);
        matchDayBet.withdrawFees(bot);

        // Owner can withdraw
        uint256 balanceBefore = owner.balance;
        vm.prank(owner);
        matchDayBet.withdrawFees(owner);

        assertEq(owner.balance, balanceBefore + fees);
        assertEq(matchDayBet.accumulatedFees(), 0);
    }

    function test_OnlyOwnerCanSetStakeLimits() public {
        vm.prank(bot);
        vm.expectRevert(MatchDayBetV1.NotOwner.selector);
        matchDayBet.setStakeLimits(0.002 ether, 0.2 ether);

        vm.prank(owner);
        matchDayBet.setStakeLimits(0.002 ether, 0.2 ether);

        assertEq(matchDayBet.minStake(), 0.002 ether);
        assertEq(matchDayBet.maxStake(), 0.2 ether);
    }

    function test_OnlyOwnerCanSetPlatformFee() public {
        vm.prank(bot);
        vm.expectRevert(MatchDayBetV1.NotOwner.selector);
        matchDayBet.setPlatformFee(200);

        vm.prank(owner);
        matchDayBet.setPlatformFee(200);

        assertEq(matchDayBet.platformFeeBps(), 200);
    }

    // ============ Upgrade Tests ============

    function test_OnlyOwnerCanUpgrade() public {
        MatchDayBetV1 newImpl = new MatchDayBetV1();

        vm.prank(bot);
        vm.expectRevert(MatchDayBetV1.NotOwner.selector);
        matchDayBet.upgradeToAndCall(address(newImpl), "");

        vm.prank(owner);
        matchDayBet.upgradeToAndCall(address(newImpl), "");

        // Contract still works after upgrade
        assertEq(matchDayBet.version(), "1.0.0");
    }

    function test_CannotUpgradeWhenLocked() public {
        vm.prank(owner);
        vm.expectEmit(false, false, false, false);
        emit UpgradesLocked();
        matchDayBet.lockUpgrades();

        assertTrue(matchDayBet.upgradesLocked());

        MatchDayBetV1 newImpl = new MatchDayBetV1();

        vm.prank(owner);
        vm.expectRevert(MatchDayBetV1.UpgradesAreLocked.selector);
        matchDayBet.upgradeToAndCall(address(newImpl), "");
    }

    function test_OnlyOwnerCanLockUpgrades() public {
        vm.prank(bot);
        vm.expectRevert(MatchDayBetV1.NotOwner.selector);
        matchDayBet.lockUpgrades();

        vm.prank(owner);
        matchDayBet.lockUpgrades();

        assertTrue(matchDayBet.upgradesLocked());
    }

    // ============ Betting Flow Tests ============

    function test_FullBettingFlow() public {
        // 1. Bot creates match
        vm.prank(bot);
        uint256 matchId = matchDayBet.createMatch("Arsenal", "Chelsea", "Premier League", block.timestamp + 1 days);

        // 2. Users place bets
        vm.prank(user1);
        matchDayBet.placeBet{value: 0.05 ether}(matchId, MatchDayBetV1.Outcome.HOME);

        vm.prank(user2);
        matchDayBet.placeBet{value: 0.03 ether}(matchId, MatchDayBetV1.Outcome.AWAY);

        vm.prank(user3);
        matchDayBet.placeBet{value: 0.02 ether}(matchId, MatchDayBetV1.Outcome.HOME);

        // Check pools
        (uint256 total, uint256 home, uint256 draw, uint256 away) = matchDayBet.getPools(matchId);
        assertEq(total, 0.1 ether);
        assertEq(home, 0.07 ether);
        assertEq(draw, 0);
        assertEq(away, 0.03 ether);

        // 3. Time passes, bot closes betting at kickoff
        vm.warp(block.timestamp + 1 days);
        vm.prank(bot);
        matchDayBet.closeBetting(matchId);

        // 4. Match finishes, bot resolves (HOME wins)
        vm.warp(block.timestamp + 2 hours);
        vm.prank(bot);
        matchDayBet.resolveMatch(matchId, MatchDayBetV1.Outcome.HOME);

        // 5. Winners claim
        uint256 user1BalanceBefore = user1.balance;
        vm.prank(user1);
        matchDayBet.claimWinnings(matchId);

        uint256 user3BalanceBefore = user3.balance;
        vm.prank(user3);
        matchDayBet.claimWinnings(matchId);

        // User1 bet 0.05 of 0.07 home pool
        // Total pool = 0.1, fee = 0.001 (1%), distributable = 0.099
        // User1 payout = (0.05 / 0.07) * 0.099 ≈ 0.0707 ether
        assertTrue(user1.balance > user1BalanceBefore);
        assertTrue(user3.balance > user3BalanceBefore);

        // 6. Loser cannot claim
        vm.prank(user2);
        vm.expectRevert(MatchDayBetV1.NotAWinner.selector);
        matchDayBet.claimWinnings(matchId);

        // 7. Owner withdraws fees
        uint256 fees = matchDayBet.accumulatedFees();
        assertEq(fees, 0.001 ether); // 1% of 0.1 ETH

        vm.prank(owner);
        matchDayBet.withdrawFees(owner);
    }

    function test_RefundOnCancelledMatch() public {
        // Create and bet
        vm.prank(bot);
        uint256 matchId = matchDayBet.createMatch("Arsenal", "Chelsea", "Premier League", block.timestamp + 1 days);

        vm.prank(user1);
        matchDayBet.placeBet{value: 0.05 ether}(matchId, MatchDayBetV1.Outcome.HOME);

        uint256 balanceBefore = user1.balance;

        // Cancel
        vm.prank(bot);
        matchDayBet.cancelMatch(matchId, "Match postponed");

        // Claim refund
        vm.prank(user1);
        matchDayBet.claimRefund(matchId);

        assertEq(user1.balance, balanceBefore + 0.05 ether);
    }

    // ============ Ownership Transfer Tests ============

    function test_TransferOwnership() public {
        address newOwner = address(0x999);

        vm.prank(owner);
        matchDayBet.transferOwnership(newOwner);

        assertEq(matchDayBet.owner(), newOwner);
        assertTrue(matchDayBet.isMatchManager(newOwner));

        // Old owner can no longer call owner functions
        vm.prank(owner);
        vm.expectRevert(MatchDayBetV1.NotOwner.selector);
        matchDayBet.setStakeLimits(0.01 ether, 1 ether);

        // New owner can
        vm.prank(newOwner);
        matchDayBet.setStakeLimits(0.01 ether, 1 ether);
    }

    // ============ Helper Functions ============

    function _setupResolvedMatchWithFees() internal returns (uint256 matchId) {
        vm.prank(bot);
        matchId = matchDayBet.createMatch("Arsenal", "Chelsea", "Premier League", block.timestamp + 1 days);

        // Need bets on different outcomes for fees to apply
        vm.prank(user1);
        matchDayBet.placeBet{value: 0.05 ether}(matchId, MatchDayBetV1.Outcome.HOME);

        vm.prank(user2);
        matchDayBet.placeBet{value: 0.05 ether}(matchId, MatchDayBetV1.Outcome.AWAY);

        vm.warp(block.timestamp + 1 days + 2 hours);

        vm.prank(bot);
        matchDayBet.resolveMatch(matchId, MatchDayBetV1.Outcome.HOME);
    }
}
