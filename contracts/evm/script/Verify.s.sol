// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

/// @title Verify — placeholder script; use `scripts/contracts/verify-deployment.sh` for operators.
contract Verify is Script {
    function run() external pure {
        console2.log("Use scripts/contracts/verify-deployment.sh or forge verify-contract");
    }
}
