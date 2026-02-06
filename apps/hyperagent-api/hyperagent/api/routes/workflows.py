"""Workflow API routes"""

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import redis.asyncio as redis
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

# DEPRECATED: Use TestingService directly instead
# from hyperagent.agents.testing import TestingAgent
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
from hyperagent.rag.vector_store import VectorStore
from hyperagent.security.audit import SecurityAuditor

logger = logging.getLogger(__name__)

MAX_DESCRIPTION_LENGTH = 200
DEFAULT_PAGE_LIMIT = 100


async def get_or_create_default_user(db: AsyncSession) -> uuid.UUID:
    """
    Get or create default user for workflows
    
    WARNING: This creates a shared default user account for all requests.
    This is suitable for:
    - Development/demo environments
    - Single-user deployments
    - Testing purposes
    
    For production with multiple users:
    - Enable authentication (set ENABLE_AUTHENTICATION=true)
    - Use proper user authentication via /api/v1/auth/login
    - Pass user_id from authenticated request context
    
    See: hyperagent/api/middleware/auth.py for auth implementation
    """
    # Check if authentication is enabled
    if settings.enable_authentication:
        logger.warning(
            "Default user creation called but authentication is enabled. "
            "This should not happen in production. Use authenticated user context instead."
        )
    
    result = await db.execute(select(User).where(User.email == "default@hyperagent.local"))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email="default@hyperagent.local",
            username="Demo User",
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        logger.info(
            f"Created default user: {user.id} "
            "(Authentication disabled - development mode)"
        )
    else:
        logger.debug(f"Using existing default user: {user.id}")

    return user.id


async def safe_execute_workflow_background(
    workflow_id: str,
    nlp_input: str,
    network: str,
    skip_audit: bool,
    skip_deployment: bool,
    wallet_address: Optional[str] = None,
    use_gasless: Optional[bool] = None,
    signed_transaction: Optional[str] = None,
    selected_tasks: Optional[List[str]] = None,
    db_session = None,  # Database session for learning system
):
    """
    Safety wrapper for workflow execution with overall timeout and comprehensive error handling
    
    This wrapper ensures:
    1. Overall workflow timeout (5 minutes max)
    2. Workflow status is always updated even if task crashes
    3. All exceptions are caught and logged
    """
    from hyperagent.db.session import AsyncSessionLocal
    
    async with AsyncSessionLocal() as db:
        try:
            # Wrap entire execution in timeout
            result = await asyncio.wait_for(
                execute_workflow_background(
                    workflow_id=workflow_id,
                    nlp_input=nlp_input,
                    network=network,
                    skip_audit=skip_audit,
                    skip_deployment=skip_deployment,
                    wallet_address=wallet_address,
                    use_gasless=use_gasless,
                    signed_transaction=signed_transaction,
                    selected_tasks=selected_tasks,
                    db_session=db,  # Pass db session for learning
                ),
                timeout=settings.workflow_execution_timeout_seconds,
            )
            return result
        except asyncio.TimeoutError:
            logger.error(
                f"Workflow {workflow_id} timed out after {settings.workflow_execution_timeout_seconds} seconds"
            )
            # Mark workflow as failed due to timeout (use existing db session)
            try:
                workflow_result = await db.execute(
                    select(Workflow).where(Workflow.id == uuid.UUID(workflow_id))
                )
                workflow = workflow_result.scalar_one_or_none()
                if workflow:
                    workflow.status = WorkflowStatus.FAILED.value
                    workflow.error_message = (
                        f"Workflow execution timed out after {settings.workflow_execution_timeout_seconds} seconds. "
                        "This may indicate a network issue or service unavailability."
                    )
                    workflow.updated_at = datetime.now()
                    await db.commit()
                    logger.info(f"Marked workflow {workflow_id} as failed due to timeout")
                    
                    # Learn from timeout failure
                    try:
                        from hyperagent.core.learning.workflow_learner import WorkflowLearner
                        workflow_learner = WorkflowLearner(db)
                        meta_data = workflow.meta_data or {}
                        contract_type = meta_data.get("contract_type", "Custom")
                        await workflow_learner.learn_from_workflow(
                            workflow_id=workflow_id,
                            success=False,
                            execution_time=settings.workflow_execution_timeout_seconds,
                            stages_completed=meta_data.get("stages_completed", []),
                            error_message=workflow.error_message,
                            contract_type=contract_type,
                            network=network,
                        )
                    except Exception as learn_error:
                        logger.warning(f"Failed to learn from timeout: {learn_error}")
            except Exception as db_error:
                logger.error(f"Failed to update workflow status after timeout: {db_error}")
        except Exception as e:
            logger.error(f"Workflow background task failed with unhandled exception: {e}", exc_info=True)
            # Update workflow status even if task crashes (use existing db session)
            try:
                workflow_result = await db.execute(
                    select(Workflow).where(Workflow.id == uuid.UUID(workflow_id))
                )
                workflow = workflow_result.scalar_one_or_none()
                if workflow:
                    workflow.status = WorkflowStatus.FAILED.value
                    error_msg = str(e)
                    if hasattr(e, 'message'):
                        error_msg = e.message
                    workflow.error_message = f"Background task failed: {error_msg}"
                    workflow.updated_at = datetime.now()
                    await db.commit()
                    logger.info(f"Marked workflow {workflow_id} as failed after background task crash")
                    
                    # Learn from failure
                    try:
                        from hyperagent.core.learning.workflow_learner import WorkflowLearner
                        workflow_learner = WorkflowLearner(db)
                        meta_data = workflow.meta_data or {}
                        contract_type = meta_data.get("contract_type", "Custom")
                        await workflow_learner.learn_from_workflow(
                            workflow_id=workflow_id,
                            success=False,
                            execution_time=0.0,
                            stages_completed=meta_data.get("stages_completed", []),
                            error_message=workflow.error_message,
                            contract_type=contract_type,
                            network=network,
                        )
                    except Exception as learn_error:
                        logger.warning(f"Failed to learn from failure: {learn_error}")
            except Exception as db_error:
                logger.error(f"Failed to update workflow after background task crash: {db_error}")


async def execute_workflow_background(
    workflow_id: str,
    nlp_input: str,
    network: str,
    skip_audit: bool,
    skip_deployment: bool,
    wallet_address: Optional[str] = None,  # User wallet address (required for deployment)
    use_gasless: Optional[bool] = None,  # Auto-determined based on x402 network if None
    signed_transaction: Optional[str] = None,  # Pre-signed transaction (optional)
    selected_tasks: Optional[List[str]] = None,  # NEW: Selected tasks to execute
    db_session = None,  # Database session for learning system
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
            # Update workflow status to generating (with timestamp for timeout detection)
            workflow_result = await db.execute(
                select(Workflow).where(Workflow.id == uuid.UUID(workflow_id))
            )
            workflow = workflow_result.scalar_one_or_none()
            if workflow:
                workflow.status = WorkflowStatus.GENERATING.value
                workflow.progress_percentage = 10
                workflow.updated_at = datetime.now()  # Update timestamp for timeout detection
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

            # Re-enable template retriever with error handling for embedding failures
            try:
                template_retriever = TemplateRetriever(llm_provider, db)
                logger.info("Template retriever enabled for RAG")
            except Exception as e:
                logger.warning(f"Failed to initialize template retriever: {e}. Continuing without RAG.")
                template_retriever = None

            network_manager = NetworkManager()
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
                "testing", TestingService(event_bus=event_bus, llm_provider=llm_provider)
            )
            service_registry.register(
                "deployment", DeploymentService(network_manager, eigenda_client)
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
                llm_provider=llm_provider,
            )

            # Convert skip flags to selected_tasks if selected_tasks not provided (backward compatibility)
            # Deployment is now MANDATORY - all workflows must complete deployment
            workflow_selected_tasks = selected_tasks
            if workflow_selected_tasks is None:
                workflow_selected_tasks = ["generation", "compilation", "audit", "testing", "deployment"]
                logger.info(f"Using default mandatory tasks: {workflow_selected_tasks}")
            else:
                # Ensure deployment is always included if other tasks are selected
                if any(task in workflow_selected_tasks for task in ["generation", "compilation", "audit", "testing"]):
                    if "deployment" not in workflow_selected_tasks:
                        workflow_selected_tasks.append("deployment")
                        logger.info(f"Added mandatory deployment task: {workflow_selected_tasks}")
            
            # Validate wallet_address is provided for deployment
            if "deployment" in workflow_selected_tasks and not wallet_address:
                raise ValueError(
                    "wallet_address is required for deployment. Please connect your wallet in the frontend."
                )

            # Automatically determine gasless deployment if not explicitly set
            # Gasless is automatically enabled for x402 networks (sponsored by paymaster)
            final_use_gasless = use_gasless
            if final_use_gasless is None or final_use_gasless is False:
                if "deployment" in workflow_selected_tasks:
                    from hyperagent.blockchain.network_features import NetworkFeatureManager
                    
                    is_x402_network = NetworkFeatureManager.is_x402_network(
                        network, settings.x402_enabled, settings.x402_enabled_networks
                    )
                    if is_x402_network:
                        final_use_gasless = True
                        logger.info(
                            f"Automatically enabling gasless deployment for x402 network {network}. "
                            f"Gas fees will be sponsored by paymaster."
                        )

            # Execute workflow with wallet information and db session for learning
            result = await coordinator.execute_workflow(
                workflow_id=workflow_id,
                nlp_input=nlp_input,
                network=network,
                wallet_address=wallet_address,  # REQUIRED: Pass wallet address
                use_gasless=final_use_gasless or False,  # Auto-determined or explicit
                signed_transaction=signed_transaction,  # Pass signed transaction if provided
                selected_tasks=workflow_selected_tasks,  # NEW: Pass selected tasks
                db_session=db,  # Pass db session for learning system
            )

            # Handle clarification needed status
            if result.get("status") == "clarification_needed":
                # Update workflow status to clarification_needed
                workflow_result = await db.execute(
                    select(Workflow).where(Workflow.id == uuid.UUID(workflow_id))
                )
                workflow = workflow_result.scalar_one_or_none()
                if workflow:
                    workflow.status = "clarification_needed"
                    if workflow.meta_data is None:
                        workflow.meta_data = {}
                    workflow.meta_data["clarification_questions"] = result.get("questions", [])
                    workflow.meta_data["original_prompt"] = result.get("original_prompt", nlp_input)
                    await db.commit()
                logger.info(f"Workflow {workflow_id} requires clarification")
                return  # Exit early, don't persist contracts

            # Get workflow object for learning loop (needed for nlp_input and network)
            workflow_result = await db.execute(
                select(Workflow).where(Workflow.id == uuid.UUID(workflow_id))
            )
            workflow = workflow_result.scalar_one_or_none()

            # Update workflow status and persist contracts
            await update_workflow_and_persist_contracts(
                workflow_id=workflow_id,
                result=result,
                db=db,
                vector_store=vector_store,
                generation_service=service_registry.get_service("generation"),
                workflow=workflow,
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
                    # Preserve full error message for HyperAgentError exceptions
                    if hasattr(e, 'message'):
                        error_msg = e.message
                    else:
                        error_msg = str(e)
                    
                    # If error message contains "failed:" prefix, extract the actual error message
                    # This handles cases where SOA orchestrator wraps errors: "deployment failed: <actual error>"
                    if " failed: " in error_msg:
                        # Split on " failed: " and take everything after it
                        parts = error_msg.split(" failed: ", 1)
                        if len(parts) > 1:
                            # Use the actual error message (part after "failed: ")
                            error_msg = parts[1]
                    
                    workflow.error_message = error_msg
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
    workflow_id: str,
    result: Dict[str, Any],
    db: AsyncSession,
    vector_store: Optional[VectorStore] = None,
    generation_service: Optional[GenerationService] = None,
    workflow: Optional[Workflow] = None,
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
        # Use passed workflow object or retrieve if not provided (backward compatibility)
        if not workflow:
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

            # Initialize meta_data if not exists (will be set in learning loop)
            if generated_contract.meta_data is None:
                generated_contract.meta_data = {}

            # Learning Loop: Store successful contracts for future RAG
            try:
                contract_type = workflow_result_data.get("contract_type", "Custom")
                
                # 1. Store to IPFS (Pinata)
                if settings.pinata_jwt and settings.enable_ipfs_upload:
                    try:
                        from hyperagent.rag.pinata_manager import PinataManager
                        pinata = PinataManager(settings.pinata_jwt, settings.pinata_gateway)
                        ipfs_result = await pinata.upload_template_with_metadata(
                            name=f"{contract_name}.sol",
                            content=contract_code,
                            metadata={
                                "workflow_id": str(workflow_id),
                                "contract_type": contract_type,
                                "network": workflow.network if workflow else "",
                                "audit_passed": workflow_result_data.get("audit", {}).get("passed", False),
                                "contract_name": contract_name,
                            }
                        )
                        # Store IPFS hash in contract metadata
                        generated_contract.meta_data["ipfs_hash"] = ipfs_result["ipfs_hash"]
                        generated_contract.meta_data["ipfs_url"] = ipfs_result["pinata_url"]
                        logger.info(f"Stored contract to IPFS: {ipfs_result['ipfs_hash']}")
                    except Exception as e:
                        logger.warning(f"IPFS storage failed (non-critical): {e}")
                
                # 2. Store to VectorStore (for RAG retrieval)
                if vector_store:
                    try:
                        await vector_store.store_contract(
                            contract_code=contract_code,
                            contract_type=contract_type,
                            metadata={
                                "workflow_id": str(workflow_id),
                                "contract_name": contract_name,
                                "network": workflow.network if workflow else "",
                                "nlp_input": (workflow.nlp_input[:200] if workflow and workflow.nlp_input else ""),
                            }
                        )
                        logger.info(f"Stored contract to VectorStore for RAG")
                    except Exception as e:
                        logger.warning(f"VectorStore storage failed (non-critical): {e}")
                
                # 3. Store to Acontext (if enabled)
                if generation_service and generation_service.acontext and generation_service.acontext.enabled:
                    try:
                        audit_issues = workflow_result_data.get("audit", {}).get("findings", [])
                        nlp_input = workflow.nlp_input if workflow else ""
                        await generation_service.acontext.store_contract(
                            contract_code=contract_code,
                            contract_type=contract_type,
                            requirements=nlp_input,
                            audit_issues=audit_issues,
                            metadata={
                                "network": workflow.network if workflow else "",
                                "workflow_id": str(workflow_id),
                                "contract_name": contract_name,
                            }
                        )
                        logger.info(f"Stored contract to Acontext for learning")
                    except Exception as e:
                        logger.warning(f"Acontext storage failed (non-critical): {e}")
                        
            except Exception as e:
                logger.warning(f"Learning loop storage failed (non-critical): {e}")
                # Don't fail workflow if storage fails

            # Commit database after learning loop updates meta_data
            await db.commit()
            await db.refresh(generated_contract)

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
        deployment_pending = deployment_status == "pending_signature" or deployment_status == "pending"

        if deployment_successful or result.get("status") == "success":
            workflow.status = WorkflowStatus.COMPLETED.value
            workflow.progress_percentage = 100
            logger.info(f"Workflow {workflow_id} marked as completed (deployment successful)")
        elif deployment_pending:
            # Deployment is pending user signature - workflow is NOT complete until deployment succeeds
            # Keep workflow in processing state until user signs and deployment completes
            workflow.status = WorkflowStatus.DEPLOYING.value if hasattr(WorkflowStatus, "DEPLOYING") else WorkflowStatus.PROCESSING.value
            workflow.progress_percentage = 90  # Almost done, waiting for signature

            # Store deployment status in metadata
            if workflow.meta_data is None:
                workflow.meta_data = {}
            workflow.meta_data["deployment_status"] = "pending_signature"
            workflow.meta_data["requires_user_signature"] = True
            workflow.meta_data["deployment_message"] = deployment_result_data.get(
                "message", "Deployment requires user wallet signature. Please sign the transaction in your wallet."
            )
            workflow.meta_data["wallet_address"] = deployment_result_data.get("wallet_address")

            logger.info(
                f"Workflow {workflow_id} waiting for user signature - deployment pending for {deployment_result_data.get('wallet_address')}"
            )
        else:
            # Check if deployment is pending signature (not a failure, just waiting for user)
            deployment_result_data = (
                workflow_result_data.get("deployment")
                or workflow_result_data.get("deployment_result")
                or {}
            )
            deployment_status = deployment_result_data.get("status")
            
            if deployment_status == "pending_signature" or deployment_status == "pending":
                # Deployment is pending user signature - not a failure
                workflow.status = WorkflowStatus.DEPLOYING.value if hasattr(WorkflowStatus, "DEPLOYING") else WorkflowStatus.PROCESSING.value
                workflow.progress_percentage = 90
                
                # Store deployment status in metadata
                if workflow.meta_data is None:
                    workflow.meta_data = {}
                workflow.meta_data["deployment_status"] = "pending_signature"
                workflow.meta_data["requires_user_signature"] = True
                workflow.meta_data["deployment_message"] = deployment_result_data.get(
                    "message", "Deployment requires user wallet signature. Please sign the transaction in your wallet."
                )
                workflow.meta_data["wallet_address"] = deployment_result_data.get("wallet_address")
                
                logger.info(
                    f"Workflow {workflow_id} waiting for user signature - deployment pending"
                )
            else:
                # Actual failure
                workflow.status = WorkflowStatus.FAILED.value
                # Extract detailed error message from result
                error_message = result.get("error") or result.get("error_message") or "Unknown error"
                
                # Determine which stage failed based on progress and available results
                # This ensures we extract the correct error from the right stage
                progress = workflow.progress_percentage or 0
                
                # If error message contains "Cannot proceed with deployment" but progress is low,
                # this is a validation error from DeploymentService prerequisites check
                # Don't check deployment_result - the error is already in error_message
                is_validation_error = "Cannot proceed with deployment" in error_message and progress <= 80
                
                # Try to extract error from stage results based on progress
                # Skip if we already have a validation error (it's already the correct error)
                if (not error_message or error_message == "Unknown error") and not is_validation_error:
                    # Check generation result for errors (0-20% progress)
                    if progress <= 20:
                        generation_result = workflow_result_data.get("generation_result")
                        if generation_result and isinstance(generation_result, dict):
                            gen_error = generation_result.get("error")
                            if gen_error:
                                error_message = f"Generation failed: {gen_error}"
                    
                    # Check compilation result for errors (20-40% progress)
                    elif progress <= 40:
                        compilation_result = workflow_result_data.get("compilation_result")
                        if compilation_result and isinstance(compilation_result, dict):
                            comp_error = compilation_result.get("error")
                            if comp_error:
                                error_message = f"Compilation failed: {comp_error}"
                            else:
                                error_message = compilation_result.get("error") or error_message
                    
                    # Check audit result for errors (40-60% progress)
                    elif progress <= 60:
                        audit_result = workflow_result_data.get("audit_result")
                        if audit_result and isinstance(audit_result, dict):
                            audit_error = audit_result.get("error")
                            if audit_error:
                                error_message = f"Audit failed: {audit_error}"
                    
                    # Check testing result for errors (60-80% progress)
                    elif progress <= 80:
                        test_result = workflow_result_data.get("test_result")
                        if test_result and isinstance(test_result, dict):
                            test_error = test_result.get("error")
                            if test_error:
                                error_message = f"Testing failed: {test_error}"
                    
                    # Check deployment result for errors (80-100% progress)
                    else:
                        deployment_result = workflow_result_data.get("deployment_result")
                        if deployment_result and isinstance(deployment_result, dict):
                            deploy_error = deployment_result.get("error")
                            if deploy_error:
                                # Don't prefix if error already contains "Deployment failed" or "Cannot proceed"
                                if "Deployment failed" in deploy_error or "Cannot proceed" in deploy_error:
                                    error_message = deploy_error
                                else:
                                    error_message = f"Deployment failed: {deploy_error}"
                
                # If error message contains "Cannot proceed with deployment" but progress is low,
                # this is a validation error from DeploymentService prerequisites check, not an actual deployment failure
                # The error should be attributed to the stage that's actually missing (generation/compilation/audit/testing)
                if "Cannot proceed with deployment" in error_message and progress <= 80:
                    # Remove "Deployment failed:" prefix if present (it's misleading for validation errors)
                    if error_message.startswith("Deployment failed: "):
                        error_message = error_message.replace("Deployment failed: ", "", 1)
                    
                    # Extract which stage is actually missing from the error message
                    # This helps with stage status calculation
                    if "Generation stage not completed" in error_message or "Contract code is missing" in error_message:
                        # Error is about missing generation, ensure progress reflects this
                        if progress == 0 or progress is None:
                            progress = 20
                    elif "Compilation stage not completed" in error_message or "bytecode" in error_message.lower() or "abi" in error_message.lower():
                        # Error is about missing compilation, ensure progress reflects this
                        if progress <= 20:
                            progress = 40
                    elif "Audit stage" in error_message:
                        # Error is about missing audit, ensure progress reflects this
                        if progress <= 40:
                            progress = 60
                    elif "Testing stage" in error_message:
                        # Error is about missing testing, ensure progress reflects this
                        if progress <= 60:
                            progress = 80
                    elif "Wallet address is required" in error_message:
                        # This is a deployment prerequisite, but workflow failed before deployment
                        # Keep the error as-is, but don't mark deployment as failed
                        # Progress should be at least 80% if we got to deployment validation
                        if progress < 80:
                            progress = 80
                
                # Ensure error message is not truncated (Text field supports unlimited length)
                workflow.error_message = error_message
                
                # Update progress if we adjusted it based on error analysis
                if progress != (workflow.progress_percentage or 0):
                    workflow.progress_percentage = progress
                
                # Set progress based on which stage failed (if not already set)
                if workflow.progress_percentage == 0 or workflow.progress_percentage is None:
                    if compiled_contract:
                        workflow.progress_percentage = 80  # Compilation succeeded
                    elif workflow_result_data.get("compilation_result"):
                        workflow.progress_percentage = 40  # Failed during compilation
                    else:
                        workflow.progress_percentage = 20  # Failed early (generation)

        # Store test results in workflow metadata if available
        # Check for test_result (from orchestrator) or testing_result (from service)
        test_result = (
            workflow_result_data.get("test_result")
            or workflow_result_data.get("testing_result")
            or workflow_result_data.get("test_results")
        )
        if test_result:
            if workflow.meta_data is None:
                workflow.meta_data = {}
            # Store both test_result (for deployment validation) and test_results (for display)
            workflow.meta_data["test_result"] = test_result
            if isinstance(test_result, dict) and "test_results" in test_result:
                workflow.meta_data["test_results"] = test_result["test_results"]
            elif isinstance(test_result, dict):
                workflow.meta_data["test_results"] = test_result
            logger.info(f"Stored test results for workflow {workflow_id}: status={test_result.get('status') if isinstance(test_result, dict) else 'unknown'}")

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
                    meta_data={
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
    # OPTIONAL: User wallet information for deployment (required only if deployment task is selected)
    wallet_address: Optional[str] = None  # User's wallet address (optional for generation-only workflows)
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
    # Validate wallet_address if provided
    if request.wallet_address:
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

    # Deployment is MANDATORY - all workflows must complete deployment
    # Convert skip_* flags to selected_tasks for backward compatibility
    selected_tasks = request.selected_tasks
    if selected_tasks is None:
        # Build selected_tasks from skip flags - deployment is always included
        selected_tasks = ["generation", "compilation"]
        if not request.skip_audit:
            selected_tasks.append("audit")
        if not getattr(request, "skip_testing", False):
            selected_tasks.append("testing")
        # Deployment is mandatory - always include
            selected_tasks.append("deployment")
        logger.info(f"Converted skip flags to selected_tasks (deployment mandatory): {selected_tasks}")
    else:
        # Normalize selected_tasks
        selected_tasks = [task.lower() for task in selected_tasks]
        # Ensure compilation is included if audit/testing/deployment are selected
        if any(task in selected_tasks for task in ["audit", "testing", "deployment"]):
            if "compilation" not in selected_tasks:
                selected_tasks.insert(1, "compilation") if "generation" in selected_tasks else selected_tasks.insert(0, "compilation")
        # Deployment is mandatory - always include if generation/compilation are present
        if any(task in selected_tasks for task in ["generation", "compilation"]) and "deployment" not in selected_tasks:
            selected_tasks.append("deployment")
            logger.info(f"Added mandatory deployment task: {selected_tasks}")
    
    # Validate wallet_address is required for deployment
    if "deployment" in selected_tasks and not request.wallet_address:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="wallet_address is required for deployment. Please connect your wallet in the frontend.",
        )

    # Automatically determine gasless deployment based on x402 network status
    # Gasless is automatically enabled for x402 networks (sponsored by paymaster)
    from hyperagent.blockchain.network_features import NetworkFeatureManager
    
    use_gasless = False
    if "deployment" in selected_tasks:
        is_x402_network = NetworkFeatureManager.is_x402_network(
            request.network, settings.x402_enabled, settings.x402_enabled_networks
        )
        if is_x402_network:
            use_gasless = True
            logger.info(
                f"Automatically enabling gasless deployment for x402 network {request.network}. "
                f"Gas fees will be sponsored by paymaster."
            )
        elif request.use_gasless:
            # Allow explicit gasless for non-x402 networks if facilitator is configured
            use_gasless = True
            logger.info(f"Gasless deployment enabled for non-x402 network {request.network}")

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
            # x402 payment handling is done in the x402-specific workflow endpoints
            # (see hyperagent/api/routes/x402/workflows.py)
            # This endpoint calculates cost but payment verification happens at the x402 layer
            logger.info(
                f"Cost calculated for workflow: ${cost_breakdown['total_usdc']:.4f} "
                f"for tasks {selected_tasks} on x402-enabled network {request.network}"
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
        
        # Store selected_tasks, cost_breakdown, and wallet_address in workflow metadata
        if hasattr(workflow, "meta_data"):
            if workflow.meta_data is None:
                workflow.meta_data = {}
            workflow.meta_data["selected_tasks"] = selected_tasks
            workflow.meta_data["cost_breakdown"] = cost_breakdown
            # Store wallet_address for deployment ownership validation
            if request.wallet_address:
                workflow.meta_data["wallet_address"] = normalize_wallet_address(request.wallet_address)

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
                },
                source_agent="api",
            )
        )

        # Execute workflow in background task with safety wrapper and timeout
        asyncio.create_task(
            safe_execute_workflow_background(
                workflow_id=str(workflow_id),
                nlp_input=request.nlp_input,
                network=request.network,
                skip_audit=request.skip_audit,  # Keep for backward compatibility
                skip_deployment=request.skip_deployment,  # Keep for backward compatibility
                wallet_address=request.wallet_address,  # REQUIRED: Pass wallet address
                use_gasless=None,  # Auto-determined based on x402 network status (sponsored by paymaster)
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

        # Get deployments through contracts, ordered by most recent first
        deployments = []
        for contract in contracts:
            deployments_result = await db.execute(
                select(Deployment)
                .where(Deployment.contract_id == contract.id)
                .order_by(Deployment.deployed_at.desc() if Deployment.deployed_at else Deployment.id.desc())
            )
            contract_deployments = deployments_result.scalars().all()
            deployments.extend(contract_deployments)
        
        # Sort all deployments by deployed_at desc (most recent first)
        deployments.sort(key=lambda d: d.deployed_at if d.deployed_at else d.id, reverse=True)

        # Extract contract_type from first contract or use default
        contract_type = "Custom"
        if contracts:
            contract_type = contracts[0].contract_type or "Custom"
        elif workflow.meta_data and isinstance(workflow.meta_data, dict):
            contract_type = workflow.meta_data.get("contract_type", "Custom")

        # Calculate stage statuses based on workflow progress and results
        meta_data = dict(workflow.meta_data) if workflow.meta_data else {}
        
        # Clean error message if it has misleading "Deployment failed:" prefix for validation errors
        error_message = workflow.error_message or ""
        if "Cannot proceed with deployment" in error_message and workflow.progress_percentage <= 80:
            if error_message.startswith("Deployment failed: "):
                error_message = error_message.replace("Deployment failed: ", "", 1)
        
        # Determine stage statuses from workflow state
        stages = []
        
        # Get selected tasks to determine which stages were actually executed
        selected_tasks = meta_data.get("selected_tasks", ["generation", "compilation", "audit", "testing", "deployment"])
        
        # Generation stage
        generation_status = "pending"
        error_msg = workflow.error_message or ""
        # Check if error is about missing generation (validation error from deployment prerequisites)
        is_generation_error = (
            (workflow.status == WorkflowStatus.FAILED.value and workflow.progress_percentage <= 20) or
            ("Generation stage not completed" in error_msg or "Contract code is missing" in error_msg)
        )
        if is_generation_error:
            generation_status = "failed"
        elif workflow.status in [WorkflowStatus.GENERATING.value, WorkflowStatus.NLP_PARSING.value]:
            generation_status = "processing"
        elif contracts and contracts[0].source_code:
            generation_status = "completed"
        
        stages.append({
            "name": "generation",
            "status": generation_status,
            "label": "Code Generation",
        })
        
        # Compilation stage
        compilation_status = "pending"
        error_msg = workflow.error_message or ""
        # Check if error is about missing compilation (validation error from deployment prerequisites)
        is_compilation_error = (
            (workflow.status == WorkflowStatus.FAILED.value and 20 < workflow.progress_percentage <= 40) or
            ("Compilation stage not completed" in error_msg or 
             ("bytecode" in error_msg.lower() and "missing" in error_msg.lower()) or
             ("abi" in error_msg.lower() and "missing" in error_msg.lower()))
        )
        if is_compilation_error:
            compilation_status = "failed"
        elif workflow.status == WorkflowStatus.GENERATING.value and workflow.progress_percentage > 20:
            compilation_status = "processing"
        elif contracts and contracts[0].bytecode:
            compilation_status = "completed"
        
        stages.append({
            "name": "compilation",
            "status": compilation_status,
            "label": "Compilation",
        })
        
        # Audit stage
        audit_status = "pending"
        if "audit" not in selected_tasks:
            audit_status = "skipped"
        else:
            audit_result = meta_data.get("audit_result")
        if workflow.status == WorkflowStatus.FAILED.value and 40 < workflow.progress_percentage <= 60:
            audit_status = "failed"
        elif workflow.status == WorkflowStatus.AUDITING.value:
            audit_status = "processing"
        elif audit_result:
            audit_status = "completed" if audit_result.get("status") != "failed" else "failed"
        
        stages.append({
            "name": "audit",
            "status": audit_status,
            "label": "Security Audit",
        })
        
        # Testing stage
        testing_status = "pending"
        if "testing" not in selected_tasks:
            testing_status = "skipped"
        else:
            test_result = meta_data.get("test_result")
        if workflow.status == WorkflowStatus.FAILED.value and 60 < workflow.progress_percentage <= 80:
            testing_status = "failed"
        elif workflow.status == WorkflowStatus.TESTING.value:
            testing_status = "processing"
        elif test_result:
            testing_status = "completed" if test_result.get("status") != "failed" else "failed"
        
        stages.append({
            "name": "testing",
            "status": testing_status,
            "label": "Testing",
        })
        
        # Deployment stage
        deployment_status = "pending"
        # Only mark deployment as failed if workflow failed AND progress > 80% AND error mentions deployment
        if workflow.status == WorkflowStatus.FAILED.value:
            # Check if error is actually deployment-related
            # Use cleaned error_message from above
            is_deployment_error = (
                workflow.progress_percentage > 80 or
                ("deployment" in error_message.lower() and "Cannot proceed with deployment" not in error_message) or
                ("deployment failed" in error_message.lower() and workflow.progress_percentage > 80)
            )
            # If error says "Cannot proceed with deployment" but progress is low, it's a validation error, not deployment failure
            if "Cannot proceed with deployment" in error_message and workflow.progress_percentage <= 80:
                # This is a prerequisite validation error, deployment never started
                deployment_status = "pending"
            elif is_deployment_error:
                deployment_status = "failed"
            else:
                # Error is from earlier stage, deployment never started
                deployment_status = "pending"
        elif workflow.status == WorkflowStatus.DEPLOYING.value:
            deployment_status = "processing"
        elif meta_data.get("deployment_status") == "pending_signature":
            deployment_status = "pending"  # Waiting for user signature
        elif deployments and deployments[0].contract_address:
            deployment_status = "completed"
        elif workflow.status == WorkflowStatus.COMPLETED.value and not deployments:
            # Workflow completed but no deployment - might be pending signature
            if meta_data.get("requires_user_signature") or meta_data.get("deployment_status") == "pending_signature":
                deployment_status = "pending"
            else:
                deployment_status = "pending"  # Ready to deploy
        
        stages.append({
            "name": "deployment",
            "status": deployment_status,
            "label": "Deployment",
        })

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
            "error_message": error_message,  # Use cleaned error message (removes misleading "Deployment failed:" prefix for validation errors)
            "retry_count": workflow.retry_count,
            "metadata": meta_data,
            "meta_data": meta_data,  # Also include meta_data for compatibility
            "stages": stages,  # Include calculated stages
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
            # Include deployment_result for frontend compatibility
            # Use the most recent deployment (first in sorted list)
            "deployment_result": {
                "contract_address": deployments[0].contract_address if deployments else None,
                "transaction_hash": deployments[0].transaction_hash if deployments else None,
                "block_number": deployments[0].block_number if deployments else None,
                "gas_used": deployments[0].gas_used if deployments else None,
                "deployed_at": deployments[0].deployed_at.isoformat() if deployments and deployments[0].deployed_at else None,
            } if deployments else None,
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


class CompleteDeploymentRequest(BaseModel):
    """Request model for completing workflow deployment"""
    signed_transaction: Optional[str] = None
    transaction_hash: Optional[str] = None
    contract_address: Optional[str] = None  # For Smart Wallet deployments where contract is already deployed
    wallet_address: str


@router.post("/{workflow_id}/complete-deployment")
async def complete_workflow_deployment(
    workflow_id: str,
    request: CompleteDeploymentRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Complete workflow deployment with user-signed transaction or transaction hash
    
    This endpoint is called after the user signs the deployment transaction in their wallet.
    Can accept either:
    - signed_transaction: Raw hex-encoded signed transaction (backend broadcasts it)
    - transaction_hash: Transaction hash from already-broadcast transaction (backend polls for receipt)
    
    Args:
        workflow_id: Workflow identifier
        signed_transaction: Hex-encoded signed transaction from user's wallet (optional)
        transaction_hash: Transaction hash if transaction already broadcast (optional)
        wallet_address: User's wallet address (required)
        db: Database session
    
    Returns:
        Deployment result with contract address and transaction hash
    """
    from hyperagent.models.contract import GeneratedContract
    from hyperagent.models.deployment import Deployment
    from hyperagent.utils.helpers import normalize_wallet_address, validate_wallet_address
    
    try:
        # Validate inputs
        # Accept contract_address for Smart Wallet deployments (Thirdweb handles tx internally)
        if not request.signed_transaction and not request.transaction_hash and not request.contract_address:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either signed_transaction, transaction_hash, or contract_address must be provided",
            )
        
        # Validate wallet address
        is_valid, error_msg = validate_wallet_address(request.wallet_address)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid wallet address: {error_msg}",
            )
        wallet_address = normalize_wallet_address(request.wallet_address)
        
        # Get workflow
        workflow_result = await db.execute(
            select(Workflow).where(Workflow.id == uuid.UUID(workflow_id))
        )
        workflow = workflow_result.scalar_one_or_none()
        
        if not workflow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Workflow {workflow_id} not found",
            )
        
        # Validate wallet ownership: Only the wallet that created the workflow can deploy
        workflow_wallet_address = None
        if workflow.meta_data and isinstance(workflow.meta_data, dict):
            workflow_wallet_address = workflow.meta_data.get("wallet_address")
        
        if workflow_wallet_address:
            # Normalize both addresses for comparison (case-insensitive)
            normalized_workflow_wallet = normalize_wallet_address(workflow_wallet_address)
            if normalized_workflow_wallet != wallet_address:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=(
                        f"Smart Wallet ownership mismatch. "
                        f"This workflow belongs to Smart Wallet {workflow_wallet_address[:10]}...{workflow_wallet_address[-8:]}, "
                        f"but you are connected with Smart Wallet {wallet_address[:10]}...{wallet_address[-8:]}. "
                        f"Please connect the Smart Wallet (ERC-4337) that created this workflow to deploy."
                    ),
                )
        else:
            # If workflow doesn't have wallet_address stored, allow deployment but log warning
            logger.warning(
                f"Workflow {workflow_id} does not have wallet_address stored in meta_data. "
                f"Allowing deployment but this should be set during workflow creation."
            )
        
        # Get contract
        contract_result = await db.execute(
            select(GeneratedContract)
            .where(GeneratedContract.workflow_id == uuid.UUID(workflow_id))
            .order_by(GeneratedContract.created_at.desc())
        )
        contract = contract_result.scalar_one_or_none()
        
        if not contract:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No contract found for workflow",
            )
        
        # Initialize deployment service
        network_manager = NetworkManager()
        eigenda_client = EigenDAClient(
            disperser_url=settings.eigenda_disperser_url,
            private_key=settings.private_key,
            use_authenticated=settings.eigenda_use_authenticated,
        )
        deployment_service = DeploymentService(network_manager, eigenda_client)
        
        # Handle deployment based on input type
        if request.contract_address:
            # Contract already deployed via Smart Wallet or EOA (Thirdweb handles deployment internally)
            # Use the provided contract address directly
            from hyperagent.utils.helpers import validate_wallet_address
            is_valid_addr, error_msg_addr = validate_wallet_address(request.contract_address)
            if not is_valid_addr:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid contract address: {error_msg_addr}",
                )
            
            # Try to get receipt details if transaction_hash is provided
            block_number = None
            gas_used = None
            if request.transaction_hash:
                try:
                    w3 = network_manager.get_web3(workflow.network)
                    # Ensure tx_hash has 0x prefix
                    tx_hash = request.transaction_hash
                    if not tx_hash.startswith('0x'):
                        tx_hash = f'0x{tx_hash}'
                    
                    receipt = w3.eth.get_transaction_receipt(tx_hash)
                    if receipt:
                        block_number = receipt.blockNumber
                        gas_used = receipt.gasUsed
                        logger.info(f"Retrieved receipt for tx {tx_hash}: block={block_number}, gas={gas_used}")
                except Exception as receipt_error:
                    # Log but don't fail - receipt might not be available yet or tx might be pending
                    logger.warning(f"Could not get receipt for transaction {request.transaction_hash}: {receipt_error}")
            
            # Ensure transaction_hash is not empty - use a placeholder if not provided
            # (Some deployments via Smart Wallet may not have a transaction hash immediately)
            tx_hash = request.transaction_hash.strip() if request.transaction_hash and request.transaction_hash.strip() else None
            
            deployment_result = {
                "status": "success",
                "contract_address": request.contract_address,
                "transaction_hash": tx_hash,
                "tx_hash": tx_hash,
                "block_number": block_number,
                "gas_used": gas_used,
                "deployment_method": "user_wallet" if tx_hash else "smart_wallet",
            }
        elif request.signed_transaction:
            # Deploy with signed transaction (backend broadcasts it)
            deployment_result = await deployment_service.process({
                "compiled_contract": {
                    "bytecode": contract.bytecode,
                    "abi": contract.abi,
                },
                "network": workflow.network,
                "signed_transaction": request.signed_transaction,
                "wallet_address": wallet_address,
                "source_code": contract.source_code,
            })
        elif request.transaction_hash:
            # Transaction already broadcast - poll for receipt and extract contract address
            contract_address = await deployment_service.get_contract_address_from_tx(
                request.transaction_hash, workflow.network
            )
            
            if not contract_address:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Contract address not found. Transaction may still be pending.",
                )
            
            # Get transaction receipt for additional details
            block_number = None
            gas_used = None
            try:
                w3 = network_manager.get_web3(workflow.network)
                # Ensure tx_hash has 0x prefix
                tx_hash = request.transaction_hash
                if not tx_hash.startswith('0x'):
                    tx_hash = f'0x{tx_hash}'
                
                receipt = w3.eth.get_transaction_receipt(tx_hash)
                if receipt:
                    block_number = receipt.blockNumber
                    gas_used = receipt.gasUsed
                    logger.info(f"Retrieved receipt for tx {tx_hash}: block={block_number}, gas={gas_used}")
            except Exception as receipt_error:
                # Log but don't fail - receipt might not be available yet
                logger.warning(f"Could not get receipt for transaction {request.transaction_hash}: {receipt_error}")
                # Contract address was already extracted, so we can continue
            
            # Use the transaction hash from the request (user-provided)
            # This ensures consistency with what the user sees in their wallet/explorer
            tx_hash = request.transaction_hash.strip() if request.transaction_hash else None
            if tx_hash and not tx_hash.startswith('0x'):
                tx_hash = f'0x{tx_hash}'
            
            deployment_result = {
                "status": "success",
                "contract_address": contract_address,
                "transaction_hash": tx_hash,
                "tx_hash": tx_hash,
                "block_number": block_number,
                "gas_used": gas_used,
                "deployment_method": "user_wallet",
            }
        
        # Validate required fields before creating deployment record
        contract_address = deployment_result.get("contract_address")
        transaction_hash = deployment_result.get("transaction_hash") or deployment_result.get("tx_hash")
        
        if not contract_address or not contract_address.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Contract address is required for deployment completion",
            )
        
        # Transaction hash is required by the database schema (nullable=False, unique=True)
        # If not provided, we need to generate a unique placeholder
        if not transaction_hash or not transaction_hash.strip():
            # For Smart Wallet deployments, transaction hash might not be available immediately
            # Generate a unique placeholder based on contract address and workflow ID to avoid conflicts
            import hashlib
            unique_string = f"{contract_address}{workflow_id}{contract.id}"
            placeholder_hash = f"0x{hashlib.sha256(unique_string.encode()).hexdigest()[:64]}"
            logger.warning(
                f"No transaction hash provided for deployment. Using unique placeholder: {placeholder_hash}. "
                f"Contract address: {contract_address}"
            )
            transaction_hash = placeholder_hash
        
        # Create deployment record
        is_testnet = workflow.network.endswith("_testnet")
        from datetime import datetime
        deployment = Deployment(
            contract_id=contract.id,
            deployment_network=workflow.network,
            is_testnet=is_testnet,
            contract_address=contract_address.strip(),
            deployer_address=wallet_address or "",
            transaction_hash=transaction_hash.strip(),
            gas_used=deployment_result.get("gas_used"),
            gas_price=deployment_result.get("gas_price"),
            total_cost_wei=deployment_result.get("total_cost_wei"),
            deployment_status="confirmed" if deployment_result.get("block_number") else "pending",
            block_number=deployment_result.get("block_number"),
            confirmation_blocks=1,
            eigenda_commitment=deployment_result.get("eigenda_commitment"),
            eigenda_batch_header=deployment_result.get("eigenda_batch_header"),
            deployed_at=datetime.now(),  # Explicitly set deployed_at timestamp
            meta_data={
                "deployment_method": "user_signed",
                "eigenda_metadata_stored": deployment_result.get("eigenda_metadata_stored", False),
            },
        )
        db.add(deployment)
        
        # Update workflow status to completed
        workflow.status = WorkflowStatus.COMPLETED.value
        workflow.progress_percentage = 100
        workflow.completed_at = datetime.now()
        
        # Update metadata
        if workflow.meta_data is None:
            workflow.meta_data = {}
        workflow.meta_data["deployment_status"] = "completed"
        workflow.meta_data["requires_user_signature"] = False
        
        await db.commit()
        
        logger.info(
            f"Completed deployment for workflow {workflow_id}: {deployment_result.get('contract_address')}"
        )
        
        return {
            "contract_address": deployment_result.get("contract_address"),
            "transaction_hash": deployment_result.get("transaction_hash") or deployment_result.get("tx_hash"),
            "block_number": deployment_result.get("block_number"),
            "gas_used": deployment_result.get("gas_used"),
            "eigenda_commitment": deployment_result.get("eigenda_commitment"),
        }
        
    except ValueError as e:
        logger.error(f"Deployment validation error: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to complete deployment: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to complete deployment: {str(e)}",
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


class ClarificationResponseRequest(BaseModel):
    """Request model for submitting clarification responses"""

    clarified_prompt: str


@router.post("/{workflow_id}/clarify", response_model=WorkflowResponse)
async def submit_clarification(
    workflow_id: str,
    request: ClarificationResponseRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Submit clarification responses and continue workflow

    When a workflow requires clarification, use this endpoint to submit
    the clarified prompt and continue the workflow execution.
    """
    try:
        workflow_id_uuid = uuid.UUID(workflow_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid workflow ID format"
        )

    try:
        # Get workflow
        workflow_result = await db.execute(
            select(Workflow).where(Workflow.id == workflow_id_uuid)
        )
        workflow = workflow_result.scalar_one_or_none()

        if not workflow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found"
            )

        if workflow.status != "clarification_needed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Workflow is not in clarification_needed status. Current status: {workflow.status}",
            )

        # Get clarification questions from metadata
        clarification_questions = workflow.meta_data.get("clarification_questions", [])
        original_prompt = workflow.meta_data.get("original_prompt", workflow.nlp_input)

        # Update workflow with clarified prompt
        workflow.nlp_input = request.clarified_prompt
        workflow.status = WorkflowStatus.GENERATING.value
        workflow.progress_percentage = 10

        # Update metadata
        if workflow.meta_data is None:
            workflow.meta_data = {}
        workflow.meta_data["clarified_prompt"] = request.clarified_prompt
        workflow.meta_data["clarification_provided"] = True

        await db.commit()
        await db.refresh(workflow)

        # Continue workflow execution with clarified prompt
        # Get workflow parameters from metadata
        selected_tasks = workflow.meta_data.get("selected_tasks")
        wallet_address = workflow.meta_data.get("wallet_address")
        use_gasless = workflow.meta_data.get("use_gasless", False)

        # Execute workflow in background with clarified prompt
        background_tasks.add_task(
            safe_execute_workflow_background,
            workflow_id=str(workflow_id),
            nlp_input=request.clarified_prompt,
            network=workflow.network,
            skip_audit=False,  # Use selected_tasks instead
            skip_deployment=False,  # Use selected_tasks instead
            wallet_address=wallet_address,
            use_gasless=use_gasless,
            selected_tasks=selected_tasks,
        )

        return {
            "workflow_id": str(workflow_id),
            "status": "generating",
            "message": "Workflow continued with clarified prompt",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to submit clarification: {e}", exc_info=True)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit clarification: {str(e)}",
        )
