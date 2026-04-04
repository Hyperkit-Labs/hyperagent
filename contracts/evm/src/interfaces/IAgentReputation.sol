// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IAgentReputation
 * @notice On-chain reputation registry for HyperAgent agents.
 *         Uses uint256 agentId aligned with the ERC-8004 identity registry (ERC-1155).
 *         Tracks cumulative weighted score, feedback count, and threshold checks.
 */
interface IAgentReputation {
    event FeedbackSubmitted(
        uint256 indexed agentId,
        address indexed reviewer,
        uint8 score,
        bytes32 paymentRef
    );

    function submitFeedback(
        uint256 agentId,
        uint8 score,
        bytes32 paymentRef,
        uint256 paymentAmount
    ) external;

    function getReputation(uint256 agentId)
        external
        view
        returns (uint256 weightedScore, uint256 totalFeedback);

    function meetsThreshold(uint256 agentId, uint256 minScore)
        external
        view
        returns (bool);
}
