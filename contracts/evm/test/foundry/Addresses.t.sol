// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {HyperAgentAddresses} from "../../src/addresses.sol";

contract AddressesTest is Test {
    function test_registry_address_non_zero() public pure {
        assertTrue(HyperAgentAddresses.ERC8004_IDENTITY_REGISTRY != address(0));
    }
}
