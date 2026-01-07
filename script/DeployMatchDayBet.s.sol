// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MatchDayBetV1} from "../src/MatchDayBetV1.sol";

/**
 * @title DeployMatchDayBet
 * @notice Deployment script for MatchDayBet UUPS proxy
 *
 * Usage:
 *   # Deploy to Base Sepolia (testnet)
 *   forge script script/DeployMatchDayBet.s.sol:DeployMatchDayBet \
 *     --rpc-url $BASE_SEPOLIA_RPC \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast \
 *     --verify
 *
 *   # Deploy to Base Mainnet
 *   forge script script/DeployMatchDayBet.s.sol:DeployMatchDayBet \
 *     --rpc-url $BASE_MAINNET_RPC \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast \
 *     --verify
 */
contract DeployMatchDayBet is Script {
    function run() external {
        // Get deployer from private key
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Optional: set a different owner (defaults to deployer)
        address owner = vm.envOr("CONTRACT_OWNER", deployer);

        console.log("Deployer:", deployer);
        console.log("Owner:", owner);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

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
 *     --private-key $OWNER_PRIVATE_KEY \
 *     --broadcast
 */
contract AddMatchManager is Script {
    function run() external {
        uint256 ownerPrivateKey = vm.envUint("OWNER_PRIVATE_KEY");
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");
        address botAddress = vm.envAddress("BOT_ADDRESS");

        console.log("Proxy:", proxyAddress);
        console.log("Bot to add:", botAddress);

        vm.startBroadcast(ownerPrivateKey);

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
 *     --private-key $OWNER_PRIVATE_KEY \
 *     --broadcast
 */
contract UpgradeMatchDayBet is Script {
    function run() external {
        uint256 ownerPrivateKey = vm.envUint("OWNER_PRIVATE_KEY");
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");

        console.log("Proxy:", proxyAddress);

        vm.startBroadcast(ownerPrivateKey);

        // Deploy new implementation (replace with V2, V3, etc.)
        MatchDayBetV1 newImplementation = new MatchDayBetV1();
        console.log("New implementation:", address(newImplementation));

        // Upgrade proxy to new implementation
        MatchDayBetV1 proxy = MatchDayBetV1(payable(proxyAddress));
        proxy.upgradeToAndCall(address(newImplementation), "");

        console.log("Upgrade complete!");
        console.log("New version:", proxy.version());

        vm.stopBroadcast();
    }
}
