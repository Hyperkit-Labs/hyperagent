// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IERC8004Identity
 * @notice Agent identity registry following ERC-8004 (ERC-1155 based).
 *         Official CA: 0x8004A818BFB912233c491871b3d84c89A494BD9e (SKALE Base Sepolia)
 *         Each agent is an ERC-1155 token identified by uint256 agentId,
 *         bound to an owner address with an on-chain AgentCard URI.
 */
interface IERC8004Identity {
    event AgentRegistered(uint256 indexed agentId, address indexed owner);
    event AgentCardUpdated(uint256 indexed agentId);

    function registerAgent(address owner, string calldata agentCardURI)
        external
        returns (uint256 agentId);

    function updateAgentCard(uint256 agentId, string calldata agentCardURI)
        external;

    function ownerOf(uint256 agentId) external view returns (address);

    function getAgentCard(uint256 agentId)
        external
        view
        returns (string memory agentCardURI);

    function isValidAgent(uint256 agentId) external view returns (bool);
}
