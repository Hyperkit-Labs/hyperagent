"""Pydantic models for API requests/responses"""

import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from hyperagent.core.exceptions import ValidationError


class WorkflowCreateRequest(BaseModel):
    """Request model for creating workflow"""

    nlp_input: str = Field(
        ..., description="Natural language description of contract", min_length=10, max_length=5000
    )
    network: str = Field(..., description="Target blockchain network")
    contract_type: Optional[str] = Field("Custom", description="Contract type", max_length=50)
    name: Optional[str] = Field(None, description="Workflow name", max_length=255)
    # REQUIRED: User wallet information for deployment
    wallet_address: str = Field(..., description="User's wallet address for deployment (REQUIRED)")
    use_gasless: Optional[bool] = Field(
        False, description="Use facilitator for gasless deployment (optional)"
    )
    signed_transaction: Optional[str] = Field(
        None, description="Pre-signed deployment transaction (optional, can be provided later)"
    )
    # Task selection (new modular approach)
    selected_tasks: Optional[List[str]] = Field(
        default=["generation", "audit", "testing", "deployment"],
        description="List of tasks to execute: generation, audit, testing, deployment"
    )
    # Backward compatibility fields (deprecated - use selected_tasks instead)
    skip_audit: Optional[bool] = Field(
        None, description="Skip audit (deprecated, use selected_tasks instead)"
    )
    skip_testing: Optional[bool] = Field(
        None, description="Skip testing (deprecated, use selected_tasks instead)"
    )
    skip_deployment: Optional[bool] = Field(
        None, description="Skip deployment (deprecated, use selected_tasks instead)"
    )

    @field_validator("nlp_input")
    @classmethod
    def validate_nlp_input(cls, v: str) -> str:
        """Validate NLP input length and content"""
        if len(v.strip()) < 10:
            raise ValueError("NLP description must be at least 10 characters")
        if len(v) > 5000:
            raise ValueError("NLP description must be less than 5000 characters")
        # Basic sanitization - remove potentially dangerous patterns
        # Remove null bytes and control characters
        v = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", v)
        return v.strip()

    @field_validator("wallet_address")
    @classmethod
    def validate_wallet_address(cls, v: str) -> str:
        """Validate wallet address format"""
        if not v:
            raise ValueError("wallet_address is required")
        # Basic format check
        if not re.match(r"^0x[a-fA-F0-9]{40}$", v):
            raise ValueError(
                "Invalid wallet address format. Must be 0x followed by 40 hexadecimal characters"
            )
        if v.lower() == "0x0000000000000000000000000000000000000000":
            raise ValueError("Zero address is not a valid wallet address")
        return v

    @field_validator("network")
    @classmethod
    def validate_network(cls, v: str) -> str:
        """Validate network name against supported networks"""
        from hyperagent.blockchain.network_features import NetworkFeatureManager

        supported_networks = NetworkFeatureManager.list_networks()
        # Normalize network name
        normalized = v.replace("-", "_").lower()
        if normalized not in supported_networks:
            raise ValueError(
                f"Unsupported network: {v}. " f"Supported networks: {', '.join(supported_networks)}"
            )
        return normalized


class WorkflowResponse(BaseModel):
    """Workflow response model"""

    workflow_id: str
    status: str
    message: str
    created_at: Optional[datetime] = None


class WorkflowStatusResponse(BaseModel):
    """Workflow status response"""

    workflow_id: str
    status: str
    progress_percentage: int
    network: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class ContractGenerationRequest(BaseModel):
    """Contract generation request"""

    nlp_description: str = Field(..., min_length=10, max_length=5000)
    contract_type: Optional[str] = Field("Custom", max_length=50)
    network: str

    @field_validator("nlp_description")
    @classmethod
    def validate_nlp_description(cls, v: str) -> str:
        """Validate NLP description"""
        if len(v.strip()) < 10:
            raise ValueError("NLP description must be at least 10 characters")
        if len(v) > 5000:
            raise ValueError("NLP description must be less than 5000 characters")
        # Sanitize
        v = re.sub(r"[\x00-\x1f\x7f-\x9f]", "", v)
        return v.strip()

    @field_validator("network")
    @classmethod
    def validate_network(cls, v: str) -> str:
        """Validate network name"""
        from hyperagent.blockchain.network_features import NetworkFeatureManager

        supported_networks = NetworkFeatureManager.list_networks()
        normalized = v.replace("-", "_").lower()
        if normalized not in supported_networks:
            raise ValueError(f"Unsupported network: {v}")
        return normalized


class ContractGenerationResponse(BaseModel):
    """Contract generation response"""

    contract_code: str
    contract_type: str
    abi: List[Dict[str, Any]]  # ABI is always a list of function/event definitions
    constructor_args: List[Dict[str, Any]]


class AuditRequest(BaseModel):
    """Security audit request"""

    contract_code: str = Field(..., min_length=50, max_length=100000)  # Reasonable limits
    audit_level: Optional[str] = Field("standard", pattern="^(standard|deep|quick)$")

    @field_validator("contract_code")
    @classmethod
    def validate_contract_code(cls, v: str) -> str:
        """Validate contract code"""
        if len(v.strip()) < 50:
            raise ValueError("Contract code must be at least 50 characters")
        if len(v) > 100000:
            raise ValueError("Contract code must be less than 100,000 characters")
        # Check for basic Solidity keywords
        if "pragma" not in v.lower() and "contract" not in v.lower():
            raise ValueError(
                "Contract code must contain Solidity code (pragma and contract keywords)"
            )
        return v


class AuditResponse(BaseModel):
    """Security audit response"""

    vulnerabilities: List[Dict[str, Any]]
    overall_risk_score: float
    audit_status: str
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int


class DeploymentRequest(BaseModel):
    """Deployment request"""

    compiled_contract: Dict[str, Any]
    network: str
    private_key: Optional[str] = (
        None  # Optional: for server-side deployments (legacy/non-x402 only)
    )
    constructor_args: Optional[List[Any]] = []
    # User wallet-based deployment fields (preferred for x402 networks)
    signed_transaction: Optional[str] = None  # Signed transaction from user's wallet (hex string)
    wallet_address: Optional[str] = None  # User's wallet address
    use_gasless: Optional[bool] = (
        False  # Use facilitator for gasless deployment (requires facilitator private key)
    )


class DeploymentPrepareRequest(BaseModel):
    """Request to prepare deployment transaction for signing"""

    compiled_contract: Dict[str, Any]
    network: str
    constructor_args: Optional[List[Any]] = []
    wallet_address: str  # User's wallet address (required for transaction preparation)


class DeploymentPrepareResponse(BaseModel):
    """Response with unsigned transaction data for frontend to sign"""

    transaction_data: Dict[str, Any]  # Transaction data for signing
    network: str
    wallet_address: str
    message: str = (
        "Sign this transaction in your wallet, then send the signed transaction to /deploy endpoint"
    )


class DeploymentResponse(BaseModel):
    """Deployment response"""

    contract_address: str
    transaction_hash: str
    block_number: int
    gas_used: int
    eigenda_commitment: Optional[str] = None


class UserOpDeploymentPrepareRequest(BaseModel):
    """Request model for preparing ERC-4337 UserOperation deployment"""
    
    user_smart_account: str = Field(..., description="User's Smart Account address")
    compiled_contract: Dict[str, Any] = Field(..., description="Compiled contract with bytecode and ABI")
    network: str = Field(..., description="Target blockchain network")
    wallet_address: str = Field(..., description="User's wallet address for payment verification")
    
    @field_validator("user_smart_account")
    @classmethod
    def validate_smart_account(cls, v: str) -> str:
        """Validate Smart Account address format"""
        if not re.match(r"^0x[a-fA-F0-9]{40}$", v):
            raise ValueError("Invalid Smart Account address format")
        return v


class UserOpDeploymentPrepareResponse(BaseModel):
    """Response model for prepared UserOperation"""
    
    userOp: Dict[str, Any] = Field(..., description="UserOperation ready for signing")
    paymasterData: Dict[str, Any] = Field(..., description="Paymaster sponsorship data")
    estimatedGas: str = Field(..., description="Estimated total gas for operation")


class UserOpDeploymentSubmitRequest(BaseModel):
    """Request model for submitting signed UserOperation"""
    
    signed_user_op: Dict[str, Any] = Field(..., description="User-signed UserOperation")
    network: str = Field(..., description="Target blockchain network")


class BatchDeploymentContract(BaseModel):
    """Single contract in batch deployment"""

    compiled_contract: Dict[str, Any]
    network: str
    contract_name: Optional[str] = None
    source_code: Optional[str] = None


class BatchDeploymentRequest(BaseModel):
    """Batch deployment request"""

    contracts: List[BatchDeploymentContract]
    use_pef: Optional[bool] = True
    max_parallel: Optional[int] = 10
    private_key: Optional[str] = None


class BatchDeploymentResult(BaseModel):
    """Single contract deployment result in batch"""

    contract_name: str
    status: str
    contract_address: Optional[str] = None
    transaction_hash: Optional[str] = None
    block_number: Optional[int] = None
    gas_used: Optional[int] = None
    error: Optional[str] = None


class BatchDeploymentResponse(BaseModel):
    """Batch deployment response"""

    success: bool
    deployments: List[BatchDeploymentResult]
    total_time: float
    parallel_count: int
    success_count: int
    failed_count: int
    batches_deployed: int


class WorkflowCostEstimateRequest(BaseModel):
    """Request model for estimating workflow cost"""

    selected_tasks: List[str] = Field(
        ..., description="List of tasks to estimate: generation, audit, testing, deployment"
    )
    network: str = Field(..., description="Target blockchain network")
    model: Optional[str] = Field(
        "gemini-2.5-flash", description="LLM model for generation (only affects generation cost)"
    )
    contract_complexity: Optional[str] = Field(
        "standard", description="Contract complexity: simple, standard, complex"
    )
    prompt_length: Optional[int] = Field(
        None, description="Length of prompt in characters (for accurate generation cost)"
    )
    contract_lines: Optional[int] = Field(
        None, description="Number of contract lines (for accurate audit/testing cost)"
    )
    contract_size: Optional[int] = Field(
        None, description="Size of contract in bytes (for accurate deployment cost)"
    )

    @field_validator("selected_tasks")
    @classmethod
    def validate_selected_tasks(cls, v: List[str]) -> List[str]:
        """Validate selected tasks"""
        valid_tasks = ["generation", "audit", "testing", "deployment"]
        normalized = [task.lower() for task in v]
        invalid = [task for task in normalized if task not in valid_tasks]
        if invalid:
            raise ValueError(
                f"Invalid tasks: {invalid}. Valid tasks are: {', '.join(valid_tasks)}"
            )
        if not normalized:
            raise ValueError("At least one task must be selected")
        return normalized

    @field_validator("contract_complexity")
    @classmethod
    def validate_complexity(cls, v: str) -> str:
        """Validate contract complexity"""
        valid = ["simple", "standard", "complex"]
        if v.lower() not in valid:
            raise ValueError(f"Invalid complexity: {v}. Valid options: {', '.join(valid)}")
        return v.lower()


class TaskCostBreakdownResponse(BaseModel):
    """Response model for task cost breakdown"""

    total_usdc: float = Field(..., description="Total cost in USDC")
    breakdown: Dict[str, Dict[str, float]] = Field(
        ...,
        description="Cost breakdown per task: {task: {base, multiplier, final}}"
    )
    network_multiplier: float = Field(..., description="Network cost multiplier")
    model_multiplier: float = Field(..., description="Model cost multiplier (1.0 if no generation)")
    complexity_multiplier: float = Field(..., description="Complexity cost multiplier")
    selected_tasks: List[str] = Field(..., description="List of selected tasks")
    network: str = Field(..., description="Target network")
