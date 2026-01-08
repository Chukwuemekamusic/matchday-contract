// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

library MatchDayBetLib {
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
}
