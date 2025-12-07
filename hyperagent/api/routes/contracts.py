"""Contract API routes"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from hyperagent.api.models import (
    AuditRequest,
    AuditResponse,
    ContractGenerationRequest,
    ContractGenerationResponse,
)
from hyperagent.core.config import settings
from hyperagent.db.session import get_db
from hyperagent.llm.provider import LLMProviderFactory
from hyperagent.rag.template_retriever import TemplateRetriever
from hyperagent.security.audit import SecurityAuditor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/contracts", tags=["contracts"])


@router.post("/audit", response_model=AuditResponse)
async def audit_contract(request: AuditRequest) -> AuditResponse:
    """
    Run security audit on contract

    Logic:
    1. Initialize security auditor
    2. Run Slither analysis
    3. Aggregate vulnerabilities
    4. Calculate risk score
    """
    auditor = SecurityAuditor()

    # Run Slither
    slither_result = await auditor.run_slither(request.contract_code)

    vulnerabilities = slither_result.get("vulnerabilities", [])

    # Calculate risk score
    weights = {"critical": 25, "high": 10, "medium": 5, "low": 1}
    risk_score = 0
    critical_count = 0
    high_count = 0
    medium_count = 0
    low_count = 0

    for vuln in vulnerabilities:
        severity = vuln.get("severity", "low")
        risk_score += weights.get(severity, 1)
        if severity == "critical":
            critical_count += 1
        elif severity == "high":
            high_count += 1
        elif severity == "medium":
            medium_count += 1
        else:
            low_count += 1

    risk_score = min(100, risk_score)

    return AuditResponse(
        vulnerabilities=vulnerabilities,
        overall_risk_score=risk_score,
        audit_status="passed" if risk_score < 30 else "failed",
        critical_count=critical_count,
        high_count=high_count,
        medium_count=medium_count,
        low_count=low_count,
    )


async def _generate_contract_internal(
    request: ContractGenerationRequest, db: AsyncSession
) -> ContractGenerationResponse:
    """
    Internal contract generation logic

    Shared function that can be called from both regular and x402 routes.

    Args:
        request: Contract generation request
        db: Database session

    Returns:
        Contract generation response
    """
    # Initialize LLM provider
    llm_provider = LLMProviderFactory.create("gemini", api_key=settings.gemini_api_key)

    # Initialize template retriever with database session
    template_retriever = TemplateRetriever(llm_provider, db_session=db)

    # Generate contract
    contract_code = await template_retriever.retrieve_and_generate(
        request.nlp_description, request.contract_type
    )

    # Compile contract to extract ABI
    from hyperagent.core.services.compilation_service import CompilationService

    compilation_service = CompilationService()

    try:
        compiled_result = await compilation_service.process({"contract_code": contract_code})

        # Extract ABI from compiled contract
        compiled_contract = compiled_result.get("compiled_contract", {})
        abi = compiled_contract.get("abi", [])

        # Extract constructor args from ABI
        constructor_args = []
        for item in abi:
            if item.get("type") == "constructor":
                constructor_inputs = item.get("inputs", [])
                constructor_args = [
                    {
                        "name": inp.get("name", f"arg{i}"),
                        "type": inp.get("type", "string"),
                        "description": f"Constructor parameter {i+1}",
                    }
                    for i, inp in enumerate(constructor_inputs)
                ]
                break
    except Exception as e:
        logger.warning(f"Failed to compile contract for ABI extraction: {e}")
        # Fallback: return empty ABI if compilation fails
        abi = []
        constructor_args = []

    return ContractGenerationResponse(
        contract_code=contract_code,
        contract_type=request.contract_type,
        abi=abi,
        constructor_args=constructor_args,
    )


@router.post("/generate", response_model=ContractGenerationResponse)
async def generate_contract(request: ContractGenerationRequest, db: AsyncSession = Depends(get_db)):
    """
    Generate contract from NLP description

    Logic:
    1. Initialize LLM provider
    2. Initialize template retriever
    3. Generate contract using RAG
    4. Return contract code
    """
    return await _generate_contract_internal(request, db)
