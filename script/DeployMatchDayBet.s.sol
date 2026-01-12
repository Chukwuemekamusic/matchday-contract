// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MatchDayBetV1} from "../src/MatchDayBetV1.sol";
import {MatchDayBetV2} from "../src/MatchDayBetV2.sol";

/**
 * @title DeployMatchDayBet
 * @notice Deployment script for MatchDayBet UUPS proxy
 *
 * Usage:
 *   # Deploy to Base Sepolia (testnet) using cast wallet
 *   forge script script/DeployMatchDayBet.s.sol:DeployMatchDayBet \
 *     --rpc-url $BASE_SEPOLIA_RPC \
 *     --account <account-name> \
 *     --sender <your-address> \
 *     --broadcast \
 *     --verify
 *
 *   # Deploy to Base Mainnet using cast wallet
 *   forge script script/DeployMatchDayBet.s.sol:DeployMatchDayBet \
 *     --rpc-url $BASE_MAINNET_RPC \
 *     --account <account-name> \
 *     --sender <your-address> \
 *     --broadcast \
 *     --verify
 *
 *   # Example:
 *   forge script script/DeployMatchDayBet.s.sol:DeployMatchDayBet \
 *     --rpc-url https://sepolia.base.org \
 *     --account myaccount \
 *     --sender 0xYourAddress \
 *     --broadcast
 */
contract DeployMatchDayBet is Script {
    function run() external {
        address owner = vm.envAddress("OWNER_ADDRESS");

        vm.startBroadcast();

        console.log("Deployer/Owner:", owner);
        console.log("Chain ID:", block.chainid);

        // 1. Deploy implementation
        MatchDayBetV1 implementation = new MatchDayBetV1();
        console.log("Implementation deployed at:", address(implementation));

        // 2. Encode initialize call
        bytes memory initData = abi.encodeWithSelector(MatchDayBetV1.initialize.selector, owner);

        // 3. Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        console.log("Proxy deployed at:", address(proxy));

        // 4. Verify deployment
        MatchDayBetV1 matchDayBet = MatchDayBetV1(payable(address(proxy)));
        console.log("Contract owner:", matchDayBet.owner());
        console.log("Version:", matchDayBet.version());
        console.log("Next match ID:", matchDayBet.nextMatchId());

        vm.stopBroadcast();

        // Summary
        console.log("\n========== DEPLOYMENT SUMMARY ==========");
        console.log("Implementation:", address(implementation));
        console.log("Proxy (use this):", address(proxy));
        console.log("Owner:", owner);
        console.log("=========================================\n");
    }
}

/**
 * @title AddMatchManager
 * @notice Script to add a match manager (bot) after deployment
 *
 * Usage:
 *   PROXY_ADDRESS=0x... BOT_ADDRESS=0x... forge script script/DeployMatchDayBet.s.sol:AddMatchManager \
 *     --rpc-url $BASE_SEPOLIA_RPC \
 *     --account <account-name> \
 *     --sender <owner-address> \
 *     --broadcast
 *
 *   # Example:
 *   PROXY_ADDRESS=0x123... BOT_ADDRESS=0x456... forge script script/DeployMatchDayBet.s.sol:AddMatchManager \
 *     --rpc-url https://sepolia.base.org \
 *     --account myaccount \
 *     --sender 0xYourAddress \
 *     --broadcast
 */
contract AddMatchManager is Script {
    function run() external {
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");
        // address botAddress = vm.envAddress("BOT_ADDRESS");
        address botAddress = vm.envAddress("BOT_TREASURY_ADDRESS");

        console.log("Owner:", msg.sender);
        console.log("Proxy:", proxyAddress);
        console.log("Bot to add:", botAddress);

        vm.startBroadcast();

        MatchDayBetV1 matchDayBet = MatchDayBetV1(payable(proxyAddress));
        matchDayBet.addMatchManager(botAddress);

        console.log("Bot added as match manager!");
        console.log("Is manager:", matchDayBet.isMatchManager(botAddress));

        vm.stopBroadcast();
    }
}

/**
 * @title UpgradeMatchDayBet
 * @notice Script to upgrade the contract to a new implementation
 *
 * Usage:
 *   PROXY_ADDRESS=0x... forge script script/DeployMatchDayBet.s.sol:UpgradeMatchDayBet \
 *     --rpc-url $BASE_SEPOLIA_RPC \
 *     --account <account-name> \
 *     --sender <owner-address> \
 *     --broadcast
 *
 *   # Example:
 *   PROXY_ADDRESS=0x123... forge script script/DeployMatchDayBet.s.sol:UpgradeMatchDayBet \
 *     --rpc-url https://sepolia.base.org \
 *     --account myaccount \
 *     --sender 0xYourAddress \
 *     --broadcast
 */
contract UpgradeMatchDayBet is Script {
    function run() external {
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");

        console.log("Owner:", msg.sender);
        console.log("Proxy:", proxyAddress);

        vm.startBroadcast();

        // Deploy new implementation (replace with V2, V3, etc.)
        MatchDayBetV2 newImplementation = new MatchDayBetV2();
        console.log("New implementation:", address(newImplementation));

        // Upgrade proxy to new implementation
        MatchDayBetV2 proxy = MatchDayBetV2(payable(proxyAddress));
        bytes memory initData = abi.encodeWithSelector(MatchDayBetV2.initializeV2.selector);
        proxy.upgradeToAndCall(address(newImplementation), initData);

        console.log("Upgrade complete!");
        console.log("New version:", proxy.version());

        vm.stopBroadcast();
    }
}

/**
 * @title UpdateStakeLimits
 * @notice Script to update minimum and maximum stake amounts
 *
 * Usage:
 *   PROXY_ADDRESS=0x... MIN_STAKE=0.0001 MAX_STAKE=0.1 forge script script/DeployMatchDayBet.s.sol:UpdateStakeLimits \
 *     --rpc-url $BASE_SEPOLIA_RPC \
 *     --account <account-name> \
 *     --sender <owner-address> \
 *     --broadcast
 *
 *   # Example for Base Sepolia:
 *   PROXY_ADDRESS=0x123... MIN_STAKE=0.0001 MAX_STAKE=0.1 forge script script/DeployMatchDayBet.s.sol:UpdateStakeLimits \
 *     --rpc-url https://sepolia.base.org \
 *     --account myaccount \
 *     --sender 0xYourAddress \
 *     --broadcast
 *
 *   # Example for Base Mainnet:
 *   PROXY_ADDRESS=0x123... MIN_STAKE=0.0001 MAX_STAKE=0.1 forge script script/DeployMatchDayBet.s.sol:UpdateStakeLimits \
 *     --rpc-url https://mainnet.base.org \
 *     --account myaccount \
 *     --sender 0xYourAddress \
 *     --broadcast
 */
contract UpdateStakeLimits is Script {
    function run() external {
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");

        // Read stake limits from environment (in ether units)
        // Default to 0.0001 ETH min and 0.1 ETH max if not specified
        uint256 minStakeEther = vm.envOr("MIN_STAKE", uint256(1e14)); // 0.0001 ether in wei
        uint256 maxStakeEther = vm.envOr("MAX_STAKE", uint256(1e17)); // 0.1 ether in wei

        // Convert to wei if values are less than 1 ether (assume they're in ether units)
        uint256 minStakeWei = minStakeEther < 1 ether ? minStakeEther : minStakeEther * 1 wei;
        uint256 maxStakeWei = maxStakeEther < 1 ether ? maxStakeEther : maxStakeEther * 1 wei;

        console.log("Owner:", msg.sender);
        console.log("Proxy:", proxyAddress);
        console.log("New Min Stake (wei):", minStakeWei);
        console.log("New Min Stake (ether):", minStakeWei / 1e18);
        console.log("New Max Stake (wei):", maxStakeWei);
        console.log("New Max Stake (ether):", maxStakeWei / 1e18);

        vm.startBroadcast();

        MatchDayBetV1 matchDayBet = MatchDayBetV1(payable(proxyAddress));

        // Display current values
        console.log("\nCurrent values:");
        console.log("Current Min Stake:", matchDayBet.minStake());
        console.log("Current Max Stake:", matchDayBet.maxStake());

        // Update stake limits
        matchDayBet.setStakeLimits(minStakeWei, maxStakeWei);

        console.log("\nStake limits updated!");
        console.log("New Min Stake:", matchDayBet.minStake());
        console.log("New Max Stake:", matchDayBet.maxStake());

        vm.stopBroadcast();

        // Summary
        console.log("\n========== UPDATE SUMMARY ==========");
        console.log("Contract:", proxyAddress);
        console.log("Min Stake (wei):", minStakeWei);
        console.log("Min Stake (ETH):", minStakeWei / 1e18);
        console.log("Max Stake (wei):", maxStakeWei);
        console.log("Max Stake (ETH):", maxStakeWei / 1e18);
        console.log("====================================\n");
    }
}
