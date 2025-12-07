"""Workflow coordinator orchestrator"""

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from hyperagent.architecture.soa import SequentialOrchestrator, ServiceRegistry
from hyperagent.core.agent_system import WorkflowStage
from hyperagent.events.event_bus import EventBus
from hyperagent.events.event_types import Event, EventType


class WorkflowCoordinator:
    """
    Workflow Coordinator

    Concept: Orchestrates complete workflow pipeline
    Logic: Manages state transitions, coordinates agents, handles errors
    Pattern: Service Orchestration Pattern (SOP)
    """

    def __init__(
        self, service_registry: ServiceRegistry, event_bus: EventBus, progress_callback=None
    ):
        self.registry = service_registry
        self.event_bus = event_bus
        self.orchestrator = SequentialOrchestrator(service_registry, event_bus, progress_callback)
        self.workflow_id = None
        self.state = {}

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
        self.state = {
            "workflow_id": workflow_id,
            "nlp_input": nlp_input,
            "network": network,
            "stages_completed": [],
            "optimize_for_metisvm": optimize_for_metisvm,
            "enable_floating_point": enable_floating_point,
            "enable_ai_inference": enable_ai_inference,
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
            # Define pipeline stages
            pipeline = [
                {
                    "service": "generation",
                    "input_mapping": {
                        "nlp_description": "nlp_input",
                        "network": "network",
                        "optimize_for_metisvm": "optimize_for_metisvm",
                        "enable_floating_point": "enable_floating_point",
                        "enable_ai_inference": "enable_ai_inference",
                        "wallet_address": "wallet_address",  # Pass wallet address for constructor defaults
                    },
                },
                {"service": "compilation", "input_mapping": {"contract_code": "contract_code"}},
                {"service": "audit", "input_mapping": {"contract_code": "contract_code"}},
                {
                    "service": "testing",
                    "input_mapping": {
                        "contract_code": "contract_code",
                        "contract_name": "contract_name",
                        "network": "network",
                        "compiled_contract": "compiled_contract",  # Pass compiled contract from CompilationService
                        "workflow_id": "workflow_id",
                    },
                },
                {
                    "service": "deployment",
                    "input_mapping": {
                        "compiled_contract": "compiled_contract",
                        "network": "network",
                        "source_code": "contract_code",
                        "constructor_args": "constructor_args",
                        "wallet_address": "wallet_address",  # REQUIRED: Pass wallet address
                        "use_gasless": "use_gasless",  # Pass gasless option
                        "signed_transaction": "signed_transaction",  # Pass signed transaction if provided
                    },
                },
            ]

            workflow_context = {
                "pipeline": pipeline,
                "initial_data": {
                    "nlp_input": nlp_input,
                    "network": network,
                    "workflow_id": workflow_id,
                    "optimize_for_metisvm": optimize_for_metisvm,
                    "enable_floating_point": enable_floating_point,
                    "enable_ai_inference": enable_ai_inference,
                    "wallet_address": wallet_address,  # REQUIRED: Pass wallet address (used in generation for constructor defaults)
                    "use_gasless": use_gasless,  # Pass gasless option
                    "signed_transaction": signed_transaction,  # Pass signed transaction if provided
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
            # Define pipeline stages (skip generation)
            pipeline = [
                {"service": "compilation", "input_mapping": {"contract_code": "contract_code"}},
                {"service": "audit", "input_mapping": {"contract_code": "contract_code"}},
                {
                    "service": "testing",
                    "input_mapping": {
                        "contract_code": "contract_code",
                        "contract_name": "contract_name",
                        "network": "network",
                        "compiled_contract": "compiled_contract",
                        "workflow_id": "workflow_id",
                    },
                },
                {
                    "service": "deployment",
                    "input_mapping": {
                        "compiled_contract": "compiled_contract",
                        "network": "network",
                        "source_code": "contract_code",
                        "constructor_args": "constructor_args",
                        "wallet_address": "wallet_address",  # REQUIRED: Pass wallet address
                        "use_gasless": "use_gasless",  # Pass gasless option
                        "signed_transaction": "signed_transaction",  # Pass signed transaction if provided
                    },
                },
            ]

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
