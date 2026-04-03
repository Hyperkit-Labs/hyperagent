// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IAgentValidation
 * @notice Validation registry for agent capabilities and task authorization.
 *         Uses uint256 agentId aligned with the ERC-8004 identity registry (ERC-1155).
 *         Validators attest that an agent is approved for a given capability.
 */
interface IAgentValidation {
    event AttestationGranted(
        uint256 indexed agentId,
        string validationType
    );

    function requestValidation(uint256 agentId, string calldata validationType)
        external;

    function submitAttestation(
        uint256 agentId,
        string calldata validationType,
        bytes calldata proof
    ) external;

    function hasAttestation(uint256 agentId, string calldata validationType)
        external view returns (bool);
}
