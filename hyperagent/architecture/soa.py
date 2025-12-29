"""Service-Oriented Architecture implementation"""

from typing import Any, Dict, List

from hyperagent.core.agent_system import ServiceInterface


class ServiceRegistry:
    """Central registry for service lookup"""

    def __init__(self):
        self._services: Dict[str, ServiceInterface] = {}
        self._metadata: Dict[str, Dict[str, Any]] = {}

    def register(self, name: str, service: ServiceInterface, metadata: Dict[str, Any] = None):
        """
        Register a service

        Example:
            registry.register(
                "generation",
                GenerationService(llm_provider),
                {"version": "1.0", "sla": {"p99": 45000}}
            )
        """
        self._services[name] = service
        self._metadata[name] = metadata or {}

    def get_service(self, name: str) -> ServiceInterface:
        """Retrieve service by name (throws if not found)"""
        if name not in self._services:
            raise ValueError(f"Service '{name}' not found")
        return self._services[name]

    def list_services(self) -> List[str]:
        """List all registered service names"""
        return list(self._services.keys())


class SequentialOrchestrator:
    """Execute services sequentially in pipeline pattern"""

    def __init__(self, registry: ServiceRegistry, event_bus, progress_callback=None):
        self.registry = registry
        self.event_bus = event_bus
        self.progress_callback = progress_callback

    async def orchestrate(self, workflow_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute services sequentially"""
        pipeline = workflow_context.get("pipeline", [])
        result = workflow_context.get("initial_data", {})
        initial_data = result.copy()  # Keep a reference to initial_data for fallback

        for stage_index, stage in enumerate(pipeline):
            service_name = stage["service"]
            service = self.registry.get_service(service_name)

            request = self._map_inputs(stage, result, initial_data)

            if not await service.validate(request):
                raise ValueError(f"Validation failed for {service_name}")

            service_result = await service.process(request)

            if isinstance(service_result, dict):
                result[f"{service_name}_result"] = service_result

                if service_name == "deployment":
                    result["deployment"] = service_result
                    result["deployment_result"] = service_result

                for key, value in service_result.items():
                    if key not in result or result[key] is None:
                        result[key] = value
                    elif isinstance(result[key], dict) and isinstance(value, dict):
                        result[key].update(value)
                    else:
                        result[key] = value
            else:
                result[f"{service_name}_result"] = service_result

            if self.progress_callback:
                try:
                    # Stage progress mapping (progress percentage)
                    # When starting from contract (skipping generation), adjust percentages
                    # Generation = 0-20%, Compilation = 20-40%, Audit = 40-60%, Testing = 60-80%, Deployment = 80-100%
                    stage_progress_map = {
                        "generation": 20,
                        "compilation": 40,
                        "audit": 60,
                        "testing": 80,
                        "deployment": 100,
                    }
                    # Stage status mapping (workflow status enum values)
                    # Note: "compiling" may not be in WorkflowStatus enum, use "generating" as fallback
                    stage_status_map = {
                        "generation": "generating",
                        "compilation": "generating",  # Compilation happens after generation, keep same status
                        "audit": "auditing",
                        "testing": "testing",
                        "deployment": "deploying",  # Will be updated to "completed" if successful
                    }
                    progress = stage_progress_map.get(service_name, 0)
                    status = stage_status_map.get(service_name, service_name)

                    # For deployment, check if it was successful or skipped before marking as completed
                    if service_name == "deployment" and isinstance(service_result, dict):
                        if service_result.get("status") == "success":
                            # Deployment succeeded - mark as completed immediately
                            status = "completed"
                            progress = 100
                        elif service_result.get("status") == "skipped":
                            # Deployment skipped (requires user signature) - mark as completed
                            # Frontend will handle deployment separately
                            status = "completed"
                            progress = 100
                        else:
                            # Deployment failed - keep as deploying (will be updated to failed later)
                            status = "deploying"

                    await self.progress_callback(status, progress)
                except Exception as e:
                    # Log but don't fail workflow if progress callback fails
                    import logging

                    logger = logging.getLogger(__name__)
                    logger.error(f"Failed to call progress callback: {e}")

            # Publish progress event (skip if event_bus is not properly initialized)
            try:
                import uuid
                from datetime import datetime

                from hyperagent.events.event_types import Event, EventType

                # Get workflow_id from context if available
                workflow_id = workflow_context.get("initial_data", {}).get("workflow_id", "unknown")

                progress_event = Event(
                    id=str(uuid.uuid4()),
                    type=EventType.WORKFLOW_STARTED,  # Use appropriate event type
                    workflow_id=str(workflow_id),
                    timestamp=datetime.now(),
                    data={"stage": stage_index, "service": service_name, "result": service_result},
                    source_agent="orchestrator",
                )
                await self.event_bus.publish(progress_event)
            except Exception as e:
                # Log but don't fail workflow if event publishing fails
                print(f"Failed to publish progress event: {e}")

        return result

    def _map_inputs(self, stage: Dict, previous_output: Dict, initial_data: Dict = None) -> Dict:
        """Map previous stage output to current stage input

        Args:
            stage: Stage configuration with input_mapping
            previous_output: Output from previous stage (accumulated result)
            initial_data: Original initial_data from workflow_context (for fallback)
        """
        request = {}

        # Static inputs from stage config
        if "inputs" in stage:
            request.update(stage["inputs"])

        # Dynamic inputs from previous output
        if "input_mapping" in stage:
            for target_key, source_key in stage["input_mapping"].items():
                # First check previous_output (from previous stages)
                if source_key in previous_output:
                    request[target_key] = previous_output[source_key]
                # Fallback to initial_data if not in previous_output
                # This ensures values like wallet_address and use_gasless persist through all stages
                elif initial_data and source_key in initial_data:
                    request[target_key] = initial_data[source_key]

        return request
