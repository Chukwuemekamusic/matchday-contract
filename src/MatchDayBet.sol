// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title MatchDayBet
 * @notice Parimutuel betting contract for football matches using native ETH on Base
 * @dev Built for Towns Protocol bot integration
 * @author Towns Football Betting Bot
 */
contract MatchDayBet is Ownable, ReentrancyGuard, Pausable {
    // ============ Enums ============

    enum Outcome {
        NONE,
        HOME,
        DRAW,
        AWAY
    }
    enum MatchStatus {
        OPEN,
        CLOSED,
        RESOLVED,
        CANCELLED
    }

    // ============ Structs ============

    struct Match {
        uint256 matchId;
        uint256 kickoffTime;
        uint256 totalPool;
        uint256 homePool;
        uint256 drawPool;
        uint256 awayPool;
        uint256 homeBetCount;
        uint256 drawBetCount;
        uint256 awayBetCount;
        uint256 platformFeeAmount;
        Outcome result;
        MatchStatus status;
        string homeTeam;
        string awayTeam;
        string competition;
    }

    struct Bet {
        address bettor;
        uint256 amount;
        Outcome prediction;
        bool claimed;
    }

    struct OddsCalculation {
        uint256 platformFee;
        uint256 effectivePool;
        uint256 homeOdds;
        uint256 drawOdds;
        uint256 awayOdds;
    }

    // ============ State Variables ============

    uint256 public constant GRACE_PERIOD = 1 hours;
    uint256 private constant BASIS_POINTS = 10000;
    uint256 private constant MAX_FEE_BPS = 500; // 5%

    /// @notice Platform fee in basis points (100 = 1%)
    uint256 public platformFeeBps = 100;

    /// @notice Minimum bet amount in wei
    uint256 public minStake = 0.001 ether; // ~$1 at $2500/ETH

    /// @notice Maximum bet amount in wei
    uint256 public maxStake = 0.1 ether; // ~$250 at $2500/ETH

    /// @notice Counter for match IDs
    uint256 public nextMatchId = 1;

    /// @notice Accumulated platform fees available for withdrawal
    uint256 public accumulatedFees;

    /// @notice Match ID => Match data
    mapping(uint256 => Match) public matches;

    /// @notice Match ID => User address => User's bet
    mapping(uint256 => mapping(address => Bet)) public userBets;

    /// @notice Match ID => User address => Has user bet on this match
    mapping(uint256 => mapping(address => bool)) public hasBet;

    // ============ Events ============

    event MatchCreated(
        uint256 indexed matchId, string homeTeam, string awayTeam, string competition, uint256 kickoffTime
    );

    event BetPlaced(
        uint256 indexed matchId, address indexed bettor, Outcome prediction, uint256 amount, uint256 newPoolTotal
    );

    event BettingClosed(uint256 indexed matchId);

    event MatchResolved(
        uint256 indexed matchId, Outcome result, uint256 totalPool, uint256 winnerPool, uint256 platformFee
    );

    event MatchCancelled(uint256 indexed matchId, string reason);

    event WinningsClaimed(uint256 indexed matchId, address indexed bettor, uint256 amount, uint256 profit);

    event RefundClaimed(uint256 indexed matchId, address indexed bettor, uint256 amount);

    event FeesWithdrawn(address indexed to, uint256 amount);

    event StakeLimitsUpdated(uint256 newMin, uint256 newMax);

    event PlatformFeeUpdated(uint256 newFeeBps);

    // ============ Errors ============

    error MatchNotFound();
    error MatchNotOpen();
    error MatchNotResolved();
    error MatchNotCancelled();
    error MatchAlreadyResolved();
    error MatchAlreadyCancelled();
    error BettingIsClosed();
    error BelowMinStake();
    error AboveMaxStake();
    error AlreadyBet();
    error NoBetFound();
    error AlreadyClaimed();
    error NotAWinner();
    error InvalidOutcome();
    error KickoffTimePassed();
    error KickoffNotReached();
    error TransferFailed();
    error NoFeesToWithdraw();
    error InvalidStakeLimits();
    error InvalidFeeBps();

    // ======== Modifiers ============
    modifier matchExists(uint256 matchId) {
        _matchExists(matchId);
        _;
    }

    function _matchExists(uint256 matchId) internal view {
        if (matches[matchId].matchId == 0) revert MatchNotFound();
    }

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {}

    // ============ External Functions ============

    /**
     * @notice Create a new match for betting
     * @param homeTeam Name of the home team
     * @param awayTeam Name of the away team
     * @param competition Name of the competition (e.g., "Premier League")
     * @param kickoffTime Unix timestamp of match kickoff
     * @return matchId The ID of the created match
     */
    function createMatch(
        string calldata homeTeam,
        string calldata awayTeam,
        string calldata competition,
        uint256 kickoffTime
    ) external onlyOwner returns (uint256 matchId) {
        if (kickoffTime <= block.timestamp) revert KickoffTimePassed();

        matchId = nextMatchId++;

        matches[matchId] = Match({
            matchId: matchId,
            kickoffTime: kickoffTime,
            totalPool: 0,
            homePool: 0,
            drawPool: 0,
            awayPool: 0,
            homeBetCount: 0,
            drawBetCount: 0,
            awayBetCount: 0,
            platformFeeAmount: 0,
            result: Outcome.NONE,
            status: MatchStatus.OPEN,
            homeTeam: homeTeam,
            awayTeam: awayTeam,
            competition: competition
        });

        emit MatchCreated(matchId, homeTeam, awayTeam, competition, kickoffTime);
    }

    /**
     * @notice Place a bet on a match outcome
     * @param matchId The ID of the match to bet on
     * @param prediction The predicted outcome (HOME, DRAW, or AWAY)
     */
    function placeBet(uint256 matchId, Outcome prediction)
        external
        payable
        nonReentrant
        whenNotPaused
        matchExists(matchId)
    {
        _validateBet(matchId, prediction, msg.value);
        _processBet(matchId, prediction, msg.value);
    }

    /**
     * @notice Close betting for a match (usually called at kickoff)
     * @param matchId The ID of the match
     */
    function closeBetting(uint256 matchId) external onlyOwner matchExists(matchId) {
        Match storage matchData = matches[matchId];

        if (matchData.status != MatchStatus.OPEN) revert MatchNotOpen();

        matchData.status = MatchStatus.CLOSED;

        emit BettingClosed(matchId);
    }

    /**
     * @notice Resolve a match with the final result
     * @param matchId The ID of the match
     * @param result The match outcome (HOME, DRAW, or AWAY)
     */
    function resolveMatch(uint256 matchId, Outcome result) external onlyOwner matchExists(matchId) {
        Match storage matchData = matches[matchId];

        _validateResolution(matchData, result);

        // Auto-close if still open
        if (matchData.status == MatchStatus.OPEN) {
            matchData.status = MatchStatus.CLOSED;
        }

        matchData.result = result;
        matchData.status = MatchStatus.RESOLVED;

        // Calculate and store platform fee
        uint256 winnerPool = _getOutcomePool(matchData, result);
        uint256 platformFee = _calculateAndStoreFee(matchData, winnerPool);

        emit MatchResolved(matchId, result, matchData.totalPool, _getOutcomePool(matchData, result), platformFee);
    }

    /**
     * @notice Cancel a match and enable refunds
     * @param matchId The ID of the match
     * @param reason The reason for cancellation
     */
    function cancelMatch(uint256 matchId, string calldata reason) external onlyOwner matchExists(matchId) {
        Match storage matchData = matches[matchId];

        if (matchData.status == MatchStatus.RESOLVED) revert MatchAlreadyResolved();
        if (matchData.status == MatchStatus.CANCELLED) revert MatchAlreadyCancelled();

        matchData.status = MatchStatus.CANCELLED;

        emit MatchCancelled(matchId, reason);
    }

    /**
     * @notice Claim winnings for a resolved match
     * @param matchId The ID of the match
     */
    function claimWinnings(uint256 matchId) external nonReentrant matchExists(matchId) {
        Match storage matchData = matches[matchId];

        _validateClaim(matchData, matchId);

        Bet storage userBet = userBets[matchId][msg.sender];

        uint256 payout = _calculatePayout(matchData, userBet);

        userBet.claimed = true;

        _transferPayout(payout);

        uint256 profit = payout > userBet.amount ? payout - userBet.amount : 0;

        emit WinningsClaimed(matchId, msg.sender, payout, profit);
    }

    /**
     * @notice Claim refund for a cancelled match
     * @param matchId The ID of the match
     */
    function claimRefund(uint256 matchId) external nonReentrant matchExists(matchId) {
        Match storage matchData = matches[matchId];

        if (matchData.status != MatchStatus.CANCELLED) revert MatchNotCancelled();
        if (!hasBet[matchId][msg.sender]) revert NoBetFound();

        Bet storage userBet = userBets[matchId][msg.sender];
        if (userBet.claimed) revert AlreadyClaimed();

        uint256 refundAmount = userBet.amount;
        userBet.claimed = true;

        _transferPayout(refundAmount);

        emit RefundClaimed(matchId, msg.sender, refundAmount);
    }

    /**
     * @notice Withdraw accumulated platform fees
     * @param to Address to send fees to
     */
    function withdrawFees(address to) external onlyOwner {
        if (accumulatedFees == 0) revert NoFeesToWithdraw();

        uint256 amount = accumulatedFees;
        accumulatedFees = 0;

        _transferPayout(to, amount);

        emit FeesWithdrawn(to, amount);
    }

    // ============ Admin Functions ============

    /**
     * @notice Update minimum and maximum stake amounts
     * @param newMin New minimum stake in wei
     * @param newMax New maximum stake in wei
     */
    function setStakeLimits(uint256 newMin, uint256 newMax) external onlyOwner {
        if (newMin == 0 || newMax <= newMin) revert InvalidStakeLimits();

        minStake = newMin;
        maxStake = newMax;

        emit StakeLimitsUpdated(newMin, newMax);
    }

    /**
     * @notice Update platform fee
     * @param newFeeBps New fee in basis points (max 500 = 5%)
     */
    function setPlatformFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert InvalidFeeBps();

        platformFeeBps = newFeeBps;

        emit PlatformFeeUpdated(newFeeBps);
    }

    /**
     * @notice Pause the contract (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ View Functions ============

    /**
     * @notice Get match details
     * @param matchId The ID of the match
     * @return Match struct with all details
     */
    function getMatch(uint256 matchId) external view returns (Match memory) {
        return matches[matchId];
    }

    /**
     * @notice Get current odds for a match (in basis points, 10000 = 1x)
     * @param matchId The ID of the match
     * @return homeOdds Draw odds Away odds (in basis points)
     */
    function getOdds(uint256 matchId) external view returns (uint256 homeOdds, uint256 drawOdds, uint256 awayOdds) {
        Match storage matchData = matches[matchId];

        if (matchData.totalPool == 0) {
            return (0, 0, 0);
        }

        OddsCalculation memory calc = _calculateOdds(matchData);
        return (calc.homeOdds, calc.drawOdds, calc.awayOdds);
    }

    /**
     * @notice Get pool amounts for a match
     * @param matchId The ID of the match
     * @return total Home pool Draw pool Away pool
     */
    function getPools(uint256 matchId) external view returns (uint256 total, uint256 home, uint256 draw, uint256 away) {
        Match storage matchData = matches[matchId];
        return (matchData.totalPool, matchData.homePool, matchData.drawPool, matchData.awayPool);
    }

    /**
     * @notice Get a user's bet for a specific match
     * @param matchId The ID of the match
     * @param user The user's address
     * @return Bet struct with user's bet details
     */
    function getUserBet(uint256 matchId, address user) external view returns (Bet memory) {
        return userBets[matchId][user];
    }

    /**
     * @notice Check if a user has bet on a match
     * @param matchId The ID of the match
     * @param user The user's address
     * @return bool True if user has bet
     */
    function hasUserBet(uint256 matchId, address user) external view returns (bool) {
        return hasBet[matchId][user];
    }

    /**
     * @notice Get number of bets for each outcome
     * @param matchId The ID of the match
     * @return homeBets Number of home bets
     * @return drawBets Number of draw bets
     * @return awayBets Number of away bets
     */
    function getBetCounts(uint256 matchId)
        external
        view
        returns (uint256 homeBets, uint256 drawBets, uint256 awayBets)
    {
        Match storage matchData = matches[matchId];
        return (matchData.homeBetCount, matchData.drawBetCount, matchData.awayBetCount);
    }

    /**
     * @notice Calculate potential winnings for a hypothetical bet
     * @param matchId The ID of the match
     * @param outcome The outcome to bet on
     * @param amount The bet amount
     * @return potentialPayout The potential payout if this outcome wins
     */
    function calculatePotentialWinnings(uint256 matchId, Outcome outcome, uint256 amount)
        external
        view
        returns (uint256 potentialPayout)
    {
        Match storage matchData = matches[matchId];

        uint256 newTotalPool = matchData.totalPool + amount;
        uint256 newOutcomePool = _getOutcomePool(matchData, outcome) + amount;

        uint256 effectivePool = newTotalPool - _getPlatformFee(newTotalPool);
        potentialPayout = (amount * effectivePool) / newOutcomePool;
    }

    // ============ Internal Functions ============

    /**
     * @dev Validate bet parameters
     */
    function _validateBet(uint256 matchId, Outcome prediction, uint256 amount) internal view {
        Match storage matchData = matches[matchId];

        if (matchData.status != MatchStatus.OPEN) revert MatchNotOpen();
        if (block.timestamp >= matchData.kickoffTime) revert BettingIsClosed();
        if (amount < minStake) revert BelowMinStake();
        if (amount > maxStake) revert AboveMaxStake();
        if (hasBet[matchId][msg.sender]) revert AlreadyBet();
        if (prediction == Outcome.NONE) revert InvalidOutcome();
    }

    /**
     * @dev Process and store a bet
     */
    function _processBet(uint256 matchId, Outcome prediction, uint256 amount) internal {
        Match storage matchData = matches[matchId];

        // Update pools and bet counts
        matchData.totalPool += amount;

        if (prediction == Outcome.HOME) {
            matchData.homePool += amount;
            matchData.homeBetCount++;
        } else if (prediction == Outcome.DRAW) {
            matchData.drawPool += amount;
            matchData.drawBetCount++;
        } else {
            matchData.awayPool += amount;
            matchData.awayBetCount++;
        }

        // Store bet
        userBets[matchId][msg.sender] =
            Bet({bettor: msg.sender, amount: amount, prediction: prediction, claimed: false});

        hasBet[matchId][msg.sender] = true;

        emit BetPlaced(matchId, msg.sender, prediction, amount, matchData.totalPool);
    }

    /**
     * @dev Validate match resolution
     */
    function _validateResolution(Match storage matchData, Outcome result) internal view {
        if (matchData.status == MatchStatus.RESOLVED) revert MatchAlreadyResolved();
        if (matchData.status == MatchStatus.CANCELLED) revert MatchAlreadyCancelled();
        if (result == Outcome.NONE) revert InvalidOutcome();
        if (block.timestamp < matchData.kickoffTime + GRACE_PERIOD) revert KickoffNotReached();
    }

    /**
     * @dev Calculate and store platform fee for resolved match
     */
    function _calculateAndStoreFee(Match storage matchData, uint256 winnerPool) internal returns (uint256 platformFee) {
        // Only take fee if there are winners AND losers
        if (winnerPool > 0 && winnerPool < matchData.totalPool) {
            platformFee = _getPlatformFee(matchData.totalPool);
            matchData.platformFeeAmount = platformFee;
            accumulatedFees += platformFee;
        }

        return platformFee;
    }

    /**
     * @dev Validate winning claim
     */
    function _validateClaim(Match storage matchData, uint256 matchId) internal view {
        if (matchData.status != MatchStatus.RESOLVED) revert MatchNotResolved();
        if (!hasBet[matchId][msg.sender]) revert NoBetFound();

        Bet storage userBet = userBets[matchId][msg.sender];
        if (userBet.claimed) revert AlreadyClaimed();
        if (userBet.prediction != matchData.result) revert NotAWinner();
    }

    /**
     * @dev Calculate payout for a winning bet
     */
    function _calculatePayout(Match storage matchData, Bet storage userBet) internal view returns (uint256 payout) {
        uint256 winnerPool = _getOutcomePool(matchData, matchData.result);

        if (winnerPool == matchData.totalPool) {
            // Everyone bet on the same outcome - refund (no fee)
            payout = userBet.amount;
        } else {
            // Calculate share of the pool using stored platform fee
            uint256 distributablePool = matchData.totalPool - matchData.platformFeeAmount;
            payout = (userBet.amount * distributablePool) / winnerPool;
        }
    }

    /**
     * @dev Calculate odds for all outcomes
     */
    function _calculateOdds(Match storage matchData) internal view returns (OddsCalculation memory calc) {
        calc.platformFee = matchData.status == MatchStatus.RESOLVED
            ? matchData.platformFeeAmount
            : _getPlatformFee(matchData.totalPool);

        calc.effectivePool = matchData.totalPool - calc.platformFee;

        calc.homeOdds = matchData.homePool > 0 ? (calc.effectivePool * BASIS_POINTS) / matchData.homePool : 0;
        calc.drawOdds = matchData.drawPool > 0 ? (calc.effectivePool * BASIS_POINTS) / matchData.drawPool : 0;
        calc.awayOdds = matchData.awayPool > 0 ? (calc.effectivePool * BASIS_POINTS) / matchData.awayPool : 0;
    }

    /**
     * @dev Get the pool amount for a specific outcome
     */
    function _getOutcomePool(Match memory matchData, Outcome outcome) internal pure returns (uint256) {
        if (outcome == Outcome.HOME) return matchData.homePool;
        if (outcome == Outcome.DRAW) return matchData.drawPool;
        if (outcome == Outcome.AWAY) return matchData.awayPool;
        return 0;
    }

    /**
     * @dev Get the platform fee for a specific pool
     */
    function _getPlatformFee(uint256 totalPool) internal view returns (uint256) {
        return (totalPool * platformFeeBps) / BASIS_POINTS;
    }

    /**
     * @dev Transfer payout to sender
     */
    function _transferPayout(uint256 amount) internal {
        _transferPayout(msg.sender, amount);
    }

    /**
     * @dev Transfer payout to specified address
     */
    function _transferPayout(address to, uint256 amount) internal {
        (bool success,) = payable(to).call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    // ============ Receive Function ============

    /// @notice Reject direct ETH transfers (must use placeBet)
    receive() external payable {
        revert("Use placeBet function");
    }
}
