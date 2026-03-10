"""Normalized schemas for security policy evaluation.
GateStatus, FinalDecision, ToolName, NormalizedFinding, ToolResult, SecurityVerdict."""

from __future__ import annotations

from typing import Literal, TypedDict


class SecurityGateError(Exception):
    """Raised when deployment is blocked by security policy verdict."""

    def __init__(self, message: str = "Deployment blocked by security policy verdict") -> None:
        super().__init__(message)

GateStatus = Literal["PASS", "FAIL", "WAIVED", "NOT_APPLICABLE"]
FinalDecision = Literal["APPROVED", "REJECTED", "APPROVED_WITH_WAIVER"]
ToolName = Literal["scrubd", "slither", "mythril", "echidna", "pashov", "tenderly"]


class WaiverMetadata(TypedDict, total=False):
    approver_id: str
    approver_role: str
    reason: str
    expiry_at: str
    evidence_refs: list[str]
    linked_run_id: str


class NormalizedFinding(TypedDict, total=False):
    id: str
    tool: str
    title: str
    description: str
    severity: str
    swcId: str
    contract: str
    function: str
    file: str
    line: int
    evidenceRef: str
    txSequenceRef: str
    corroboratedBy: list[str]
    waivable: bool
    blocking: bool
    waiver: WaiverMetadata


class ToolResult(TypedDict, total=False):
    tool: str
    status: str
    required: bool
    executed: bool
    findings: list[NormalizedFinding]
    rawArtifactRef: str
    startedAt: str
    finishedAt: str
    reason: str


class SecurityVerdict(TypedDict, total=False):
    runId: str
    policyVersion: str
    finalDecision: str
    overallStatus: str
    toolResults: list[ToolResult]
    blockingFindings: list[NormalizedFinding]
    waivedFindings: list[NormalizedFinding]
    notApplicableTools: list[str]
    requiresHumanReview: bool
    approvedForDeploy: bool
    generatedAt: str
    signedBy: str
