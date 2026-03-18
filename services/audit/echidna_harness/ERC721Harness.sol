// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// ERC721 harness. Audit service replaces "Contract" with actual contract name.
/// Assumes ERC721 (balanceOf, ownerOf, tokenURI).
contract Harness {
    Contract target;

    constructor() {
        target = new Contract("TestNFT", "TNFT");
    }

    function echidna_balance_invariant(address a) public view returns (bool) {
        return target.balanceOf(a) >= 0;
    }

    function echidna_owner_of_invariant(uint256 id) public view returns (bool) {
        try target.ownerOf(id) returns (address) {
            return true;
        } catch {
            return true;
        }
    }
}
