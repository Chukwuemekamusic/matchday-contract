// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import {Script, console} from "forge-std/Script.sol";
import {MatchDayBetV2} from "../src/MatchDayBetV2.sol";

// forge script script/Interactions.s.sol:ClaimWinnings \
//   --rpc-url $BASE_RPC_URL \
//   --sig "run(uint256)" \
//   1 \
//   --broadcast \
//   --account testnet

contract ClaimWinnings is Script {
    function run(uint256 matchId) external {
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");
        address userAddress = 0xb17B2CF146890336E383B891DC3D2F636B20a294;

        vm.startBroadcast(userAddress);

        MatchDayBetV2 matchDayBet = MatchDayBetV2(payable(proxyAddress));
        matchDayBet.claimWinnings(matchId);

        vm.stopBroadcast();
    }
}

// forge script script/Interactions.s.sol:GetMatch \
//   --rpc-url $BASE_RPC_URL \
//   --sig "run(uint256)" \
//   42 \
//   --broadcast

contract GetMatch is Script {
    function run(uint256 matchId) external {
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");

        MatchDayBetV2 matchDayBet = MatchDayBetV2(payable(proxyAddress));
        MatchDayBetV2.Match memory matchData = matchDayBet.getMatch(matchId);
        console.log("Match ID:", matchId);
        console.log("Home Team:", matchData.homeTeam);
        console.log("Away Team:", matchData.awayTeam);
        console.log("Kickoff Time:", matchData.kickoffTime);
        console.log("Status:", uint256(matchData.status));
        console.log("Result:", uint256(matchData.result));
    }
}

// forge script script/Interactions.s.sol:CancelMatch \
//   --rpc-url $BASE_RPC_URL \
//   --sig "run(uint256)" \
//   11 \
//   --broadcast \
//   --account testnet
contract CancelMatch is Script {
    function run(uint256 matchId) external {
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");
        address userAddress = vm.envAddress("OWNER_ADDRESS");

        vm.startBroadcast(userAddress);

        MatchDayBetV2 matchDayBet = MatchDayBetV2(payable(proxyAddress));
        matchDayBet.cancelMatch(matchId, "Duplicate match");

        vm.stopBroadcast();
    }
}

// forge script script/Interactions.s.sol:ResolveMatch \
//   --rpc-url $BASE_RPC_URL \
//   --sig "run(uint256,uint8)" \
//   34 1 \
//   --broadcast \
//   --account testnet
contract ResolveMatch is Script {
    function run(uint256 matchId, uint8 result) external {
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");
        address ownerAddress = vm.envAddress("OWNER_ADDRESS");

        vm.startBroadcast(ownerAddress);

        MatchDayBetV2 matchDayBet = MatchDayBetV2(payable(proxyAddress));
        matchDayBet.resolveMatch(matchId, MatchDayBetV2.Outcome(result));

        vm.stopBroadcast();

        console.log("Match", matchId, "resolved with result:", result);
    }
}

// forge script script/Interactions.s.sol:BatchResolveStuckMatches \
//   --rpc-url https://mainnet.base.org \
//   --broadcast \
//   --account testnet
//
// Resolves the 4 stuck matches:
// - Match 4: Real Oviedo vs Real Betis = DRAW (2)
// - Match 5: Atalanta vs Torino = HOME (1)
// - Match 17: Augsburg vs Union Berlin = DRAW (2)
// - Match 18: Verona vs Bologna = AWAY (3)
contract BatchResolveStuckMatches is Script {
    function run() external {
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");
        address ownerAddress = vm.envAddress("OWNER_ADDRESS");

        vm.startBroadcast(ownerAddress);

        MatchDayBetV2 matchDayBet = MatchDayBetV2(payable(proxyAddress));

        // Prepare batch data
        uint256[] memory matchIds = new uint256[](4);
        MatchDayBetV2.Outcome[] memory results = new MatchDayBetV2.Outcome[](4);

        // Match 4: Real Oviedo 1-1 Real Betis = DRAW
        matchIds[0] = 4;
        results[0] = MatchDayBetV2.Outcome.DRAW;

        // Match 5: Atalanta 2-0 Torino = HOME
        matchIds[1] = 5;
        results[1] = MatchDayBetV2.Outcome.HOME;

        // Match 17: Augsburg 1-1 Union Berlin = DRAW
        matchIds[2] = 17;
        results[2] = MatchDayBetV2.Outcome.DRAW;

        // Match 18: Verona 2-3 Bologna = AWAY
        matchIds[3] = 18;
        results[3] = MatchDayBetV2.Outcome.AWAY;

        console.log("Batch resolving 4 stuck matches...");
        matchDayBet.batchResolveMatches(matchIds, results);
        console.log("Successfully resolved all 4 matches!");

        vm.stopBroadcast();
    }
}

// forge script script/Interactions.s.sol:ResolveComoMatch \
//   --rpc-url https://mainnet.base.org \
//   --broadcast \
//   --account testnet
//
// Resolves Match 16: Como 1-3 Milan = AWAY (3)
contract ResolveComoMatch is Script {
    function run() external {
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");
        address ownerAddress = vm.envAddress("OWNER_ADDRESS");

        vm.startBroadcast(ownerAddress);

        MatchDayBetV2 matchDayBet = MatchDayBetV2(payable(proxyAddress));

        console.log("Resolving Match 16: Como 1-3 Milan = AWAY");
        matchDayBet.resolveMatch(16, MatchDayBetV2.Outcome.AWAY);
        console.log("Successfully resolved match 16!");

        vm.stopBroadcast();
    }
}

// forge script script/Interactions.s.sol:UserHasMatch \
//   --rpc-url $BASE_RPC_URL \
//   --sig "run(uint256,address)" \
//   22 0x6E0056fe681E087160BB40dB0Ae3419Ee6C2ECE4 \
//   --broadcast
contract UserHasMatch is Script {
    function run(uint256 matchId, address userAddress) external {
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");

        MatchDayBetV2 matchDayBet = MatchDayBetV2(payable(proxyAddress));
        bool hasBet = matchDayBet.hasUserBet(matchId, userAddress);
        console.log("User has bet:", hasBet);
    }
}

// forge script script/Interactions.s.sol:GetMatchPool \
//   --rpc-url $BASE_RPC_URL \
//   --sig "run(uint256)" \
//   23 \
//   --broadcast
contract GetMatchPool is Script {
    function run(uint256 matchId) external {
        address proxyAddress = vm.envAddress("PROXY_ADDRESS");

        MatchDayBetV2 matchDayBet = MatchDayBetV2(payable(proxyAddress));
        (uint256 total, uint256 home, uint256 draw, uint256 away) = matchDayBet.getPools(matchId);
        console.log("Match ID:", matchId);
        // team name
        console.log("Home team:", matchDayBet.getMatch(matchId).homeTeam);
        console.log("Away team:", matchDayBet.getMatch(matchId).awayTeam);
        console.log("Total pool:", total);
        console.log("Home pool:", home);
        console.log("Draw pool:", draw);
        console.log("Away pool:", away);
    }
}
