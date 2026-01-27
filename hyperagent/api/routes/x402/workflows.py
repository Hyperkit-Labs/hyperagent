import asyncio
import logging
import uuid
from typing import Any, Dict, List, Optional, Tuple

import redis.asyncio as redis
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hyperagent.agents.testing import TestingAgent
from hyperagent.api.middleware.x402 import X402Middleware
from hyperagent.api.models import DeploymentResponse, WorkflowResponse
from hyperagent.billing.cost_estimator import CostEstimator
from hyperagent.api.routes.workflows import (
    get_or_create_default_user,
    update_workflow_and_persist_contracts,
    update_workflow_progress,
)
from hyperagent.architecture.soa import ServiceRegistry
from hyperagent.blockchain.eigenda_client import EigenDAClient
from hyperagent.blockchain.networks import NetworkManager
from hyperagent.core.config import settings
from hyperagent.core.orchestrator import WorkflowCoordinator
from hyperagent.core.services.audit_service import AuditService
from hyperagent.core.services.compilation_service import CompilationService
from hyperagent.core.services.deployment_service import DeploymentService
from hyperagent.core.services.generation_service import GenerationService
from hyperagent.core.services.testing_service import TestingService
from hyperagent.db.session import get_db
from hyperagent.events.event_bus import EventBus
from hyperagent.llm.provider import LLMProviderFactory
from hyperagent.models.user import User
from hyperagent.models.workflow import Workflow, WorkflowStatus
from hyperagent.rag.template_retriever import TemplateRetriever
from hyperagent.security.audit import SecurityAuditor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/x402/workflows", tags=["x402-workflows"])
x402_middleware = X402Middleware()

WORKFLOW_PRICE = 0.10


async def _create_llm_provider() -> Any:
    """Create LLM provider from configured API keys."""
    if settings.gemini_api_key:
        return LLMProviderFactory.create(
            "gemini",
            api_key=settings.gemini_api_key,
            model_name=settings.gemini_model,
            thinking_budget=settings.gemini_thinking_budget,
        )
    elif settings.openai_api_key:
        return LLMProviderFactory.create("openai", api_key=settings.openai_api_key)
    else:
        raise ValueError("No LLM API key configured")


async def _create_services_and_coordinator(
    db: AsyncSession, workflow_id: str
) -> Tuple[WorkflowCoordinator, ServiceRegistry]:
    """Create service registry and workflow coordinator."""
    llm_provider = await _create_llm_provider()
    template_retriever = TemplateRetriever(llm_provider, db)
    network_manager = NetworkManager()
    eigenda_client = EigenDAClient(
        disperser_url=settings.eigenda_disperser_url,
        private_key=settings.private_key,
        use_authenticated=settings.eigenda_use_authenticated,
    )

    redis_client = None
    redis_manager = None
    if settings.redis_url:
        try:
            redis_client = await redis.from_url(settings.redis_url, decode_responses=False)
            from hyperagent.cache.redis_manager import RedisManager

            redis_manager = RedisManager(url=settings.redis_url)
            await redis_manager.connect()
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e} - using in-memory fallback")
    event_bus = EventBus(redis_client)

    from hyperagent.core.planning.roma_planner import ROMAPlanner
    from hyperagent.core.routing.multi_model_router import MultiModelRouter
    from hyperagent.rag.firecrawl_rag import FirecrawlRAG
    from hyperagent.rag.vector_store import VectorStore

    roma_planner = ROMAPlanner(redis_manager=redis_manager) if redis_manager else None
    multi_model_router = MultiModelRouter(redis_manager=redis_manager) if redis_manager else None
    vector_store = VectorStore(db) if db else None
    firecrawl_rag = FirecrawlRAG(
        redis_manager=redis_manager, vector_store=vector_store, llm_provider=llm_provider
    ) if redis_manager else None

    service_registry = ServiceRegistry()
    service_registry.register(
        "generation",
        GenerationService(llm_provider, template_retriever, multi_model_router=multi_model_router),
    )
    service_registry.register("compilation", CompilationService())
    service_registry.register("audit", AuditService(SecurityAuditor()))
    service_registry.register("testing", TestingService(TestingAgent(event_bus, llm_provider)))
    service_registry.register(
        "deployment", DeploymentService(network_manager, eigenda_client)
    )

    async def progress_callback(status: str, progress: int) -> None:
        await update_workflow_progress(workflow_id, status, progress, db)

    coordinator = WorkflowCoordinator(
        service_registry,
        event_bus,
        progress_callback,
        redis_manager=redis_manager,
        roma_planner=roma_planner,
        firecrawl_rag=firecrawl_rag,
        multi_model_router=multi_model_router,
    )
    return coordinator, service_registry


async def _create_workflow_record(
    db: AsyncSession,
    contract_type: str,
    network: str,
    name: Optional[str],
    selected_tasks: Optional[List[str]] = None,
    cost_breakdown: Optional[Dict[str, Any]] = None,
) -> Tuple[str, Workflow]:
    """Create and persist workflow record."""
    user_id = await get_or_create_default_user(db)
    workflow_id = str(uuid.uuid4())
    workflow = Workflow(
        id=uuid.UUID(workflow_id),
        user_id=user_id,
        nlp_input=f"Generated {contract_type} contract",
        network=network,
        status=WorkflowStatus.GENERATING.value,
        progress_percentage=20,
        name=name or f"{contract_type} Contract Workflow",
    )
    
    # Store selected_tasks and cost_breakdown in workflow metadata
    if hasattr(workflow, "meta_data"):
        if workflow.meta_data is None:
            workflow.meta_data = {}
        workflow.meta_data["selected_tasks"] = selected_tasks
        workflow.meta_data["cost_breakdown"] = cost_breakdown

    db.add(workflow)
    await db.commit()
    await db.refresh(workflow)
    return workflow_id, workflow


def _create_deployment_service() -> DeploymentService:
    """Create deployment service instance."""
    network_manager = NetworkManager()
    eigenda_client = EigenDAClient(
        disperser_url=settings.eigenda_disperser_url,
        private_key=settings.private_key,
        use_authenticated=settings.eigenda_use_authenticated,
    )
    return DeploymentService(network_manager, eigenda_client)


def _update_workflow_after_deployment(workflow: Workflow) -> None:
    """Update workflow status and metadata after successful deployment."""
    workflow.status = WorkflowStatus.COMPLETED.value
    workflow.progress_percentage = 100

    # Clear deployment_skipped metadata since deployment is now complete
    if workflow.meta_data is None:
        workflow.meta_data = {}
    workflow.meta_data["deployment_status"] = "completed"
    workflow.meta_data["deployment_skipped"] = False
    workflow.meta_data["requires_user_signature"] = False


class WorkflowFromContractRequest(BaseModel):
    contract_code: str = Field(..., description="Generated contract source code")
    contract_type: str = Field(..., description="Contract type (ERC20, ERC721, Custom)")
    network: str = Field(..., description="Target blockchain network")
    constructor_args: Optional[List[Any]] = Field(default=[], description="Constructor arguments")
    name: Optional[str] = Field(None, description="Workflow name")
    wallet_address: Optional[str] = Field(None, description="User's wallet address for deployment")
    use_gasless: Optional[bool] = Field(True, description="Use facilitator for gasless deployment")
    selected_tasks: Optional[List[str]] = Field(
        default=["compilation", "audit", "testing", "deployment"],
        description="List of tasks to execute (generation skipped since contract provided)"
    )


@router.post("/create-from-contract", response_model=WorkflowResponse)
async def create_workflow_from_contract(
    request: WorkflowFromContractRequest, http_request: Request, db: AsyncSession = Depends(get_db)
) -> WorkflowResponse:
    # Extract wallet address from headers (case-insensitive) or request body
    wallet_address = (
        request.wallet_address
        or http_request.headers.get("x-wallet-address")
        or http_request.headers.get("X-Wallet-Address")
    )

    # Convert selected_tasks (default excludes generation since contract is provided)
    selected_tasks = request.selected_tasks or ["compilation", "audit", "testing", "deployment"]
    selected_tasks = [task.lower() for task in selected_tasks]
    
    # Calculate cost for selected tasks (excluding generation)
    estimator = CostEstimator()
    cost_breakdown = estimator.calculate_task_cost(
        selected_tasks=selected_tasks,
        network=request.network,
        model=getattr(settings, "gemini_model", "gemini-2.5-flash"),
        contract_complexity="standard",
        contract_lines=len(request.contract_code.split("\n")),
        contract_size=len(request.contract_code.encode("utf-8")),
    )
    
    # Verify payment via x402 middleware with task breakdown
    payment_response = await x402_middleware.verify_and_handle_payment(
        request=http_request,
        endpoint="/api/v1/x402/workflows/create-from-contract",
        price_tier="workflow",
        price_usdc=cost_breakdown["total_usdc"],
        network=request.network,
        db=db,
        wallet_address=wallet_address,
        merchant="workflow-from-contract",
        selected_tasks=selected_tasks,
        cost_breakdown=cost_breakdown,
    )
    
    if payment_response is not None:
        return payment_response
    
    logger.info(
        f"Creating workflow from contract for {wallet_address} - "
        f"payment verified: ${cost_breakdown['total_usdc']:.4f} for tasks {selected_tasks}"
    )

    try:
        workflow_id, workflow = await _create_workflow_record(
            db=db,
            contract_type=request.contract_type,
            network=request.network,
            name=request.name,
            selected_tasks=selected_tasks,
            cost_breakdown=cost_breakdown,
        )

        asyncio.create_task(
            execute_workflow_from_contract_background(
                workflow_id=workflow_id,
                contract_code=request.contract_code,
                contract_type=request.contract_type,
                network=request.network,
                constructor_args=request.constructor_args,
                wallet_address=request.wallet_address,
                use_gasless=request.use_gasless,
                selected_tasks=selected_tasks,
            )
        )

        return WorkflowResponse(
            workflow_id=workflow_id,
            status="generating",
            message="Workflow created and started. Executing: Compilation → Audit → Testing → Deployment",
        )

    except Exception as e:
        logger.error(f"Failed to create workflow from contract: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create workflow: {str(e)}")


async def execute_workflow_from_contract_background(
    workflow_id: str,
    contract_code: str,
    contract_type: str,
    network: str,
    constructor_args: Optional[List[Any]] = None,
    wallet_address: Optional[str] = None,
    use_gasless: bool = True,
    selected_tasks: Optional[List[str]] = None,
) -> None:
    """Execute workflow from contract in background task."""
    from hyperagent.db.session import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            workflow_result = await db.execute(
                select(Workflow).where(Workflow.id == uuid.UUID(workflow_id))
            )
            workflow = workflow_result.scalar_one_or_none()
            if workflow:
                workflow.status = WorkflowStatus.GENERATING.value
                workflow.progress_percentage = 20
                await db.commit()

            coordinator, _ = await _create_services_and_coordinator(db, workflow_id)

            result = await coordinator.execute_workflow_from_contract(
                workflow_id=workflow_id,
                contract_code=contract_code,
                contract_type=contract_type,
                network=network,
                constructor_args=constructor_args,
                wallet_address=wallet_address,
                use_gasless=use_gasless,
                selected_tasks=selected_tasks,  # NEW: Pass selected tasks
            )

            await update_workflow_and_persist_contracts(
                workflow_id=workflow_id, result=result, db=db
            )

        except Exception as e:
            logger.error(f"Workflow execution from contract failed: {e}", exc_info=True)
            try:
                workflow_result = await db.execute(
                    select(Workflow).where(Workflow.id == uuid.UUID(workflow_id))
                )
                workflow = workflow_result.scalar_one_or_none()
                if workflow:
                    workflow.status = WorkflowStatus.FAILED.value
                    workflow.error_message = str(e)
                    await db.commit()
            except Exception as db_error:
                logger.error(f"Failed to update workflow error status: {db_error}")
                await db.rollback()


class CompleteDeploymentRequest(BaseModel):
    workflow_id: str
    signed_transaction: str
    wallet_address: str


@router.post("/complete-deployment", response_model=DeploymentResponse)
async def complete_workflow_deployment(
    request: CompleteDeploymentRequest, http_request: Request, db: AsyncSession = Depends(get_db)
) -> DeploymentResponse:
    from hyperagent.models.contract import GeneratedContract

    try:
        workflow_result = await db.execute(
            select(Workflow).where(Workflow.id == uuid.UUID(request.workflow_id))
        )
        workflow = workflow_result.scalar_one_or_none()

        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        contract_result = await db.execute(
            select(GeneratedContract)
            .where(GeneratedContract.workflow_id == uuid.UUID(request.workflow_id))
            .order_by(GeneratedContract.created_at.desc())
        )
        contract = contract_result.scalar_one_or_none()

        if not contract:
            raise HTTPException(status_code=404, detail="No contract found for workflow")

        deployment_service = _create_deployment_service()

        deployment_result = await deployment_service._deploy_with_signed_transaction(
            signed_transaction=request.signed_transaction,
            network=workflow.network,
            wallet_address=request.wallet_address,
        )

        from hyperagent.models.deployment import Deployment

        deployment = Deployment(
            contract_id=contract.id,
            network=workflow.network,
            contract_address=deployment_result["contract_address"],
            transaction_hash=deployment_result["transaction_hash"],
            block_number=deployment_result["block_number"],
            gas_used=deployment_result.get("gas_used", 0),
        )
        db.add(deployment)

        _update_workflow_after_deployment(workflow)

        await db.commit()

        logger.info(
            f"Completed deployment for workflow {request.workflow_id}: {deployment_result['contract_address']}"
        )

        return DeploymentResponse(
            contract_address=deployment_result["contract_address"],
            transaction_hash=deployment_result["transaction_hash"],
            block_number=deployment_result["block_number"],
            gas_used=deployment_result.get("gas_used", 0),
            eigenda_commitment=deployment_result.get("eigenda_commitment"),
        )

    except ValueError as e:
        logger.error(f"Deployment validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to complete deployment: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to complete deployment: {str(e)}")
