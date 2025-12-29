"""Workflow coordinator orchestrator"""

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from hyperagent.architecture.soa import SequentialOrchestrator, ServiceRegistry
from hyperagent.cache.redis_manager import RedisManager
from hyperagent.core.agent_system import WorkflowStage
from hyperagent.core.planning.roma_planner import ROMAPlanner
from hyperagent.core.routing.multi_model_router import MultiModelRouter
from hyperagent.events.event_bus import EventBus
from hyperagent.events.event_types import Event, EventType
from hyperagent.rag.firecrawl_rag import FirecrawlRAG

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
    ):
        self.registry = service_registry
        self.event_bus = event_bus
        self.orchestrator = SequentialOrchestrator(service_registry, event_bus, progress_callback)
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
        optimize_for_metisvm: bool,
        enable_floating_point: bool,
        enable_ai_inference: bool,
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
            pipeline.append({
                "service": "generation",
                "input_mapping": {
                    "nlp_description": "nlp_input",
                    "network": "network",
                    "optimize_for_metisvm": "optimize_for_metisvm",
                    "enable_floating_point": "enable_floating_point",
                    "enable_ai_inference": "enable_ai_inference",
                    "wallet_address": "wallet_address",
                    "rag_context": "rag_context",
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
        optimize_for_metisvm: bool = False,
        enable_floating_point: bool = False,
        enable_ai_inference: bool = False,
        wallet_address: Optional[str] = None,  # REQUIRED: User wallet address
        use_gasless: bool = False,  # Use facilitator for gasless deployment
        signed_transaction: Optional[str] = None,  # Pre-signed transaction (optional)
        selected_tasks: Optional[List[str]] = None,  # NEW: Selected tasks to execute
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
        # Validate wallet_address is provided (required for deployment)
        if not wallet_address:
            raise ValueError(
                "wallet_address is required for all workflows. "
                "Please provide the user's wallet address for deployment. "
                "No PRIVATE_KEY is needed - deployments are user-controlled."
            )

        # Validate wallet address format
        from hyperagent.utils.helpers import normalize_wallet_address, validate_wallet_address

        is_valid, error_msg = validate_wallet_address(wallet_address)
        if not is_valid:
            raise ValueError(f"Invalid wallet address: {error_msg}")

        # Normalize to checksum format
        wallet_address = normalize_wallet_address(wallet_address)

        self.workflow_id = workflow_id

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

        self.state = {
            "workflow_id": workflow_id,
            "nlp_input": nlp_input,
            "network": network,
            "stages_completed": [],
            "optimize_for_metisvm": optimize_for_metisvm,
            "enable_floating_point": enable_floating_point,
            "enable_ai_inference": enable_ai_inference,
            "roma_plan": plan.to_dict() if hasattr(plan, "to_dict") else plan if plan else None,
            "rag_context": rag_context,
            "plan_timeouts": plan_timeouts,
            "rag_metadata": rag_metadata,
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
            # Build pipeline dynamically based on selected tasks
            pipeline = self._build_pipeline_from_tasks(
                selected_tasks=selected_tasks,
                nlp_input=nlp_input,
                network=network,
                workflow_id=workflow_id,
                optimize_for_metisvm=optimize_for_metisvm,
                enable_floating_point=enable_floating_point,
                enable_ai_inference=enable_ai_inference,
                wallet_address=wallet_address,
                use_gasless=use_gasless,
                signed_transaction=signed_transaction,
                rag_context=rag_context,
                plan_timeouts=plan_timeouts,
                rag_metadata=rag_metadata,
            )

            workflow_context = {
                "pipeline": pipeline,
                "initial_data": {
                    "nlp_input": nlp_input,
                    "network": network,
                    "workflow_id": workflow_id,
                    "optimize_for_metisvm": optimize_for_metisvm,
                    "enable_floating_point": enable_floating_point,
                    "enable_ai_inference": enable_ai_inference,
                    "wallet_address": wallet_address,
                    "use_gasless": use_gasless,
                    "signed_transaction": signed_transaction,
                    "rag_context": rag_context,
                    "plan_timeouts": plan_timeouts,
                    "rag_metadata": rag_metadata,
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

            return {"status": "success", "workflow_id": self.workflow_id, "result": result}

        except Exception as e:
            await self.event_bus.publish(
                Event(
                    id=str(uuid.uuid4()),
                    type=EventType.WORKFLOW_FAILED,
                    workflow_id=workflow_id,
                    timestamp=datetime.now(),
                    data={"error": str(e)},
                    source_agent="coordinator",
                )
            )
            return {"status": "failed", "workflow_id": self.workflow_id, "error": str(e)}

    async def execute_workflow_from_contract(
        self,
        workflow_id: str,
        contract_code: str,
        contract_type: str,
        network: str,
        constructor_args: Optional[List[Any]] = None,
        optimize_for_metisvm: bool = False,
        enable_floating_point: bool = False,
        enable_ai_inference: bool = False,
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
        # Validate wallet_address is provided (required for deployment)
        if not wallet_address:
            raise ValueError(
                "wallet_address is required for all workflows. "
                "Please provide the user's wallet address for deployment. "
                "No PRIVATE_KEY is needed - deployments are user-controlled."
            )

        # Validate wallet address format
        from hyperagent.utils.helpers import normalize_wallet_address, validate_wallet_address

        is_valid, error_msg = validate_wallet_address(wallet_address)
        if not is_valid:
            raise ValueError(f"Invalid wallet address: {error_msg}")

        # Normalize to checksum format
        wallet_address = normalize_wallet_address(wallet_address)

        # Store selected tasks in state
        if selected_tasks is None:
            selected_tasks = ["compilation", "audit", "testing", "deployment"]

        self.workflow_id = workflow_id
        self.state = {
            "workflow_id": workflow_id,
            "contract_code": contract_code,
            "contract_type": contract_type,
            "network": network,
            "stages_completed": ["generation"],  # Mark generation as already done
            "optimize_for_metisvm": optimize_for_metisvm,
            "enable_floating_point": enable_floating_point,
            "enable_ai_inference": enable_ai_inference,
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
                optimize_for_metisvm=optimize_for_metisvm,
                enable_floating_point=enable_floating_point,
                enable_ai_inference=enable_ai_inference,
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
                    "optimize_for_metisvm": optimize_for_metisvm,
                    "enable_floating_point": enable_floating_point,
                    "enable_ai_inference": enable_ai_inference,
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
            await self.event_bus.publish(
                Event(
                    id=str(uuid.uuid4()),
                    type=EventType.WORKFLOW_FAILED,
                    workflow_id=workflow_id,
                    timestamp=datetime.now(),
                    data={"error": str(e)},
                    source_agent="coordinator",
                )
            )
            return {"status": "failed", "workflow_id": self.workflow_id, "error": str(e)}
