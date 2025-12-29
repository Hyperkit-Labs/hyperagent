"""Workflow API routes"""

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import redis.asyncio as redis
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from hyperagent.agents.testing import TestingAgent
from hyperagent.architecture.soa import ServiceRegistry
from hyperagent.blockchain.alith_client import AlithClient
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
from hyperagent.api.middleware.x402 import X402Middleware
from hyperagent.api.models import (
    TaskCostBreakdownResponse,
    WorkflowCostEstimateRequest,
    WorkflowCreateRequest,
)
from hyperagent.billing.cost_estimator import CostEstimator
from hyperagent.models.user import User
from hyperagent.models.workflow import Workflow, WorkflowStatus
from hyperagent.rag.template_retriever import TemplateRetriever
from hyperagent.security.audit import SecurityAuditor

logger = logging.getLogger(__name__)

MAX_DESCRIPTION_LENGTH = 200
DEFAULT_PAGE_LIMIT = 100


async def get_or_create_default_user(db: AsyncSession) -> uuid.UUID:
    """Get or create default user for workflows"""
    result = await db.execute(select(User).where(User.email == "default@hyperagent.local"))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email="default@hyperagent.local",
            username=None,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        logger.info(f"Created default user: {user.id}")
    else:
        logger.debug(f"Using existing default user: {user.id}")

    return user.id


async def execute_workflow_background(
    workflow_id: str,
    nlp_input: str,
    network: str,
    optimize_for_metisvm: bool,
    enable_floating_point: bool,
    enable_ai_inference: bool,
    skip_audit: bool,
    skip_deployment: bool,
    wallet_address: str,  # REQUIRED: User wallet address
    use_gasless: bool = False,  # Use facilitator for gasless deployment
    signed_transaction: Optional[str] = None,  # Pre-signed transaction (optional)
    selected_tasks: Optional[List[str]] = None,  # NEW: Selected tasks to execute
):
    """
    Execute workflow in background task

    Concept: Initialize all services and execute workflow pipeline
    Logic:
        1. Create new database session for background task
        2. Initialize LLM provider and services
        3. Register services in ServiceRegistry
        4. Create WorkflowCoordinator
        5. Execute workflow
        6. Update workflow status in database
        7. Persist contracts to database
    """
    from hyperagent.db.session import AsyncSessionLocal

    # Create new database session for background task
    async with AsyncSessionLocal() as db:
        try:
            # Update workflow status to generating
            workflow_result = await db.execute(
                select(Workflow).where(Workflow.id == uuid.UUID(workflow_id))
            )
            workflow = workflow_result.scalar_one_or_none()
            if workflow:
                workflow.status = WorkflowStatus.GENERATING.value
                workflow.progress_percentage = 10
                await db.commit()

            # Initialize services
            # Create LLM provider (Gemini default, OpenAI fallback)
            if settings.gemini_api_key:
                llm_provider = LLMProviderFactory.create(
                    "gemini",
                    api_key=settings.gemini_api_key,
                    model_name=settings.gemini_model,
                    thinking_budget=settings.gemini_thinking_budget,
                )
                logger.info(
                    f"Using Gemini model: {settings.gemini_model}"
                    + (
                        f" with thinking_budget={settings.gemini_thinking_budget}"
                        if settings.gemini_thinking_budget
                        else ""
                    )
                )
            elif settings.openai_api_key:
                llm_provider = LLMProviderFactory.create("openai", api_key=settings.openai_api_key)
                logger.info(f"Using OpenAI model: {settings.openai_model}")
            else:
                raise ValueError(
                    "No LLM API key configured (GEMINI_API_KEY or OPENAI_API_KEY required)"
                )

            template_retriever = TemplateRetriever(llm_provider, db)

            network_manager = NetworkManager()
            alith_client = AlithClient()
            eigenda_client = EigenDAClient(
                disperser_url=settings.eigenda_disperser_url,
                private_key=settings.private_key,
                use_authenticated=settings.eigenda_use_authenticated,
            )

            # Initialize Redis and EventBus
            # Redis is optional - EventBus has in-memory fallback
            redis_client = None
            redis_manager = None
            if settings.redis_url:
                try:
                    redis_client = redis.from_url(settings.redis_url, decode_responses=False)
                    from hyperagent.cache.redis_manager import RedisManager

                    redis_manager = RedisManager(url=settings.redis_url)
                    await redis_manager.connect()
                except Exception as e:
                    logger.warning(f"Failed to connect to Redis: {e} - using in-memory fallback")
            event_bus = EventBus(redis_client)

            # Register services (will be updated with multi_model_router later)
            service_registry = ServiceRegistry()
            service_registry.register("compilation", CompilationService())
            service_registry.register("audit", AuditService(SecurityAuditor()))
            service_registry.register(
                "testing", TestingService(TestingAgent(event_bus, llm_provider))
            )
            service_registry.register(
                "deployment", DeploymentService(network_manager, alith_client, eigenda_client)
            )

            # Create progress callback
            async def progress_callback(status: str, progress: int):
                """Update workflow progress after each stage"""
                await update_workflow_progress(workflow_id, status, progress, db)

            # Create coordinator with progress callback
            from hyperagent.core.planning.roma_planner import ROMAPlanner
            from hyperagent.core.routing.multi_model_router import MultiModelRouter
            from hyperagent.rag.firecrawl_rag import FirecrawlRAG
            from hyperagent.rag.vector_store import VectorStore

            roma_planner = ROMAPlanner(redis_manager=redis_manager) if redis_manager else None
            multi_model_router = MultiModelRouter(redis_manager=redis_manager) if redis_manager else None
            vector_store = VectorStore(db) if db else None
            firecrawl_rag = (
                FirecrawlRAG(
                    redis_manager=redis_manager,
                    vector_store=vector_store,
                    llm_provider=llm_provider,
                )
                if redis_manager
                else None
            )

            # Update GenerationService with multi_model_router
            # Register will overwrite existing service with same name
            service_registry.register(
                "generation",
                GenerationService(llm_provider, template_retriever, multi_model_router=multi_model_router),
            )

            coordinator = WorkflowCoordinator(
                service_registry,
                event_bus,
                progress_callback,
                redis_manager=redis_manager,
                roma_planner=roma_planner,
                firecrawl_rag=firecrawl_rag,
                multi_model_router=multi_model_router,
            )

            # Convert skip flags to selected_tasks if selected_tasks not provided (backward compatibility)
            workflow_selected_tasks = selected_tasks
            if workflow_selected_tasks is None:
                workflow_selected_tasks = ["generation", "compilation"]
                if not skip_audit:
                    workflow_selected_tasks.append("audit")
                if not getattr(settings, "skip_testing", False):
                    workflow_selected_tasks.append("testing")
                if not skip_deployment:
                    workflow_selected_tasks.append("deployment")
                logger.info(f"Converted skip flags to selected_tasks in background: {workflow_selected_tasks}")

            # Execute workflow with wallet information
            result = await coordinator.execute_workflow(
                workflow_id=workflow_id,
                nlp_input=nlp_input,
                network=network,
                optimize_for_metisvm=optimize_for_metisvm,
                enable_floating_point=enable_floating_point,
                enable_ai_inference=enable_ai_inference,
                wallet_address=wallet_address,  # REQUIRED: Pass wallet address
                use_gasless=use_gasless,  # Pass gasless option
                signed_transaction=signed_transaction,  # Pass signed transaction if provided
                selected_tasks=workflow_selected_tasks,  # NEW: Pass selected tasks
            )

            # Update workflow status and persist contracts
            await update_workflow_and_persist_contracts(
                workflow_id=workflow_id, result=result, db=db
            )

        except Exception as e:
            logger.error(f"Workflow execution failed: {e}", exc_info=True)
            # Update workflow with error
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
        except Exception as outer_error:
            logger.error(f"Critical error in workflow execution: {outer_error}", exc_info=True)
            await db.rollback()


async def update_workflow_progress(workflow_id: str, stage: str, progress: int, db: AsyncSession):
    """Update workflow progress percentage based on stage"""
    try:
        result = await db.execute(select(Workflow).where(Workflow.id == uuid.UUID(workflow_id)))
        workflow = result.scalar_one_or_none()

        if workflow:
            workflow.status = stage
            workflow.progress_percentage = progress
            await db.commit()
            logger.info(f"Updated workflow {workflow_id} progress to {progress}% (stage: {stage})")
    except Exception as e:
        logger.error(f"Failed to update workflow progress: {e}")
        await db.rollback()


async def update_workflow_and_persist_contracts(
    workflow_id: str, result: Dict[str, Any], db: AsyncSession
):
    """
    Update workflow status and persist contracts to database

    Concept: Save generated contracts and update workflow status
    Logic:
        1. Extract contract data from workflow result
        2. Create GeneratedContract record
        3. Update workflow status to completed
        4. Calculate progress percentage
    """
    import hashlib

    from hyperagent.models.contract import GeneratedContract

    try:
        workflow_result = await db.execute(
            select(Workflow).where(Workflow.id == uuid.UUID(workflow_id))
        )
        workflow = workflow_result.scalar_one_or_none()

        if not workflow:
            logger.warning(f"Workflow {workflow_id} not found for persistence")
            return

        # Extract workflow result data (even if failed, we may have contracts)
        # The result structure can be:
        # - {"result": {...}} (from coordinator.execute_workflow)
        # - {...} (direct result from orchestrator)
        workflow_result_data = result.get("result", result)

        # Extract contract data (save even if workflow failed, as long as compilation succeeded)
        contract_code = workflow_result_data.get("contract_code")
        compiled_contract = workflow_result_data.get("compiled_contract", {})
        contract_name = workflow_result_data.get("contract_name", "GeneratedContract")

        # Save contracts if compilation succeeded (even if workflow failed later)
        if contract_code and compiled_contract:
            # Calculate source code hash
            source_code_hash = "0x" + hashlib.sha256(contract_code.encode("utf-8")).hexdigest()

            # Create GeneratedContract record
            generated_contract = GeneratedContract(
                workflow_id=uuid.UUID(workflow_id),
                contract_name=contract_name,
                contract_type=workflow_result_data.get("contract_type", "Custom"),
                solidity_version=workflow_result_data.get("solidity_version", "0.8.27"),
                source_code=contract_code,
                source_code_hash=source_code_hash,
                bytecode=compiled_contract.get("bytecode"),
                abi=compiled_contract.get("abi"),
                deployed_bytecode=compiled_contract.get("deployed_bytecode"),
                line_count=len(contract_code.splitlines()),
                function_count=(
                    len(compiled_contract.get("abi", []))
                    if isinstance(compiled_contract.get("abi"), list)
                    else 0
                ),
            )

            db.add(generated_contract)
            logger.info(f"Persisted contract {contract_name} for workflow {workflow_id}")

        # Update workflow status
        # Check deployment status - can be "success", "skipped", or missing
        deployment_result_data = (
            workflow_result_data.get("deployment")
            or workflow_result_data.get("deployment_result")
            or {}
        )
        deployment_status = deployment_result_data.get("status")

        # Check if deployment was successful (even if workflow result status is not explicitly "success")
        deployment_successful = (
            workflow_result_data.get("contract_address") is not None
            or workflow_result_data.get("transaction_hash") is not None
            or deployment_status == "success"
            or result.get("status") == "success"
        )
        deployment_skipped = deployment_status == "skipped"

        if deployment_successful or result.get("status") == "success":
            workflow.status = WorkflowStatus.COMPLETED.value
            workflow.progress_percentage = 100
            logger.info(f"Workflow {workflow_id} marked as completed (deployment successful)")
        elif deployment_skipped:
            # Deployment was skipped (requires user signature for x402 networks)
            # Mark workflow as completed but note deployment is pending
            workflow.status = WorkflowStatus.COMPLETED.value
            workflow.progress_percentage = 100

            # Store deployment status in metadata
            if workflow.meta_data is None:
                workflow.meta_data = {}
            workflow.meta_data["deployment_status"] = "pending"
            workflow.meta_data["deployment_skipped"] = True
            workflow.meta_data["requires_user_signature"] = True
            workflow.meta_data["deployment_message"] = deployment_result_data.get(
                "message", "Deployment requires user signature"
            )

            logger.info(
                f"Workflow {workflow_id} marked as completed with skipped deployment "
                f"(requires user signature for x402 network)"
            )
        else:
            workflow.status = WorkflowStatus.FAILED.value
            workflow.error_message = result.get("error", "Unknown error")
            # Set progress based on which stage failed
            if compiled_contract:
                workflow.progress_percentage = 80  # Compilation succeeded
            else:
                workflow.progress_percentage = 20  # Failed early

        # Store test results in workflow metadata if available
        test_results = workflow_result_data.get("test_results")
        if test_results:
            if workflow.meta_data is None:
                workflow.meta_data = {}
            workflow.meta_data["test_results"] = test_results
            logger.info(f"Stored test results for workflow {workflow_id}")

        # Persist deployment if available
        # Check multiple possible keys for deployment results
        deployment_result = (
            workflow_result_data.get("deployment")
            or workflow_result_data.get("deployment_result")
            or (
                workflow_result_data.get("deployment_result")
                if "deployment_result" in workflow_result_data
                else None
            )
        )

        # Also check if deployment keys are at top level
        if not deployment_result and workflow_result_data.get("contract_address"):
            deployment_result = {
                "status": "success",
                "contract_address": workflow_result_data.get("contract_address"),
                "deployer_address": workflow_result_data.get("deployer_address"),
                "transaction_hash": workflow_result_data.get("transaction_hash"),
                "block_number": workflow_result_data.get("block_number"),
                "gas_used": workflow_result_data.get("gas_used"),
                "gas_price": workflow_result_data.get("gas_price"),
                "total_cost_wei": workflow_result_data.get("total_cost_wei"),
                "eigenda_commitment": workflow_result_data.get("eigenda_commitment"),
                "deployment_method": workflow_result_data.get("deployment_method", "manual"),
            }

        if deployment_result and deployment_result.get("status") == "success":
            from hyperagent.models.deployment import Deployment

            # Find the contract for this workflow
            contract_result = await db.execute(
                select(GeneratedContract)
                .where(GeneratedContract.workflow_id == uuid.UUID(workflow_id))
                .order_by(GeneratedContract.created_at.desc())
            )
            contract = contract_result.scalar_one_or_none()

            if contract:
                # Determine if testnet
                is_testnet = workflow.network.endswith("_testnet")

                # Create deployment record
                deployment = Deployment(
                    contract_id=contract.id,
                    deployment_network=workflow.network,
                    is_testnet=is_testnet,
                    contract_address=deployment_result.get("contract_address"),
                    deployer_address=deployment_result.get("deployer_address", ""),
                    transaction_hash=deployment_result.get("transaction_hash"),
                    gas_used=deployment_result.get("gas_used"),
                    gas_price=deployment_result.get("gas_price"),
                    total_cost_wei=deployment_result.get("total_cost_wei"),
                    deployment_status=(
                        "confirmed" if deployment_result.get("block_number") else "pending"
                    ),
                    block_number=deployment_result.get("block_number"),
                    confirmation_blocks=1,  # Default to 1 confirmation
                    eigenda_commitment=deployment_result.get("eigenda_commitment"),
                    eigenda_batch_header=deployment_result.get("eigenda_batch_header"),
                    metadata={
                        "deployment_method": deployment_result.get("deployment_method", "manual"),
                        "eigenda_metadata_stored": deployment_result.get(
                            "eigenda_metadata_stored", False
                        ),
                    },
                )

                db.add(deployment)
                logger.info(
                    f"Persisted deployment for contract {contract.contract_name} in workflow {workflow_id}"
                )

        # Note: Workflow status is already updated above (lines 250-261)

        await db.commit()
        logger.info(f"Updated workflow {workflow_id} status to {workflow.status}")

    except Exception as e:
        logger.error(f"Failed to persist contracts: {e}", exc_info=True)
        await db.rollback()


router = APIRouter(prefix="/api/v1/workflows", tags=["workflows"])


class WorkflowCreateRequest(BaseModel):
    """Request model for creating workflow"""

    nlp_input: str
    network: str
    contract_type: Optional[str] = "Custom"
    name: Optional[str] = None
    skip_audit: bool = False
    skip_deployment: bool = False
    optimize_for_metisvm: bool = False
    enable_floating_point: bool = False
    enable_ai_inference: bool = False
    # REQUIRED: User wallet information for deployment
    wallet_address: str  # User's wallet address (REQUIRED for all workflows)
    use_gasless: Optional[bool] = False  # Use facilitator for gasless deployment
    signed_transaction: Optional[str] = None  # Pre-signed deployment transaction (optional)
    # Task selection (new modular approach)
    selected_tasks: Optional[List[str]] = None  # List of tasks to execute


class WorkflowResponse(BaseModel):
    """Workflow response model"""

    workflow_id: str
    status: str
    message: str
    warnings: Optional[List[str]] = None
    features_used: Optional[Dict[str, Any]] = None


@router.post("/estimate-cost", response_model=TaskCostBreakdownResponse)
async def estimate_workflow_cost(
    request: WorkflowCostEstimateRequest, db: AsyncSession = Depends(get_db)
):
    """
    Estimate cost for selected tasks before workflow creation
    
    Returns cost breakdown so frontend can display payment modal with
    individual task prices and total.
    
    Args:
        request: Cost estimation request with selected tasks and parameters
        db: Database session
    
    Returns:
        Task cost breakdown with individual task prices and total
    """
    try:
        estimator = CostEstimator()
        cost_breakdown = estimator.calculate_task_cost(
            selected_tasks=request.selected_tasks,
            network=request.network,
            model=request.model or "gemini-2.5-flash",
            contract_complexity=request.contract_complexity or "standard",
            prompt_length=request.prompt_length,
            contract_lines=request.contract_lines,
            contract_size=request.contract_size,
        )
        
        return TaskCostBreakdownResponse(**cost_breakdown)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error estimating workflow cost: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to estimate workflow cost")


@router.post("/generate", response_model=WorkflowResponse)
async def create_workflow(request: WorkflowCreateRequest, db: AsyncSession = Depends(get_db)):
    """
    Create new workflow for contract generation

    NOW REQUIRES: wallet_address for user-wallet-based deployment

    Concept: Create workflow record and trigger execution
    Logic:
        1. Validate input (including wallet_address)
        2. Create workflow record in database
        3. Initialize WorkflowCoordinator
        4. Queue workflow execution
        5. Return workflow ID

    Args:
        request: Workflow creation request
        db: Database session

    Returns:
        Workflow response with ID and status
    """
    # Validate wallet_address is provided and valid
    if not request.wallet_address:
        raise HTTPException(
            status_code=400,
            detail="wallet_address is required for all workflows. "
            "Please provide the user's wallet address for deployment.",
        )

    # Validate wallet address format (checksum, non-zero, etc.)
    from hyperagent.utils.helpers import normalize_wallet_address, validate_wallet_address

    is_valid, error_msg = validate_wallet_address(request.wallet_address)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid wallet address: {error_msg}. "
            "Please provide a valid Ethereum address (0x followed by 40 hexadecimal characters).",
        )

    # Normalize to checksum format
    try:
        normalized_address = normalize_wallet_address(request.wallet_address)
        # Update request with normalized address
        request.wallet_address = normalized_address
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Wallet address validation failed: {str(e)}")

    # Convert skip_* flags to selected_tasks for backward compatibility
    selected_tasks = request.selected_tasks
    if selected_tasks is None:
        # Build selected_tasks from skip flags
        selected_tasks = ["generation", "compilation"]
        if not request.skip_audit:
            selected_tasks.append("audit")
        if not getattr(request, "skip_testing", False):
            selected_tasks.append("testing")
        if not request.skip_deployment:
            selected_tasks.append("deployment")
        logger.info(f"Converted skip flags to selected_tasks: {selected_tasks}")
    else:
        # Normalize selected_tasks
        selected_tasks = [task.lower() for task in selected_tasks]
        # Ensure compilation is included if audit/testing/deployment are selected
        if any(task in selected_tasks for task in ["audit", "testing", "deployment"]):
            if "compilation" not in selected_tasks:
                selected_tasks.insert(1, "compilation") if "generation" in selected_tasks else selected_tasks.insert(0, "compilation")

    # Calculate cost for selected tasks
    estimator = CostEstimator()
    cost_breakdown = estimator.calculate_task_cost(
        selected_tasks=selected_tasks,
        network=request.network,
        model=getattr(settings, "gemini_model", "gemini-2.5-flash"),
        contract_complexity="standard",
        prompt_length=len(request.nlp_input),
    )

    # Verify payment via x402 middleware (if x402 enabled)
    if settings.x402_enabled:
        from fastapi import Request as FastAPIRequest
        from hyperagent.blockchain.network_features import NetworkFeatureManager
        
        # Check if network supports x402
        is_x402_network = NetworkFeatureManager.is_x402_network(
            request.network, settings.x402_enabled, settings.x402_enabled_networks
        )
        
        if is_x402_network:
            # Create a mock request object for x402 middleware
            # In actual implementation, this would come from the FastAPI request
            x402_middleware = X402Middleware()
            
            # Note: We need the actual HTTP request object here
            # For now, we'll handle payment verification in the x402 workflows endpoint
            # This is a placeholder - actual implementation should use the request object
            logger.info(
                f"Cost calculated for workflow: ${cost_breakdown['total_usdc']:.4f} "
                f"for tasks {selected_tasks}"
            )

    try:
        # Get or create default user (in same transaction)
        result = await db.execute(select(User).where(User.email == "default@hyperagent.local"))
        user = result.scalar_one_or_none()

        if not user:
            # Try to get any existing user first
            result2 = await db.execute(select(User).limit(1))
            existing_user = result2.scalar_one_or_none()

            if existing_user:
                user_id = existing_user.id
                logger.info(f"Using existing user: {user_id}")
            else:
                # Create new default user (username=None to avoid unique constraint)
                try:
                    user = User(
                        email="default@hyperagent.local",
                        username=None,  # Nullable field - avoids unique constraint conflict
                        is_active=True,
                    )
                    db.add(user)
                    await db.flush()  # Flush to get ID in same transaction
                    user_id = user.id
                    logger.info(f"Creating default user: {user_id}")
                except IntegrityError as e:
                    # Handle any remaining constraint violations
                    await db.rollback()
                    logger.warning(
                        f"User creation constraint error: {e}, retrying with existing user"
                    )
                    # Retry: get any existing user
                    result3 = await db.execute(select(User).limit(1))
                    fallback_user = result3.scalar_one_or_none()
                    if fallback_user:
                        user_id = fallback_user.id
                        logger.info(f"Using fallback user: {user_id}")
                    else:
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Failed to create or retrieve user",
                        )
        else:
            user_id = user.id
            logger.info(f"Using existing default user: {user_id}")

        # Validate requested features against network capabilities
        from hyperagent.blockchain.network_features import NetworkFeature, NetworkFeatureManager

        warnings = []
        features_used = {}

        # Check PEF availability (for batch deployments - not in this endpoint but for future)
        # Note: PEF is checked in deployment_service.deploy_batch()

        # Check MetisVM availability
        if request.optimize_for_metisvm:
            if NetworkFeatureManager.supports_feature(request.network, NetworkFeature.METISVM):
                features_used["metisvm"] = True
            else:
                warnings.append(
                    f"MetisVM optimization not available for {request.network}, "
                    f"continuing without optimization"
                )
                features_used["metisvm"] = False
                # Auto-disable incompatible feature
                request.optimize_for_metisvm = False
        else:
            features_used["metisvm"] = False

        # Check floating-point availability
        if request.enable_floating_point:
            if NetworkFeatureManager.supports_feature(
                request.network, NetworkFeature.FLOATING_POINT
            ):
                features_used["floating_point"] = True
            else:
                warnings.append(
                    f"Floating-point operations not available for {request.network}, "
                    f"continuing without floating-point support"
                )
                features_used["floating_point"] = False
                request.enable_floating_point = False
        else:
            features_used["floating_point"] = False

        # Check AI inference availability
        if request.enable_ai_inference:
            if NetworkFeatureManager.supports_feature(request.network, NetworkFeature.AI_INFERENCE):
                features_used["ai_inference"] = True
            else:
                warnings.append(
                    f"AI inference not available for {request.network}, "
                    f"continuing without AI inference support"
                )
                features_used["ai_inference"] = False
                request.enable_ai_inference = False
        else:
            features_used["ai_inference"] = False

        # Check EigenDA availability (for deployment - informational)
        features_used["eigenda"] = NetworkFeatureManager.supports_feature(
            request.network, NetworkFeature.EIGENDA
        )

        # Log warnings
        for warning in warnings:
            logger.warning(warning)

        # Generate workflow ID
        workflow_id = uuid.uuid4()

        # Create workflow record
        workflow = Workflow(
            id=workflow_id,
            user_id=user_id,
            name=request.name
            or f"Contract Generation - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            description=request.nlp_input[:MAX_DESCRIPTION_LENGTH],
            nlp_input=request.nlp_input,
            network=request.network,
            is_testnet=True,  # Default to testnet
            status=WorkflowStatus.CREATED.value,
            progress_percentage=0,
        )
        
        # Store selected_tasks and cost_breakdown in workflow metadata if available
        if hasattr(workflow, "meta_data"):
            if workflow.meta_data is None:
                workflow.meta_data = {}
            workflow.meta_data["selected_tasks"] = selected_tasks
            workflow.meta_data["cost_breakdown"] = cost_breakdown

        db.add(workflow)
        await db.commit()  # Commit both user and workflow together
        await db.refresh(workflow)

        logger.info(f"Created workflow {workflow_id} for network {request.network}")

        # Initialize event bus and coordinator
        # Redis is optional - EventBus has in-memory fallback
        redis_client = None
        if settings.redis_url:
            try:
                redis_client = redis.from_url(settings.redis_url, decode_responses=False)
            except Exception as e:
                logger.warning(f"Failed to connect to Redis: {e} - using in-memory fallback")
        event_bus = EventBus(redis_client)

        # Initialize coordinator (would need proper service injection)
        # For now, just publish workflow created event
        from hyperagent.events.event_types import Event, EventType

        await event_bus.publish(
            Event(
                id=str(uuid.uuid4()),
                type=EventType.WORKFLOW_CREATED,
                workflow_id=str(workflow_id),
                timestamp=datetime.now(),
                data={
                    "nlp_input": request.nlp_input,
                    "network": request.network,
                    "contract_type": request.contract_type,
                    "skip_audit": request.skip_audit,
                    "skip_deployment": request.skip_deployment,
                    "optimize_for_metisvm": request.optimize_for_metisvm,
                    "enable_floating_point": request.enable_floating_point,
                    "enable_ai_inference": request.enable_ai_inference,
                },
                source_agent="api",
            )
        )

        # Execute workflow in background task (create new DB session)
        asyncio.create_task(
            execute_workflow_background(
                workflow_id=str(workflow_id),
                nlp_input=request.nlp_input,
                network=request.network,
                optimize_for_metisvm=request.optimize_for_metisvm,
                enable_floating_point=request.enable_floating_point,
                enable_ai_inference=request.enable_ai_inference,
                skip_audit=request.skip_audit,  # Keep for backward compatibility
                skip_deployment=request.skip_deployment,  # Keep for backward compatibility
                wallet_address=request.wallet_address,  # REQUIRED: Pass wallet address
                use_gasless=request.use_gasless or False,  # Pass gasless option
                signed_transaction=request.signed_transaction,  # Pass signed transaction if provided
                selected_tasks=selected_tasks,  # NEW: Pass selected tasks
            )
        )

        response_data = {
            "workflow_id": str(workflow_id),
            "status": WorkflowStatus.CREATED.value,
            "message": "Workflow created successfully",
        }

        # Include warnings and features_used in response if there are warnings
        if warnings:
            response_data["warnings"] = warnings
            response_data["features_used"] = features_used

        return WorkflowResponse(**response_data)

    except Exception as e:
        logger.error(f"Failed to create workflow: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create workflow: {str(e)}",
        )


@router.get("")
async def list_workflows(
    status: Optional[str] = None,
    limit: int = DEFAULT_PAGE_LIMIT,
    network: Optional[str] = None,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """
    List all workflows with optional filtering

    Args:
        status: Filter by workflow status
        network: Filter by network
        limit: Maximum number of workflows to return
        offset: Number of workflows to skip
        db: Database session

    Returns:
        List of workflows
    """
    try:
        stmt = select(Workflow)

        if status:
            stmt = stmt.where(Workflow.status == status)
        if network:
            stmt = stmt.where(Workflow.network == network)

        stmt = stmt.order_by(Workflow.created_at.desc()).limit(limit).offset(offset)

        result = await db.execute(stmt)
        workflows = result.scalars().all()

        from hyperagent.models.contract import GeneratedContract

        workflow_list = []
        for workflow in workflows:
            # Get contract count
            contracts_result = await db.execute(
                select(GeneratedContract).where(GeneratedContract.workflow_id == workflow.id)
            )
            contracts = contracts_result.scalars().all()

            # Extract contract_type from first contract or use default
            contract_type = "Custom"
            if contracts:
                contract_type = contracts[0].contract_type or "Custom"
            elif workflow.meta_data and isinstance(workflow.meta_data, dict):
                contract_type = workflow.meta_data.get("contract_type", "Custom")

            workflow_list.append(
                {
                    "workflow_id": str(workflow.id),
                    "status": workflow.status,
                    "progress_percentage": workflow.progress_percentage,
                    "network": workflow.network,
                    "contract_type": contract_type,
                    "name": workflow.name,
                    "created_at": workflow.created_at.isoformat() if workflow.created_at else None,
                    "updated_at": workflow.updated_at.isoformat() if workflow.updated_at else None,
                    "completed_at": (
                        workflow.completed_at.isoformat() if workflow.completed_at else None
                    ),
                    "error_message": workflow.error_message,
                    "contracts": [
                        {
                            "id": str(c.id),
                            "contract_name": c.contract_name,
                            "contract_type": c.contract_type,
                        }
                        for c in contracts
                    ],
                }
            )

        return workflow_list
    except Exception as e:
        logger.error(f"Failed to list workflows: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list workflows: {str(e)}",
        )


@router.get("/{workflow_id}")
async def get_workflow_status(workflow_id: str, db: AsyncSession = Depends(get_db)):
    """
    Get workflow status

    Concept: Retrieve workflow status and progress from database
    Logic:
        1. Query database for workflow
        2. Return status, progress, and metadata

    Args:
        workflow_id: Workflow identifier
        db: Database session

    Returns:
        Workflow status and progress information
    """
    try:
        # Query workflow
        result = await db.execute(select(Workflow).where(Workflow.id == uuid.UUID(workflow_id)))
        workflow = result.scalar_one_or_none()

        if not workflow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Workflow {workflow_id} not found"
            )

        # Query contracts and deployments
        from hyperagent.models.contract import GeneratedContract
        from hyperagent.models.deployment import Deployment

        contracts_result = await db.execute(
            select(GeneratedContract).where(GeneratedContract.workflow_id == uuid.UUID(workflow_id))
        )
        contracts = contracts_result.scalars().all()

        # Get deployments through contracts
        deployments = []
        for contract in contracts:
            deployments_result = await db.execute(
                select(Deployment).where(Deployment.contract_id == contract.id)
            )
            contract_deployments = deployments_result.scalars().all()
            deployments.extend(contract_deployments)

        # Extract contract_type from first contract or use default
        contract_type = "Custom"
        if contracts:
            contract_type = contracts[0].contract_type or "Custom"
        elif workflow.meta_data and isinstance(workflow.meta_data, dict):
            contract_type = workflow.meta_data.get("contract_type", "Custom")

        return {
            "workflow_id": str(workflow.id),
            "status": workflow.status,
            "progress_percentage": workflow.progress_percentage,
            "network": workflow.network,
            "contract_type": contract_type,
            "name": workflow.name,
            "created_at": workflow.created_at.isoformat() if workflow.created_at else None,
            "updated_at": workflow.updated_at.isoformat() if workflow.updated_at else None,
            "completed_at": workflow.completed_at.isoformat() if workflow.completed_at else None,
            "error_message": workflow.error_message,
            "retry_count": workflow.retry_count,
            "metadata": dict(workflow.meta_data) if workflow.meta_data else {},
            "contracts": [
                {
                    "id": str(c.id),
                    "contract_name": c.contract_name,
                    "contract_type": c.contract_type,
                    "solidity_version": c.solidity_version,
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                }
                for c in contracts
            ],
            "deployments": [
                {
                    "id": str(d.id),
                    "contract_address": d.contract_address,
                    "transaction_hash": d.transaction_hash,
                    "block_number": d.block_number,
                    "gas_used": d.gas_used,
                    "deployed_at": d.deployed_at.isoformat() if d.deployed_at else None,
                }
                for d in deployments
            ],
        }

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid workflow ID format"
        )
    except Exception as e:
        logger.error(f"Failed to get workflow status: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve workflow: {str(e)}",
        )


@router.get("/{workflow_id}/contracts")
async def get_workflow_contracts(workflow_id: str, db: AsyncSession = Depends(get_db)):
    """
    Get all contracts generated for a workflow

    Concept: Retrieve contract source code, bytecode, and ABI
    Logic:
        1. Query GeneratedContract table filtered by workflow_id
        2. Return contract details including source_code, bytecode, abi

    Args:
        workflow_id: Workflow identifier
        db: Database session

    Returns:
        List of contracts with full details
    """
    try:
        from hyperagent.models.contract import GeneratedContract

        # Query contracts
        result = await db.execute(
            select(GeneratedContract).where(GeneratedContract.workflow_id == uuid.UUID(workflow_id))
        )
        contracts = result.scalars().all()

        if not contracts:
            return {"workflow_id": workflow_id, "contracts": []}

        return {
            "workflow_id": workflow_id,
            "contracts": [
                {
                    "id": str(c.id),
                    "contract_name": c.contract_name,
                    "contract_type": c.contract_type,
                    "solidity_version": c.solidity_version,
                    "source_code": c.source_code,
                    "bytecode": c.bytecode,
                    "abi": c.abi,
                    "deployed_bytecode": c.deployed_bytecode,
                    "source_code_hash": c.source_code_hash,
                    "line_count": c.line_count,
                    "function_count": c.function_count,
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                }
                for c in contracts
            ],
        }

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid workflow ID format"
        )
    except Exception as e:
        logger.error(f"Failed to get workflow contracts: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve contracts: {str(e)}",
        )


@router.get("/{workflow_id}/deployments")
async def get_workflow_deployments(workflow_id: str, db: AsyncSession = Depends(get_db)):
    """
    Get deployment information for a workflow

    Concept: Retrieve on-chain deployment details
    Logic:
        1. Query contracts for workflow
        2. Query deployments for each contract
        3. Return deployment addresses, transaction hashes, gas costs

    Args:
        workflow_id: Workflow identifier
        db: Database session

    Returns:
        List of deployments with on-chain information
    """
    try:
        from hyperagent.models.contract import GeneratedContract
        from hyperagent.models.deployment import Deployment

        # Query contracts for workflow
        contracts_result = await db.execute(
            select(GeneratedContract).where(GeneratedContract.workflow_id == uuid.UUID(workflow_id))
        )
        contracts = contracts_result.scalars().all()

        if not contracts:
            return {"workflow_id": workflow_id, "deployments": []}

        # Get deployments for all contracts
        deployments = []
        for contract in contracts:
            deployments_result = await db.execute(
                select(Deployment).where(Deployment.contract_id == contract.id)
            )
            contract_deployments = deployments_result.scalars().all()
            deployments.extend(contract_deployments)

        return {
            "workflow_id": workflow_id,
            "deployments": [
                {
                    "id": str(d.id),
                    "contract_address": d.contract_address,
                    "deployer_address": d.deployer_address,
                    "transaction_hash": d.transaction_hash,
                    "block_number": d.block_number,
                    "gas_used": d.gas_used,
                    "gas_price": d.gas_price,
                    "total_cost_wei": d.total_cost_wei,
                    "deployment_status": d.deployment_status,
                    "confirmation_blocks": d.confirmation_blocks,
                    "deployed_at": d.deployed_at.isoformat() if d.deployed_at else None,
                    "confirmed_at": d.confirmed_at.isoformat() if d.confirmed_at else None,
                    "eigenda_commitment": d.eigenda_commitment,
                    "deployment_network": d.deployment_network,
                    "is_testnet": d.is_testnet,
                }
                for d in deployments
            ],
        }

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid workflow ID format"
        )
    except Exception as e:
        logger.error(f"Failed to get workflow deployments: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve deployments: {str(e)}",
        )


@router.get("/{workflow_id}/test-results")
async def get_workflow_test_results(workflow_id: str, db: AsyncSession = Depends(get_db)):
    """
    Get test results for a workflow

    Concept: Retrieve test execution results and coverage
    Logic:
        1. Query contracts for workflow
        2. Extract test results from contract metadata or workflow metadata
        3. Return test results with coverage information

    Args:
        workflow_id: Workflow identifier
        db: Database session

    Returns:
        Test results including test cases, coverage, and execution details
    """
    try:
        from hyperagent.models.contract import GeneratedContract

        # Query contracts for workflow
        contracts_result = await db.execute(
            select(GeneratedContract).where(GeneratedContract.workflow_id == uuid.UUID(workflow_id))
        )
        contracts = contracts_result.scalars().all()

        if not contracts:
            return {
                "workflow_id": workflow_id,
                "test_results": None,
                "message": "No contracts found for this workflow",
            }

        # Get test results from workflow metadata or contract metadata
        workflow_result = await db.execute(
            select(Workflow).where(Workflow.id == uuid.UUID(workflow_id))
        )
        workflow = workflow_result.scalar_one_or_none()

        if not workflow:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")

        # Test results are stored in workflow metadata
        metadata = workflow.meta_data or {}
        test_results = metadata.get("test_results")

        if not test_results:
            return {
                "workflow_id": workflow_id,
                "test_results": None,
                "message": "Test results not available. Tests may not have been executed yet.",
            }

        return {
            "workflow_id": workflow_id,
            "test_results": test_results,
            "test_framework": test_results.get("test_framework", "unknown"),
            "total_tests": test_results.get("total_tests", 0),
            "passed": test_results.get("passed", 0),
            "failed": test_results.get("failed", 0),
            "skipped": test_results.get("skipped", 0),
            "coverage": test_results.get("coverage"),
            "test_cases": test_results.get("test_cases", []),
        }

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid workflow ID format"
        )
    except Exception as e:
        logger.error(f"Failed to get test results: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve test results: {str(e)}",
        )


@router.post("/{workflow_id}/cancel")
async def cancel_workflow(workflow_id: str, db: AsyncSession = Depends(get_db)):
    """
    Cancel a running workflow

    Concept: Mark workflow as cancelled and stop execution
    Logic:
        1. Find workflow in database
        2. Update status to CANCELLED
        3. Publish cancellation event
    """
    try:
        result = await db.execute(select(Workflow).where(Workflow.id == uuid.UUID(workflow_id)))
        workflow = result.scalar_one_or_none()

        if not workflow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=f"Workflow {workflow_id} not found"
            )

        # Update status
        workflow.status = WorkflowStatus.CANCELLED.value
        workflow.updated_at = datetime.now()

        await db.commit()

        # Publish cancellation event
        # Redis is optional - EventBus has in-memory fallback
        redis_client = None
        if settings.redis_url:
            try:
                redis_client = redis.from_url(settings.redis_url, decode_responses=False)
            except Exception as e:
                logger.warning(f"Failed to connect to Redis: {e} - using in-memory fallback")
        event_bus = EventBus(redis_client)
        from hyperagent.events.event_types import Event, EventType

        await event_bus.publish(
            Event(
                id=str(uuid.uuid4()),
                type=EventType.WORKFLOW_CANCELLED,
                workflow_id=workflow_id,
                timestamp=datetime.now(),
                data={"message": "Workflow cancelled by user"},
                source_agent="api",
            )
        )

        return {
            "workflow_id": workflow_id,
            "status": "cancelled",
            "message": "Workflow cancelled successfully",
        }

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid workflow ID format"
        )
    except Exception as e:
        logger.error(f"Failed to cancel workflow: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel workflow: {str(e)}",
        )
