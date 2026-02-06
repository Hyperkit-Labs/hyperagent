"""Workflow coordinator orchestrator"""

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from hyperagent.architecture.soa import SequentialOrchestrator, ServiceRegistry
from hyperagent.cache.redis_manager import RedisManager
from hyperagent.core.agent_system import WorkflowStage
from hyperagent.core.agents.error_analyzer import ErrorAnalyzer
from hyperagent.core.agents.fix_generator import FixGenerator
from hyperagent.core.agents.requirements_agent import RequirementsAgent
from hyperagent.core.agents.design_agent import DesignAgent
from hyperagent.core.agents.capability_checker import CapabilityChecker
from hyperagent.core.agents.design_document_generator import DesignDocumentGenerator
from hyperagent.core.agents.reflection_agent import ReflectionAgent
from hyperagent.core.memory.long_term_memory import LongTermMemory
from hyperagent.core.planning.roma_planner import ROMAPlanner
from hyperagent.core.routing.multi_model_router import MultiModelRouter
from hyperagent.events.event_bus import EventBus
from hyperagent.events.event_types import Event, EventType
from hyperagent.rag.firecrawl_rag import FirecrawlRAG
from hyperagent.llm.provider import LLMProvider

logger = logging.getLogger(__name__)

STAGE_PROGRESS_MAP = {
    "planning": (0, 20),
    "generation": (20, 40),
    "audit": (40, 60),
    "testing": (60, 80),
    "deployment": (80, 100)
}


class WorkflowCoordinator:
    """
    Workflow Coordinator

    Concept: Orchestrates complete workflow pipeline
    Logic: Manages state transitions, coordinates agents, handles errors
    Pattern: Service Orchestration Pattern (SOP)
    """

    def __init__(
        self,
        service_registry: ServiceRegistry,
        event_bus: EventBus,
        progress_callback=None,
        redis_manager: Optional[RedisManager] = None,
        roma_planner: Optional[ROMAPlanner] = None,
        firecrawl_rag: Optional[FirecrawlRAG] = None,
        multi_model_router: Optional[MultiModelRouter] = None,
        llm_provider: Optional[LLMProvider] = None,
    ):
        self.registry = service_registry
        self.event_bus = event_bus
        self.workflow_id = None
        self.state = {}
        self.redis_manager = redis_manager
        self.roma_planner = roma_planner or (
            ROMAPlanner(redis_manager=redis_manager) if redis_manager else None
        )
        self.firecrawl_rag = firecrawl_rag
        self.multi_model_router = multi_model_router or (
            MultiModelRouter(redis_manager=redis_manager) if redis_manager else None
        )
        
        # Initialize long-term memory first (needed by error analyzer)
        long_term_memory = LongTermMemory() if (llm_provider or multi_model_router) else None
        
        # Initialize error analyzer and fix generator for feedback loops
        error_analyzer = None
        fix_generator = None
        if llm_provider or multi_model_router:
            error_analyzer = ErrorAnalyzer(
                llm_provider=llm_provider,
                multi_model_router=multi_model_router,
                long_term_memory=long_term_memory,
            )
            # Get generation service for fix generator
            generation_service = None
            try:
                generation_service = service_registry.get_service("generation")
            except ValueError:
                pass  # Generation service not registered yet
            
            fix_generator = FixGenerator(
                error_analyzer=error_analyzer,
                generation_service=generation_service,
                llm_provider=llm_provider,
                multi_model_router=multi_model_router,
            )
        
        self.orchestrator = SequentialOrchestrator(
            service_registry,
            event_bus,
            progress_callback,
            error_analyzer=error_analyzer,
            fix_generator=fix_generator,
        )
        
        # Initialize requirements agent for Phase 2
        self.requirements_agent = None
        if llm_provider or multi_model_router:
            self.requirements_agent = RequirementsAgent(
                llm_provider=llm_provider,
                multi_model_router=multi_model_router,
            )
        
        # Initialize design agent for Phase 3
        self.design_agent = None
        if llm_provider or multi_model_router:
            self.design_agent = DesignAgent(
                llm_provider=llm_provider,
                multi_model_router=multi_model_router,
            )
        
        # Initialize capability checker for Phase 4
        self.capability_checker = None
        if llm_provider or multi_model_router:
            self.capability_checker = CapabilityChecker(
                llm_provider=llm_provider,
                multi_model_router=multi_model_router,
            )
        
        # Initialize design document generator for Phase 4
        self.design_document_generator = None
        if llm_provider or multi_model_router:
            self.design_document_generator = DesignDocumentGenerator(
                llm_provider=llm_provider,
                multi_model_router=multi_model_router,
            )
        
        # Initialize reflection agent for Phase 5 (reuse long_term_memory from above)
        self.reflection_agent = None
        self.long_term_memory = long_term_memory
        if llm_provider or multi_model_router:
            self.reflection_agent = ReflectionAgent(
                llm_provider=llm_provider,
                multi_model_router=multi_model_router,
            )
        
        # Initialize workflow learner for AI-native learning
        self.workflow_learner = None
        # Will be initialized with db session when execute_workflow is called

    async def update_stage_progress(self, stage: str, sub_progress: float):
        """
        Update progress within a workflow stage
        
        Maps stage names to progress percentages (0-100) dynamically based on selected tasks
        
        Args:
            stage: Current workflow stage name
            sub_progress: Progress within stage (0.0 to 1.0)
        """
        # Get selected tasks from state or use default
        selected_tasks = self.state.get("selected_tasks")
        
        # Calculate dynamic progress ranges
        progress_ranges = self._calculate_progress_ranges(selected_tasks)
        
        # Map service names to stage names
        stage_mapping = {
            "generation": "generation",
            "compilation": "compilation",
            "audit": "audit",
            "testing": "testing",
            "deployment": "deployment",
        }
        
        # Find matching stage
        stage_key = None
        for service_name, stage_name in stage_mapping.items():
            if service_name in stage.lower() or stage.lower() in service_name:
                stage_key = service_name
                break
        
        # Fallback to static map if not found
        if stage_key is None or stage_key not in progress_ranges:
            if stage not in STAGE_PROGRESS_MAP:
                logger.warning(f"Unknown stage '{stage}', defaulting to planning")
                stage = "planning"
            start, end = STAGE_PROGRESS_MAP[stage]
        else:
            start, end = progress_ranges[stage_key]
        
        overall_progress = start + (sub_progress * (end - start))
        
        logger.info(f"Workflow {self.workflow_id}: {stage} stage - {overall_progress:.1f}%")
        
        await self.event_bus.emit(Event(
            type=EventType.WORKFLOW_PROGRESSED,
            data={
                "workflow_id": self.workflow_id,
                "stage": stage,
                "progress_percentage": overall_progress,
                "sub_progress": sub_progress,
                "selected_tasks": selected_tasks,  # Include selected tasks in event
            }
        ))
        
        return overall_progress


    def _build_pipeline_from_tasks(
        self,
        selected_tasks: Optional[List[str]],
        nlp_input: str,
        network: str,
        workflow_id: str,
        wallet_address: Optional[str],
        use_gasless: bool,
        signed_transaction: Optional[str],
        rag_context: str,
        plan_timeouts: Dict,
        rag_metadata: Dict,
    ) -> List[Dict[str, Any]]:
        """
        Build pipeline dynamically based on selected tasks
        
        Args:
            selected_tasks: List of task names to execute. If None, uses all tasks.
            Other args: Workflow parameters for pipeline stages
        
        Returns:
            List of pipeline stage definitions
        """
        # Default to all tasks if not specified
        if selected_tasks is None:
            selected_tasks = ["generation", "compilation", "audit", "testing", "deployment"]
        
        # Normalize task names
        selected_tasks = [task.lower() for task in selected_tasks]
        
        # Task dependencies: some tasks require others
        # Generation is always required if other tasks are selected
        if any(task in selected_tasks for task in ["audit", "testing", "deployment"]):
            if "generation" not in selected_tasks:
                logger.warning("Generation required for audit/testing/deployment, adding it")
                selected_tasks.insert(0, "generation")
        
        # Compilation is required for audit, testing, and deployment
        if any(task in selected_tasks for task in ["audit", "testing", "deployment"]):
            if "compilation" not in selected_tasks:
                logger.warning("Compilation required for audit/testing/deployment, adding it")
                # Insert after generation if generation is present
                gen_idx = selected_tasks.index("generation") if "generation" in selected_tasks else 0
                selected_tasks.insert(gen_idx + 1, "compilation")
        
        pipeline = []
        
        if "generation" in selected_tasks:
            # Get similar workflows from state (populated in execute_workflow)
            similar_workflows = self.state.get("similar_workflows", [])
            
            pipeline.append({
                "service": "generation",
                "input_mapping": {
                    "nlp_description": "nlp_input",
                    "network": "network",
                    "rag_context": "rag_context",
                    "architecture_design": "architecture_design",  # Pass architecture design to generation
                    "similar_workflows": similar_workflows,  # Pass similar workflows for learning
                },
            })
        
        if "compilation" in selected_tasks:
            pipeline.append({
                "service": "compilation",
                "input_mapping": {"contract_code": "contract_code"}
            })
        
        if "audit" in selected_tasks:
            pipeline.append({
                "service": "audit",
                "input_mapping": {"contract_code": "contract_code"}
            })
        
        if "testing" in selected_tasks:
            pipeline.append({
                "service": "testing",
                "input_mapping": {
                    "contract_code": "contract_code",
                    "contract_name": "contract_name",
                    "network": "network",
                    "compiled_contract": "compiled_contract",
                    "workflow_id": "workflow_id",
                },
            })
        
        if "deployment" in selected_tasks:
            pipeline.append({
                "service": "deployment",
                "input_mapping": {
                    "compiled_contract": "compiled_contract",
                    "network": "network",
                    "source_code": "contract_code",
                    "constructor_args": "constructor_args",
                    "wallet_address": "wallet_address",
                    "use_gasless": "use_gasless",
                    "signed_transaction": "signed_transaction",
                    "audit_result": "audit_result",
                    "test_result": "test_result",
                    "workflow_context": "workflow_context",  # Pass workflow_context from state
                },
            })
        
        return pipeline
    
    def _calculate_progress_ranges(self, selected_tasks: Optional[List[str]]) -> Dict[str, tuple]:
        """
        Calculate progress ranges for selected tasks
        
        Args:
            selected_tasks: List of selected task names
        
        Returns:
            Dict mapping task name to (start, end) percentage tuple
        """
        # Default to all tasks if not specified
        if selected_tasks is None:
            selected_tasks = ["generation", "compilation", "audit", "testing", "deployment"]
        
        # Normalize and filter valid tasks
        valid_tasks = ["generation", "compilation", "audit", "testing", "deployment"]
        selected_tasks = [task.lower() for task in selected_tasks if task.lower() in valid_tasks]
        
        if not selected_tasks:
            return {}
        
        # Calculate step size
        step_size = 100 / len(selected_tasks)
        
        progress_map = {}
        for i, task in enumerate(selected_tasks):
            start = i * step_size
            end = (i + 1) * step_size if i < len(selected_tasks) - 1 else 100
            progress_map[task] = (start, end)
        
        return progress_map

    async def execute_workflow(
        self,
        workflow_id: str,
        nlp_input: str,
        network: str,
        wallet_address: Optional[str] = None,  # REQUIRED: User wallet address
        use_gasless: bool = False,  # Use facilitator for gasless deployment
        signed_transaction: Optional[str] = None,  # Pre-signed transaction (optional)
        selected_tasks: Optional[List[str]] = None,  # NEW: Selected tasks to execute
        db_session = None,  # Database session for learning system
    ) -> Dict[str, Any]:
        """
        Execute complete workflow pipeline

        NOW REQUIRES: wallet_address for user-wallet-based deployment

        Pipeline Flow:
        1. Parse NLP input
        2. Generate contract (GenerationService)
        3. Compile contract (CompilationService)
        4. Audit contract (AuditService)
        5. Test contract (TestingService)
        6. Deploy contract (DeploymentService) - requires wallet_address
        """
        # Validate wallet_address only if deployment is selected
        if selected_tasks is None:
            selected_tasks = ["generation", "compilation", "audit", "testing", "deployment"]
        
        # Check if deployment is in selected tasks
        deployment_selected = "deployment" in [task.lower() for task in selected_tasks]
        
        if deployment_selected and not wallet_address:
            raise ValueError(
                "wallet_address is required for deployment. "
                "Please provide the user's wallet address or remove deployment from selected tasks."
            )

        # Validate wallet address format if provided
        if wallet_address:
            from hyperagent.utils.helpers import normalize_wallet_address, validate_wallet_address

            is_valid, error_msg = validate_wallet_address(wallet_address)
            if not is_valid:
                raise ValueError(f"Invalid wallet address: {error_msg}")

            # Normalize to checksum format
            wallet_address = normalize_wallet_address(wallet_address)

        self.workflow_id = workflow_id

        # Requirements clarification step
        # Use self.requirements_agent if initialized, otherwise skip clarification
        requirements_spec = None
        if self.requirements_agent:
            needs_clarification, clarification_questions = await self.requirements_agent.needs_clarification(nlp_input)
            
            if needs_clarification:
                # Return clarification needed status
                return {
                    "status": "clarification_needed",
                    "workflow_id": workflow_id,
                    "questions": clarification_questions,
                    "original_prompt": nlp_input,
                }
            
            # Extract structured requirements spec
            requirements_spec = await self.requirements_agent.extract_spec(nlp_input)
        else:
            logger.warning("RequirementsAgent not initialized, skipping clarification step.")
        
        # Store requirements spec in state if available
        if requirements_spec:
            self.state["requirements_spec"] = requirements_spec.model_dump()
        
        # Phase 4: Capability Check
        capability_assessment = None
        if self.capability_checker and requirements_spec:
            logger.info("Checking system capabilities...")
            try:
                capability_assessment = await self.capability_checker.assess_capability(
                    requirements_spec=requirements_spec,
                )
                self.state["capability_assessment"] = capability_assessment.model_dump()
                logger.info(
                    f"Capability check: is_supported={capability_assessment.is_supported}, "
                    f"can_proceed={capability_assessment.can_proceed}"
                )
                
                # Graceful stopping if requirements exceed capabilities
                if not capability_assessment.can_proceed:
                    logger.warning(
                        f"Requirements exceed system capabilities. Unsupported features: "
                        f"{capability_assessment.unsupported_features}"
                    )
                    self.state["status"] = "capability_exceeded"
                    
                    # Generate design document for capability-exceeded workflow
                    design_document = None
                    if self.design_document_generator:
                        try:
                            logger.info("Generating design document for capability-exceeded workflow...")
                            design_document = await self.design_document_generator.generate_design_document(
                                requirements_spec=requirements_spec,
                                capability_assessment=capability_assessment,
                            )
                            design_document["workflow_id"] = str(workflow_id)
                            self.state["design_document"] = design_document
                            logger.info("Design document generated successfully")
                        except Exception as e:
                            logger.error(f"Failed to generate design document: {e}", exc_info=True)
                            # Continue without design document if generation fails
                    
                    await self.event_bus.publish(
                        Event(
                            id=str(uuid.uuid4()),
                            type=EventType.WORKFLOW_CAPABILITY_EXCEEDED,
                            workflow_id=str(workflow_id),
                            timestamp=datetime.now(),
                            data={
                                "capability_assessment": capability_assessment.model_dump(),
                                "requirements_spec": requirements_spec.model_dump(),
                                "design_document": design_document,
                            },
                            source_agent="coordinator",
                        )
                    )
                    return {
                        "status": "capability_exceeded",
                        "workflow_id": workflow_id,
                        "capability_assessment": capability_assessment.model_dump(),
                        "requirements_spec": requirements_spec.model_dump(),
                        "design_document": design_document,
                    }
            except Exception as e:
                logger.error(f"Capability check failed: {e}", exc_info=True)
                # Continue workflow if capability check fails
                logger.warning("Continuing workflow despite capability check failure.")
        else:
            if not self.capability_checker:
                logger.warning("CapabilityChecker not initialized, skipping capability check.")
            elif not requirements_spec:
                logger.warning("Requirements spec not available, skipping capability check.")
        
        # Phase 3: Architecture Design (with timeout and learning-based skip)
        architecture_design = None
        
        # Check if we should skip architecture design based on learning
        should_skip_arch = False
        if hasattr(self, 'workflow_learner') and self.workflow_learner:
            try:
                contract_type = requirements_spec.contract_type if requirements_spec and hasattr(requirements_spec, 'contract_type') else "Custom"
                should_skip_arch = await self.workflow_learner.should_skip_architecture_design(
                    contract_type=contract_type,
                    network=network,
                    nlp_input=nlp_input,
                )
                if should_skip_arch:
                    logger.info("Skipping architecture design based on learning system (template-based or previous failures)")
            except Exception as e:
                logger.warning(f"Failed to check learning system for architecture skip: {e}")
        
        if not should_skip_arch and self.design_agent and requirements_spec:
            logger.info("Generating architecture design...")
            try:
                import asyncio
                from hyperagent.core.config import settings
                
                # Get RAG context if available (will be fetched later, but we can pass empty for now)
                rag_context_dict = {}  # Will be populated later if firecrawl_rag is available
                
                # Use configurable timeout for architecture design
                architecture_timeout = settings.architecture_design_timeout_seconds
                try:
                    architecture_design = await asyncio.wait_for(
                        self.design_agent.design_architecture(
                            requirements_spec=requirements_spec,
                            network=network,
                            rag_context=rag_context_dict,
                        ),
                        timeout=architecture_timeout
                    )
                    self.state["architecture_design"] = architecture_design.model_dump()
                    logger.info(f"Architecture design generated: {architecture_design.contract_type}")
                except asyncio.TimeoutError:
                    logger.warning(f"Architecture design generation timed out after {architecture_timeout}s, continuing without it")
                    architecture_design = None
            except Exception as e:
                logger.error(f"Architecture design generation failed: {e}", exc_info=True)
                # Continue without architecture design if it fails (non-blocking)
                logger.warning("Continuing workflow without architecture design.")
                architecture_design = None
        else:
            if should_skip_arch:
                logger.info("Skipping architecture design (template-based workflow or learning recommendation)")
            elif not self.design_agent:
                logger.warning("DesignAgent not initialized, skipping architecture design.")
            elif not requirements_spec:
                logger.warning("Requirements spec not available, skipping architecture design.")

        plan = None
        rag_context = ""
        plan_timeouts = {}
        rag_metadata = {}

        if self.roma_planner:
            try:
                logger.info("Decomposing prompt with ROMA planner")
                plan = await self.roma_planner.plan(prompt=nlp_input, chain=network)
                logger.info(f"ROMA plan generated: {len(plan.get('dependencies', []))} dependencies")

                if plan:
                    try:
                        plan_dict = plan.to_dict() if hasattr(plan, "to_dict") else plan
                        plan_timeouts = {
                            "generation": plan_dict.get("code_phase", {}).get("duration_sec", 30),
                            "audit": plan_dict.get("audit_phase", {}).get("duration_sec", 20),
                            "testing": plan_dict.get("test_phase", {}).get("duration_sec", 15),
                            "deployment": plan_dict.get("deploy_phase", {}).get("duration_sec", 10),
                        }
                        logger.info(
                            f"Using ROMA plan timeouts: gen={plan_timeouts['generation']}s, "
                            f"audit={plan_timeouts['audit']}s, test={plan_timeouts['testing']}s, "
                            f"deploy={plan_timeouts['deployment']}s"
                        )
                    except Exception as e:
                        logger.warning(f"Failed to extract timeouts from plan: {e}")
            except Exception as e:
                logger.warning(f"ROMA planning failed: {e}, continuing without plan")

        if self.firecrawl_rag:
            try:
                logger.info("Fetching RAG context from Firecrawl")
                rag_context = await self.firecrawl_rag.generate_context(prompt=nlp_input)
                logger.info(f"RAG context fetched: {len(rag_context)} chars")

                protocols_used = self.firecrawl_rag._determine_relevant_protocols(nlp_input)
                rag_metadata = {
                    "protocols_used": protocols_used,
                    "context_length": len(rag_context),
                    "has_context": bool(rag_context),
                    "protocol_count": len(protocols_used),
                }
                logger.info(f"RAG metadata: {rag_metadata}")
            except Exception as e:
                logger.warning(f"Firecrawl RAG failed: {e}, continuing without context")
                rag_metadata = {
                    "protocols_used": [],
                    "context_length": 0,
                    "has_context": False,
                    "error": str(e),
                }

        # Store selected tasks in state
        if selected_tasks is None:
            selected_tasks = ["generation", "compilation", "audit", "testing", "deployment"]

        # Get similar successful workflows for learning (if learner is available)
        # This must be done before building pipeline so it's available in state
        similar_workflows = []
        if self.workflow_learner:
            try:
                contract_type = "Custom"
                if requirements_spec:
                    if hasattr(requirements_spec, 'contract_type'):
                        contract_type = requirements_spec.contract_type
                    elif isinstance(requirements_spec, dict):
                        contract_type = requirements_spec.get("contract_type", "Custom")
                
                similar_workflows = await self.workflow_learner.get_similar_successful_workflows(
                    contract_type=contract_type,
                    network=network,
                    limit=3,
                )
                if similar_workflows:
                    logger.info(f"Found {len(similar_workflows)} similar successful workflows for learning")
            except Exception as e:
                logger.warning(f"Failed to get similar workflows: {e}")

        self.state = {
            "workflow_id": workflow_id,
            "nlp_input": nlp_input,
            "network": network,
            "stages_completed": [],
            "roma_plan": plan.to_dict() if hasattr(plan, "to_dict") else plan if plan else None,
            "rag_context": rag_context,
            "plan_timeouts": plan_timeouts,
            "rag_metadata": rag_metadata,
            "selected_tasks": selected_tasks,  # Store selected tasks
            "requirements_spec": self.state.get("requirements_spec"),  # Store requirements spec
            "architecture_design": self.state.get("architecture_design"),  # Store architecture design
            "similar_workflows": similar_workflows,  # Store similar workflows for learning
        }

        # Publish workflow started
        await self.event_bus.publish(
            Event(
                id=str(uuid.uuid4()),
                type=EventType.WORKFLOW_STARTED,
                workflow_id=workflow_id,
                timestamp=datetime.now(),
                data=self.state,
                source_agent="coordinator",
            )
        )

        try:
            # Build pipeline dynamically based on selected tasks
            pipeline = self._build_pipeline_from_tasks(
                selected_tasks=selected_tasks,
                nlp_input=nlp_input,
                network=network,
                workflow_id=workflow_id,
                wallet_address=wallet_address,
                use_gasless=use_gasless,
                signed_transaction=signed_transaction,
                rag_context=rag_context,
                plan_timeouts=plan_timeouts,
                rag_metadata=rag_metadata,
            )

            workflow_context_data = {
                "selected_tasks": selected_tasks,
                "requirements_spec": self.state.get("requirements_spec"),  # Include requirements spec
            }

            workflow_context = {
                "pipeline": pipeline,
                "initial_data": {
                    "nlp_input": nlp_input,
                    "network": network,
                    "workflow_id": workflow_id,
                    "wallet_address": wallet_address,
                    "use_gasless": use_gasless,
                    "signed_transaction": signed_transaction,
                    "rag_context": rag_context,
                    "plan_timeouts": plan_timeouts,
                    "rag_metadata": rag_metadata,
                    "selected_tasks": selected_tasks,
                    "requirements_spec": self.state.get("requirements_spec"),  # Include requirements spec
                    "workflow_context": workflow_context_data,  # Include workflow_context in initial_data
                },
            }

            # Execute pipeline
            result = await self.orchestrator.orchestrate(workflow_context)

            # Publish workflow completed
            await self.event_bus.publish(
                Event(
                    id=str(uuid.uuid4()),
                    type=EventType.WORKFLOW_COMPLETED,
                    workflow_id=workflow_id,
                    timestamp=datetime.now(),
                    data=result,
                    source_agent="coordinator",
                )
            )

            # Phase 5: Trigger reflection for successful workflow
            if self.reflection_agent and self.long_term_memory:
                try:
                    logger.info(f"Triggering reflection for successful workflow {workflow_id}")
                    workflow_data = {
                        "id": workflow_id,
                        "status": "completed",
                        "progress_percentage": 100,
                        "network": network,
                        "contract_type": result.get("contract_type", "Custom"),
                        "nlp_input": nlp_input,
                        "meta_data": self.state,
                        "stages": result.get("stages", []),
                    }
                    reflection = await self.reflection_agent.reflect_on_workflow(
                        workflow_id=workflow_id,
                        workflow_data=workflow_data,
                        outcome="success",
                    )
                    await self.long_term_memory.store_reflection(reflection)
                    logger.info(f"Reflection stored for workflow {workflow_id}")
                except Exception as e:
                    logger.error(f"Failed to perform reflection for workflow {workflow_id}: {e}", exc_info=True)
                    # Don't fail the workflow if reflection fails

            return {"status": "success", "workflow_id": self.workflow_id, "result": result}

        except Exception as e:
            # Preserve full error message for HyperAgentError exceptions
            if hasattr(e, 'message'):
                error_msg = e.message
            else:
                error_msg = str(e)
            
            await self.event_bus.publish(
                Event(
                    id=str(uuid.uuid4()),
                    type=EventType.WORKFLOW_FAILED,
                    workflow_id=workflow_id,
                    timestamp=datetime.now(),
                    data={"error": error_msg},
                    source_agent="coordinator",
                )
            )
            
            # Phase 5: Trigger reflection for failed workflow
            if self.reflection_agent and self.long_term_memory:
                try:
                    logger.info(f"Triggering reflection for failed workflow {workflow_id}")
                    workflow_data = {
                        "id": workflow_id,
                        "status": "failed",
                        "progress_percentage": self.state.get("progress_percentage", 0),
                        "network": network,
                        "contract_type": self.state.get("contract_type", "Custom"),
                        "nlp_input": nlp_input,
                        "error_message": error_msg,
                        "error_stacktrace": str(e),
                        "meta_data": self.state,
                        "retry_count": self.state.get("retry_count", 0),
                    }
                    reflection = await self.reflection_agent.reflect_on_workflow(
                        workflow_id=workflow_id,
                        workflow_data=workflow_data,
                        outcome="failure",
                    )
                    await self.long_term_memory.store_reflection(reflection)
                    logger.info(f"Reflection stored for failed workflow {workflow_id}")
                except Exception as reflection_error:
                    logger.error(f"Failed to perform reflection for failed workflow {workflow_id}: {reflection_error}", exc_info=True)
                    # Don't fail the workflow error handling if reflection fails
            
            return {"status": "failed", "workflow_id": self.workflow_id, "error": error_msg}

    async def execute_workflow_from_contract(
        self,
        workflow_id: str,
        contract_code: str,
        contract_type: str,
        network: str,
        constructor_args: Optional[List[Any]] = None,
        wallet_address: Optional[str] = None,
        use_gasless: bool = True,
        selected_tasks: Optional[List[str]] = None,  # NEW: Selected tasks to execute
    ) -> Dict[str, Any]:
        """
        Execute workflow pipeline starting from compilation stage
        (skips generation since contract is already generated)

        NOW REQUIRES: wallet_address for user-wallet-based deployment

        Pipeline Flow:
        1. Compile contract (CompilationService) - START HERE
        2. Audit contract (AuditService)
        3. Test contract (TestingService)
        4. Deploy contract (DeploymentService) - requires wallet_address
        """
        # Store selected tasks in state
        if selected_tasks is None:
            selected_tasks = ["compilation", "audit", "testing", "deployment"]
        
        # Validate wallet_address only if deployment is selected
        deployment_selected = "deployment" in [task.lower() for task in selected_tasks]
        
        if deployment_selected and not wallet_address:
            raise ValueError(
                "wallet_address is required for deployment. "
                "Please provide the user's wallet address or remove deployment from selected tasks."
            )

        # Validate wallet address format if provided
        if wallet_address:
            from hyperagent.utils.helpers import normalize_wallet_address, validate_wallet_address

            is_valid, error_msg = validate_wallet_address(wallet_address)
            if not is_valid:
                raise ValueError(f"Invalid wallet address: {error_msg}")

            # Normalize to checksum format
            wallet_address = normalize_wallet_address(wallet_address)

        self.workflow_id = workflow_id
        self.state = {
            "workflow_id": workflow_id,
            "contract_code": contract_code,
            "contract_type": contract_type,
            "network": network,
            "stages_completed": ["generation"],  # Mark generation as already done
            "selected_tasks": selected_tasks,  # Store selected tasks
        }

        # Publish workflow started
        await self.event_bus.publish(
            Event(
                id=str(uuid.uuid4()),
                type=EventType.WORKFLOW_STARTED,
                workflow_id=workflow_id,
                timestamp=datetime.now(),
                data=self.state,
                source_agent="coordinator",
            )
        )

        try:
            # Build pipeline dynamically based on selected tasks (skip generation)
            if selected_tasks is None:
                selected_tasks = ["compilation", "audit", "testing", "deployment"]
            
            # Ensure compilation is included if other tasks are selected
            if any(task in selected_tasks for task in ["audit", "testing", "deployment"]):
                if "compilation" not in selected_tasks:
                    selected_tasks.insert(0, "compilation")
            
            pipeline = self._build_pipeline_from_tasks(
                selected_tasks=selected_tasks,
                nlp_input="",  # Not used for contract-based workflow
                network=network,
                workflow_id=workflow_id,
                wallet_address=wallet_address,
                use_gasless=use_gasless,
                signed_transaction=None,
                rag_context="",
                plan_timeouts={},
                rag_metadata={},
            )

            # Extract contract name from code (simple heuristic)
            contract_name = "GeneratedContract"
            if "contract" in contract_code.lower():
                # Try to extract contract name
                import re

                match = re.search(r"contract\s+(\w+)", contract_code)
                if match:
                    contract_name = match.group(1)

            workflow_context = {
                "pipeline": pipeline,
                "initial_data": {
                    "contract_code": contract_code,
                    "contract_type": contract_type,
                    "contract_name": contract_name,
                    "network": network,
                    "wallet_address": wallet_address,  # REQUIRED: Pass wallet address
                    "use_gasless": use_gasless,  # Pass gasless option
                    "signed_transaction": None,  # Can be provided later via frontend
                    "workflow_id": workflow_id,
                    "constructor_args": constructor_args or [],
                    "wallet_address": wallet_address,
                    "use_gasless": use_gasless,
                },
            }

            # Execute pipeline (starts from compilation)
            result = await self.orchestrator.orchestrate(workflow_context)

            # Publish workflow completed
            await self.event_bus.publish(
                Event(
                    id=str(uuid.uuid4()),
                    type=EventType.WORKFLOW_COMPLETED,
                    workflow_id=workflow_id,
                    timestamp=datetime.now(),
                    data=result,
                    source_agent="coordinator",
                )
            )

            return {"status": "success", "workflow_id": self.workflow_id, "result": result}

        except Exception as e:
            # Preserve full error message for HyperAgentError exceptions
            if hasattr(e, 'message'):
                error_msg = e.message
            else:
                error_msg = str(e)
            
            await self.event_bus.publish(
                Event(
                    id=str(uuid.uuid4()),
                    type=EventType.WORKFLOW_FAILED,
                    workflow_id=workflow_id,
                    timestamp=datetime.now(),
                    data={"error": error_msg},
                    source_agent="coordinator",
                )
            )
            return {"status": "failed", "workflow_id": self.workflow_id, "error": error_msg}
