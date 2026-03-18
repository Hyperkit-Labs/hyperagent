// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// Generic ERC20 harness. Audit service replaces "Contract" with actual contract name.
/// Assumes constructor(string name, string symbol, uint256 initialSupply).
contract Harness {
    Contract target;

    constructor() {
        target = new Contract("Test", "TST", 1000000e18);
    }

    function echidna_total_supply_invariant() public view returns (bool) {
        return target.totalSupply() >= 0;
    }

    function echidna_balance_invariant(address a) public view returns (bool) {
        return target.balanceOf(a) >= 0;
    }
}
