// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

/**
 * @title MatchDayBet V2
 * @notice Parimutuel betting contract for football matches using native ETH on Base
 * @dev UUPS upgradeable, built for Towns Protocol bot integration
 * @author Towns Football Betting Bot
 *
 * V2 Changes:
 * - Fixed "no winner" edge case (funds no longer stuck when nobody wins)
 * - Added batch claiming (batchClaimWinnings, batchClaimRefunds)
 * - Added view functions for bot integration
 * - Added match-specific pause functionality
 * - Added batch cancel matches
 * - Gas optimizations in loops
 */
contract MatchDayBetV2 is Initializable, UUPSUpgradeable, ReentrancyGuard, PausableUpgradeable {
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

    struct ClaimStatus {
        bool canClaim;
        uint8 claimType; // 0=none, 1=winnings, 2=refund
        uint256 amount;
    }

    // ============ Constants ============

    uint256 public constant GRACE_PERIOD = 1 hours;
    uint256 private constant BASIS_POINTS = 10000;
    uint256 private constant MAX_FEE_BPS = 500; // 5%
    uint256 private constant MAX_BATCH_SIZE = 50; // Prevent DOS
    uint256 private constant MAX_STRING_LENGTH = 64; // Prevent DOS via long strings

    // ============ V1 State Variables ============
    // IMPORTANT: Never reorder, remove, or change types of these variables!

    /// @notice Contract owner (full control)
    address public owner;

    /// @notice Addresses that can manage matches (bot)
    mapping(address => bool) public matchManagers;

    /// @notice Whether upgrades are permanently locked
    bool public upgradesLocked;

    /// @notice Platform fee in basis points (100 = 1%)
    uint256 public platformFeeBps;

    /// @notice Minimum bet amount in wei
    uint256 public minStake;

    /// @notice Maximum bet amount in wei
    uint256 public maxStake;

    /// @notice Counter for match IDs
    uint256 public nextMatchId;

    /// @notice Accumulated platform fees available for withdrawal
    uint256 public accumulatedFees;

    /// @notice Match ID => Match data
    mapping(uint256 => Match) public matches;

    /// @notice Match ID => User address => User's bet
    mapping(uint256 => mapping(address => Bet)) public userBets;

    /// @notice Match ID => User address => Has user bet on this match
    mapping(uint256 => mapping(address => bool)) public hasBet;

    /// @dev Reserved storage gap for future upgrades (V1)
    uint256[40] private __gap;

    // ============ V2 State Variables ============
    // NEW in V2 - Added after V1 variables

    /// @notice Match ID => Is match paused (individual pause)
    mapping(uint256 => bool) public matchPaused;

    /// @notice User address => Total amount claimed (tracking)
    mapping(address => uint256) public userTotalClaimed;

    /// @notice Match ID => Total amount claimed for this match (tracking)
    mapping(uint256 => uint256) public matchTotalClaimed;

    /// @dev Reserved storage gap for future upgrades (V2)
    uint256[37] private __gap_v2;

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

    event BatchMatchesResolved(uint256[] matchIds, Outcome[] results);

    event MatchCancelled(uint256 indexed matchId, string reason);

    event WinningsClaimed(uint256 indexed matchId, address indexed bettor, uint256 amount, uint256 profit);

    event RefundClaimed(uint256 indexed matchId, address indexed bettor, uint256 amount);

    event FeesWithdrawn(address indexed to, uint256 amount);

    event StakeLimitsUpdated(uint256 newMin, uint256 newMax);

    event PlatformFeeUpdated(uint256 newFeeBps);

    event MatchManagerAdded(address indexed manager);

    event MatchManagerRemoved(address indexed manager);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    event UpgradesLocked();

    event EmergencyPausedByManager(address indexed manager);

    // V2 Events
    event BatchWinningsClaimed(address indexed user, uint256[] matchIds, uint256 totalPayout);

    event BatchRefundsClaimed(address indexed user, uint256[] matchIds, uint256 totalRefund);

    event MatchPaused(uint256 indexed matchId);

    event MatchUnpaused(uint256 indexed matchId);

    event BatchMatchesCancelled(uint256[] matchIds, string reason);

    // ============ Errors ============

    error NotOwner();
    error NotMatchManager();
    error UpgradesAreLocked();
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
    error ZeroAddress();
    error ArrayLengthMismatch();
    error MatchIsPaused();
    error EmptyArray();
    error BatchTooLarge();
    error StringTooLong();
    error NothingToClaim();

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyMatchManager() {
        if (!matchManagers[msg.sender] && msg.sender != owner) revert NotMatchManager();
        _;
    }

    modifier matchExists(uint256 matchId) {
        _matchExists(matchId);
        _;
    }

    modifier matchNotPaused(uint256 matchId) {
        if (matchPaused[matchId]) revert MatchIsPaused();
        _;
    }

    function _matchExists(uint256 matchId) internal view {
        if (matches[matchId].matchId == 0) revert MatchNotFound();
    }

    // ============ Constructor & Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract (replaces constructor for upgradeable) - V1
     * @param _owner The owner address (your wallet)
     */
    function initialize(address _owner) public initializer {
        if (_owner == address(0)) revert ZeroAddress();

        __Pausable_init();

        owner = _owner;
        matchManagers[_owner] = true;
        upgradesLocked = false;

        platformFeeBps = 100; // 1%
        minStake = 0.001 ether;
        maxStake = 0.1 ether;
        nextMatchId = 1;
    }

    /**
     * @notice Initialize V2 features
     * @dev Called once after upgrade from V1 to V2
     */
    function initializeV2() public reinitializer(2) {
        // V2 initialization logic (if needed)
        // Currently no special initialization needed for V2
        // matchPaused mapping starts empty (all false)
        // userTotalClaimed mapping starts empty (all 0)
    }

    // ============ UUPS Upgrade Authorization ============

    /**
     * @dev Required override for UUPS - controls who can upgrade
     */
    function _authorizeUpgrade(
        address /* newImplementation */
    )
        internal
        override
        onlyOwner
    {
        if (upgradesLocked) revert UpgradesAreLocked();
    }

    /**
     * @notice Permanently lock the contract from future upgrades
     * @dev This is irreversible!
     */
    function lockUpgrades() external onlyOwner {
        upgradesLocked = true;
        emit UpgradesLocked();
    }

    // ============ Owner Management ============

    /**
     * @notice Transfer ownership to a new address
     * @param newOwner The new owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();

        address previousOwner = owner;
        owner = newOwner;

        // New owner automatically becomes a match manager
        matchManagers[newOwner] = true;

        emit OwnershipTransferred(previousOwner, newOwner);
    }

    /**
     * @notice Add a match manager (bot)
     * @param manager The address to add as match manager
     */
    function addMatchManager(address manager) external onlyOwner {
        if (manager == address(0)) revert ZeroAddress();

        matchManagers[manager] = true;
        emit MatchManagerAdded(manager);
    }

    /**
     * @notice Remove a match manager
     * @param manager The address to remove
     */
    function removeMatchManager(address manager) external onlyOwner {
        matchManagers[manager] = false;
        emit MatchManagerRemoved(manager);
    }

    // ============ Match Manager Functions ============

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
    ) external onlyMatchManager whenNotPaused returns (uint256 matchId) {
        if (kickoffTime <= block.timestamp) revert KickoffTimePassed();
        if (bytes(homeTeam).length > MAX_STRING_LENGTH) revert StringTooLong();
        if (bytes(awayTeam).length > MAX_STRING_LENGTH) revert StringTooLong();
        if (bytes(competition).length > MAX_STRING_LENGTH) revert StringTooLong();

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
     * @notice Close betting for a match (usually called at kickoff)
     * @param matchId The ID of the match
     */
    function closeBetting(uint256 matchId) external onlyMatchManager matchExists(matchId) {
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
    function resolveMatch(uint256 matchId, Outcome result) external onlyMatchManager matchExists(matchId) {
        _resolveMatch(matchId, result);
    }

    /**
     * @notice Batch resolve matches
     * @param matchIds Array of match IDs
     * @param results Array of match outcomes
     */
    function batchResolveMatches(uint256[] calldata matchIds, Outcome[] calldata results) external onlyMatchManager {
        if (matchIds.length != results.length) revert ArrayLengthMismatch();

        uint256 length = matchIds.length;
        for (uint256 i; i < length;) {
            _matchExists(matchIds[i]);
            _resolveMatch(matchIds[i], results[i]);
            unchecked {
                ++i;
            }
        }

        emit BatchMatchesResolved(matchIds, results);
    }

    /**
     * @notice Cancel a match and enable refunds
     * @param matchId The ID of the match
     * @param reason The reason for cancellation
     */
    function cancelMatch(uint256 matchId, string calldata reason) external onlyMatchManager matchExists(matchId) {
        Match storage matchData = matches[matchId];

        if (matchData.status == MatchStatus.RESOLVED) revert MatchAlreadyResolved();
        if (matchData.status == MatchStatus.CANCELLED) revert MatchAlreadyCancelled();

        matchData.status = MatchStatus.CANCELLED;

        emit MatchCancelled(matchId, reason);
    }

    /**
     * @notice Cancel multiple matches at once (V2)
     * @param matchIds Array of match IDs to cancel
     * @param reason The reason for cancellation
     */
    function batchCancelMatches(uint256[] calldata matchIds, string calldata reason) external onlyMatchManager {
        if (matchIds.length == 0) revert EmptyArray();
        if (matchIds.length > MAX_BATCH_SIZE) revert BatchTooLarge();

        uint256 length = matchIds.length;
        for (uint256 i; i < length;) {
            _matchExists(matchIds[i]);

            Match storage matchData = matches[matchIds[i]];

            if (matchData.status != MatchStatus.RESOLVED && matchData.status != MatchStatus.CANCELLED) {
                matchData.status = MatchStatus.CANCELLED;
                emit MatchCancelled(matchIds[i], reason);
            }

            unchecked {
                ++i;
            }
        }

        emit BatchMatchesCancelled(matchIds, reason);
    }

    /**
     * @notice Pause a specific match (V2)
     * @param matchId The ID of the match to pause
     */
    function pauseMatch(uint256 matchId) external onlyMatchManager matchExists(matchId) {
        matchPaused[matchId] = true;
        emit MatchPaused(matchId);
    }

    /**
     * @notice Unpause a specific match (V2)
     * @param matchId The ID of the match to unpause
     */
    function unpauseMatch(uint256 matchId) external onlyOwner matchExists(matchId) {
        matchPaused[matchId] = false;
        emit MatchUnpaused(matchId);
    }

    /**
     * @notice Emergency pause - bot can pause but only owner can unpause
     * @dev Allows bot to stop the bleeding if something goes wrong
     */
    function emergencyPause() external onlyMatchManager {
        _pause();
        emit EmergencyPausedByManager(msg.sender);
    }

    // ============ User Functions ============

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
        matchNotPaused(matchId)
    {
        _validateBet(matchId, prediction, msg.value);
        _processBet(matchId, prediction, msg.value);
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
        userTotalClaimed[msg.sender] += payout;
        matchTotalClaimed[matchId] += payout;

        _transferPayout(payout);

        uint256 profit = payout > userBet.amount ? payout - userBet.amount : 0;

        emit WinningsClaimed(matchId, msg.sender, payout, profit);
    }

    /**
     * @notice Claim winnings from multiple matches in one transaction (V2)
     * @param matchIds Array of match IDs to claim from
     * @return totalPayout Total amount claimed
     * @dev Skips matches that can't be claimed (doesn't revert entire tx)
     */
    function batchClaimWinnings(uint256[] calldata matchIds) external nonReentrant returns (uint256 totalPayout) {
        if (matchIds.length == 0) revert EmptyArray();
        if (matchIds.length > MAX_BATCH_SIZE) revert BatchTooLarge();

        uint256 length = matchIds.length;
        for (uint256 i; i < length;) {
            uint256 matchId = matchIds[i];
            Match storage matchData = matches[matchId];

            // Skip if not resolved or user hasn't bet
            if (matchData.status != MatchStatus.RESOLVED || !hasBet[matchId][msg.sender]) {
                unchecked {
                    ++i;
                }
                continue;
            }

            Bet storage userBet = userBets[matchId][msg.sender];

            // Skip if already claimed
            if (userBet.claimed) {
                unchecked {
                    ++i;
                }
                continue;
            }

            // Check if user won (or if winnerPool == 0, everyone gets refund)
            uint256 winnerPool = _getOutcomePool(matchData, matchData.result);
            if (winnerPool > 0 && userBet.prediction != matchData.result) {
                unchecked {
                    ++i;
                }
                continue;
            }

            // Calculate and accumulate payout
            uint256 payout = _calculatePayout(matchData, userBet);
            userBet.claimed = true;
            matchTotalClaimed[matchId] += payout;
            totalPayout += payout;

            uint256 profit = payout > userBet.amount ? payout - userBet.amount : 0;
            emit WinningsClaimed(matchId, msg.sender, payout, profit);

            unchecked {
                ++i;
            }
        }

        if (totalPayout == 0) revert NothingToClaim();

        userTotalClaimed[msg.sender] += totalPayout;
        _transferPayout(totalPayout);

        emit BatchWinningsClaimed(msg.sender, matchIds, totalPayout);
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
        userTotalClaimed[msg.sender] += refundAmount;
        matchTotalClaimed[matchId] += refundAmount;

        _transferPayout(refundAmount);

        emit RefundClaimed(matchId, msg.sender, refundAmount);
    }

    /**
     * @notice Claim refunds from multiple cancelled matches (V2)
     * @param matchIds Array of match IDs
     * @return totalRefund Total refund amount
     */
    function batchClaimRefunds(uint256[] calldata matchIds) external nonReentrant returns (uint256 totalRefund) {
        if (matchIds.length == 0) revert EmptyArray();
        if (matchIds.length > MAX_BATCH_SIZE) revert BatchTooLarge();

        uint256 length = matchIds.length;
        for (uint256 i; i < length;) {
            uint256 matchId = matchIds[i];
            Match storage matchData = matches[matchId];

            // Skip if not cancelled or user hasn't bet
            if (matchData.status != MatchStatus.CANCELLED || !hasBet[matchId][msg.sender]) {
                unchecked {
                    ++i;
                }
                continue;
            }

            Bet storage userBet = userBets[matchId][msg.sender];

            // Skip if already claimed
            if (userBet.claimed) {
                unchecked {
                    ++i;
                }
                continue;
            }

            uint256 refundAmount = userBet.amount;
            userBet.claimed = true;
            matchTotalClaimed[matchId] += refundAmount;
            totalRefund += refundAmount;

            emit RefundClaimed(matchId, msg.sender, refundAmount);

            unchecked {
                ++i;
            }
        }

        if (totalRefund == 0) revert NothingToClaim();

        userTotalClaimed[msg.sender] += totalRefund;
        _transferPayout(totalRefund);

        emit BatchRefundsClaimed(msg.sender, matchIds, totalRefund);
    }

    // ============ Owner-Only Admin Functions ============

    /**
     * @notice Unpause the contract (only owner, not match managers)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Withdraw accumulated platform fees
     * @param to Address to send fees to
     */
    function withdrawFees(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (accumulatedFees == 0) revert NoFeesToWithdraw();

        uint256 amount = accumulatedFees;
        accumulatedFees = 0;

        _transferPayout(to, amount);

        emit FeesWithdrawn(to, amount);
    }

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
     * @notice Check if an address is a match manager
     * @param manager The address to check
     * @return bool True if address is a match manager
     */
    function isMatchManager(address manager) external view returns (bool) {
        return matchManagers[manager];
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

        // Safety check: prevent division by zero (shouldn't happen in normal flow)
        if (newOutcomePool == 0) return 0;

        uint256 effectivePool = newTotalPool - _getPlatformFee(newTotalPool);
        potentialPayout = (amount * effectivePool) / newOutcomePool;
    }

    /**
     * @notice Get claim status for a user on a match (V2)
     * @param matchId The ID of the match
     * @param user The user's address
     * @return status ClaimStatus struct with canClaim, claimType, amount
     */
    function getClaimStatus(uint256 matchId, address user) external view returns (ClaimStatus memory status) {
        Match storage matchData = matches[matchId];

        if (!hasBet[matchId][user]) {
            return ClaimStatus({canClaim: false, claimType: 0, amount: 0});
        }

        Bet storage userBet = userBets[matchId][user];
        if (userBet.claimed) {
            return ClaimStatus({canClaim: false, claimType: 0, amount: 0});
        }

        if (matchData.status == MatchStatus.RESOLVED) {
            uint256 winnerPool = _getOutcomePool(matchData, matchData.result);

            // Check if user won OR if no winners (refund case)
            if (winnerPool == 0 || userBet.prediction == matchData.result) {
                uint256 payout = _calculatePayout(matchData, userBet);
                return ClaimStatus({canClaim: true, claimType: 1, amount: payout});
            }
        } else if (matchData.status == MatchStatus.CANCELLED) {
            return ClaimStatus({canClaim: true, claimType: 2, amount: userBet.amount});
        }

        return ClaimStatus({canClaim: false, claimType: 0, amount: 0});
    }

    /**
     * @notice Get all unclaimed winnings for a user (V2)
     * @param user User address
     * @param matchIds Array of match IDs to check
     * @return claimableMatches Array of match IDs with unclaimed winnings
     * @return payouts Corresponding payout amounts
     */
    function getUnclaimedWinnings(address user, uint256[] calldata matchIds)
        external
        view
        returns (uint256[] memory claimableMatches, uint256[] memory payouts)
    {
        uint256 count;
        uint256 length = matchIds.length;
        uint256[] memory tempMatches = new uint256[](length);
        uint256[] memory tempPayouts = new uint256[](length);

        for (uint256 i; i < length;) {
            uint256 matchId = matchIds[i];
            Match storage matchData = matches[matchId];

            if (matchData.status == MatchStatus.RESOLVED && hasBet[matchId][user]) {
                Bet storage userBet = userBets[matchId][user];

                if (!userBet.claimed) {
                    uint256 winnerPool = _getOutcomePool(matchData, matchData.result);

                    // Include if user won OR if no winners (refund)
                    if (winnerPool == 0 || userBet.prediction == matchData.result) {
                        tempMatches[count] = matchId;
                        tempPayouts[count] = _calculatePayout(matchData, userBet);
                        count++;
                    }
                }
            }

            unchecked {
                ++i;
            }
        }

        // Resize arrays to actual count
        claimableMatches = new uint256[](count);
        payouts = new uint256[](count);
        for (uint256 i; i < count;) {
            claimableMatches[i] = tempMatches[i];
            payouts[i] = tempPayouts[i];
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Get contract version
     * @return Version string
     */
    function version() external pure returns (string memory) {
        return "2.0.0";
    }

    /**
     * @notice Get multiple matches in one call (V2)
     * @param matchIds Array of match IDs to fetch
     * @return matchData Array of Match structs
     * @dev Useful for batch loading in bot/frontend
     */
    function getMatches(uint256[] calldata matchIds) external view returns (Match[] memory matchData) {
        uint256 length = matchIds.length;
        matchData = new Match[](length);

        for (uint256 i; i < length;) {
            matchData[i] = matches[matchIds[i]];
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Get the exact claimable amount for a user on a specific match (V2)
     * @param matchId The match ID
     * @param user User address
     * @return payoutAmount The actual ETH payout (0 if not claimable)
     * @return alreadyClaimed Whether user has already claimed
     * @dev Returns the exact amount that was/will be paid out, using same calculation as claimWinnings()
     */
    function getClaimableAmount(uint256 matchId, address user)
        external
        view
        returns (uint256 payoutAmount, bool alreadyClaimed)
    {
        Match storage matchData = matches[matchId];

        // Not a valid bet
        if (!hasBet[matchId][user]) {
            return (0, false);
        }

        Bet storage userBet = userBets[matchId][user];

        // Already claimed
        if (userBet.claimed) {
            return (0, true);
        }

        // Match not resolved yet
        if (matchData.status != MatchStatus.RESOLVED) {
            return (0, false);
        }

        // Check if user won (or if no winners, everyone gets refund)
        uint256 winnerPool = _getOutcomePool(matchData, matchData.result);

        // Didn't win and there were winners
        if (winnerPool > 0 && userBet.prediction != matchData.result) {
            return (0, false);
        }

        // Calculate actual payout using same logic as claimWinnings
        payoutAmount = _calculatePayout(matchData, userBet);
        alreadyClaimed = false;
    }

    /**
     * @notice Get claimable amounts for a user across multiple matches in one call (V2)
     * @param user User address
     * @param matchIds Array of match IDs to check
     * @return amounts Array of claimable amounts (0 if not claimable)
     * @return statuses Array of claim statuses (0=not claimable, 1=claimable, 2=already claimed)
     * @dev This is more efficient than calling getClaimableAmount() multiple times
     */
    function getBatchClaimableAmounts(address user, uint256[] calldata matchIds)
        external
        view
        returns (uint256[] memory amounts, uint8[] memory statuses)
    {
        uint256 length = matchIds.length;
        amounts = new uint256[](length);
        statuses = new uint8[](length);

        for (uint256 i; i < length;) {
            uint256 matchId = matchIds[i];
            Match storage matchData = matches[matchId];

            // Default: not claimable
            amounts[i] = 0;
            statuses[i] = 0;

            // Check if user has a bet
            if (hasBet[matchId][user]) {
                Bet storage userBet = userBets[matchId][user];

                if (userBet.claimed) {
                    // Already claimed
                    statuses[i] = 2;
                } else if (matchData.status == MatchStatus.RESOLVED) {
                    // Check if won
                    uint256 winnerPool = _getOutcomePool(matchData, matchData.result);

                    if (winnerPool == 0 || userBet.prediction == matchData.result) {
                        // User won or no winners (refund) - calculate payout
                        amounts[i] = _calculatePayout(matchData, userBet);
                        statuses[i] = 1; // Claimable
                    }
                }
            }

            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Get comprehensive financial summary for a match (V2)
     * @param matchId The match ID
     * @return totalPool Total amount wagered
     * @return platformFee Fee amount taken (or to be taken)
     * @return totalClaimable Total amount winners can claim
     * @return totalClaimed Amount already claimed by winners
     * @return unclaimedAmount Amount still to be claimed
     * @dev Useful for analytics and verifying all claims have been processed
     */
    function getMatchFinancials(uint256 matchId)
        external
        view
        returns (
            uint256 totalPool,
            uint256 platformFee,
            uint256 totalClaimable,
            uint256 totalClaimed,
            uint256 unclaimedAmount
        )
    {
        Match storage matchData = matches[matchId];

        totalPool = matchData.totalPool;
        totalClaimed = matchTotalClaimed[matchId];

        if (matchData.status == MatchStatus.RESOLVED) {
            uint256 winnerPool = _getOutcomePool(matchData, matchData.result);

            if (winnerPool == 0 || winnerPool == matchData.totalPool) {
                // NO WINNERS or ALL WINNERS - No fee charged
                platformFee = 0;
                totalClaimable = matchData.totalPool;
            } else {
                // NORMAL CASE - Fee charged
                platformFee = matchData.platformFeeAmount;
                totalClaimable = matchData.totalPool - platformFee;
            }

            unclaimedAmount = totalClaimable > totalClaimed ? totalClaimable - totalClaimed : 0;
        } else if (matchData.status == MatchStatus.CANCELLED) {
            // Cancelled - Full refunds, no fee
            platformFee = 0;
            totalClaimable = matchData.totalPool;
            unclaimedAmount = totalClaimable > totalClaimed ? totalClaimable - totalClaimed : 0;
        } else {
            // Not resolved yet - Estimated fee
            platformFee = _getPlatformFee(matchData.totalPool);
            totalClaimable = 0; // Can't claim yet
            unclaimedAmount = 0;
        }
    }

    // ============ Internal Functions ============

    function _resolveMatch(uint256 matchId, Outcome result) internal {
        Match storage matchData = matches[matchId];

        _validateResolution(matchData, result);

        // Auto-close if still open
        if (matchData.status == MatchStatus.OPEN) {
            matchData.status = MatchStatus.CLOSED;
            emit BettingClosed(matchId);
        }

        matchData.result = result;
        matchData.status = MatchStatus.RESOLVED;

        // Calculate and store platform fee
        uint256 winnerPool = _getOutcomePool(matchData, result);
        uint256 platformFee = _calculateAndStoreFee(matchData, winnerPool);

        emit MatchResolved(matchId, result, matchData.totalPool, winnerPool, platformFee);
    }

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
     * FIXED in V2: Allow claims when winnerPool == 0 (refund case)
     */
    function _validateClaim(Match storage matchData, uint256 matchId) internal view {
        if (matchData.status != MatchStatus.RESOLVED) revert MatchNotResolved();
        if (!hasBet[matchId][msg.sender]) revert NoBetFound();

        Bet storage userBet = userBets[matchId][msg.sender];
        if (userBet.claimed) revert AlreadyClaimed();

        uint256 winnerPool = _getOutcomePool(matchData, matchData.result);

        // If no winners (winnerPool == 0), everyone can claim (refund)
        // If has winners, only winners can claim
        if (winnerPool > 0 && userBet.prediction != matchData.result) {
            revert NotAWinner();
        }
    }

    /**
     * @dev Calculate payout for a winning bet
     * FIXED in V2: Now handles winnerPool == 0 (no winners -> refund all)
     */
    function _calculatePayout(Match storage matchData, Bet storage userBet) internal view returns (uint256 payout) {
        uint256 winnerPool = _getOutcomePool(matchData, matchData.result);

        if (winnerPool == 0) {
            // NO WINNERS - Everyone gets refund (no fee)
            // Example: Everyone bet HOME/DRAW, but AWAY won
            payout = userBet.amount;
        } else if (winnerPool == matchData.totalPool) {
            // ALL WINNERS - Everyone bet on same outcome (no fee)
            payout = userBet.amount;
        } else {
            // NORMAL CASE - Winners split pool after fee
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

    fallback() external payable {
        revert("Use placeBet function");
    }
}

// NOTE:
// totalPool = sum of all bets
// totalPool = claimed + unclaimed + platform fees
// This invariant must always hold

