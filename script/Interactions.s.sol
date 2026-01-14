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

// forge script script/GetMatch.s.sol:GetMatch \
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
