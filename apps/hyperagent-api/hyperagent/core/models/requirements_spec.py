"""Requirements specification model for structured requirements"""

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ContractType(str, Enum):
    """Types of smart contracts"""

    ERC20 = "ERC20"
    ERC721 = "ERC721"
    ERC1155 = "ERC1155"
    CUSTOM = "Custom"
    SUBSCRIPTION = "Subscription"
    ESCROW = "Escrow"
    PAYWALL = "Paywall"
    VESTING = "Vesting"
    AMM = "AMM"
    LENDING = "Lending"
    VAULT = "Vault"


class EconomicModel(str, Enum):
    """Economic models for contracts"""

    TOKEN = "token"
    SUBSCRIPTION = "subscription"
    PAY_PER_USE = "pay_per_use"
    ESCROW = "escrow"
    VESTING = "vesting"
    STAKING = "staking"
    GOVERNANCE = "governance"
    NONE = "none"


class RiskTolerance(str, Enum):
    """Risk tolerance levels"""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class RequirementsSpec(BaseModel):
    """Structured requirements specification"""

    contract_type: ContractType = Field(..., description="Type of contract to generate")
    economic_model: EconomicModel = Field(
        default=EconomicModel.NONE, description="Economic model for the contract"
    )
    roles: List[str] = Field(
        default_factory=list, description="Roles/permissions needed (e.g., owner, admin, user)"
    )
    risk_tolerance: RiskTolerance = Field(
        default=RiskTolerance.MEDIUM, description="Risk tolerance level"
    )
    networks: List[str] = Field(
        default_factory=list, description="Target blockchain networks"
    )
    features: List[str] = Field(
        default_factory=list, description="Specific features required"
    )
    constraints: List[str] = Field(
        default_factory=list, description="Constraints or limitations"
    )
    description: str = Field(..., description="Human-readable description of requirements")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )

    class Config:
        use_enum_values = True

