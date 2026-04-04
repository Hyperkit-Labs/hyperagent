// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal property test so CI can run Echidna with a tiny budget.
contract EchidnaSmoke {
    function echidna_constants_hold() public pure returns (bool) {
        return true;
    }
}
