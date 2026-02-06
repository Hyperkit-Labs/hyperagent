"""Service-Oriented Architecture implementation"""

import logging
from typing import Any, Dict, List, Optional

from hyperagent.core.agent_system import ServiceInterface
from hyperagent.core.agents.error_analyzer import ErrorAnalyzer
from hyperagent.core.agents.fix_generator import FixGenerator

logger = logging.getLogger(__name__)


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

    def __init__(
        self,
        registry: ServiceRegistry,
        event_bus,
        progress_callback=None,
        error_analyzer: Optional[ErrorAnalyzer] = None,
        fix_generator: Optional[FixGenerator] = None,
    ):
        self.registry = registry
        self.event_bus = event_bus
        self.progress_callback = progress_callback
        self.error_analyzer = error_analyzer
        self.fix_generator = fix_generator

    async def orchestrate(self, workflow_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute services sequentially"""
        pipeline = workflow_context.get("pipeline", [])
        result = workflow_context.get("initial_data", {})
        initial_data = result.copy()  # Keep a reference to initial_data for fallback

        # Ensure workflow_context is available in result for deployment service
        if "workflow_context" not in result:
            result["workflow_context"] = initial_data.get("workflow_context", {})

        for stage_index, stage in enumerate(pipeline):
            service_name = stage["service"]
            service = self.registry.get_service(service_name)

            request = self._map_inputs(stage, result, initial_data)

            if not await service.validate(request):
                error_msg = f"Validation failed for {service_name}"
                result["error"] = error_msg
                result[f"{service_name}_error"] = error_msg
                raise ValueError(error_msg)

            # Use feedback loop for compilation and audit services
            try:
                if service_name == "compilation" and self.error_analyzer and self.fix_generator:
                    service_result = await self._process_with_feedback_loop(
                        service, request, max_retries=3, error_type="compilation"
                    )
                elif service_name == "audit" and self.error_analyzer and self.fix_generator:
                    service_result = await self._process_with_feedback_loop(
                        service, request, max_retries=2, error_type="audit"
                    )
                else:
                    # Standard processing without feedback loop
                    service_result = await service.process(request)
            except Exception as service_error:
                # Handle exceptions from services that don't use feedback loops
                # (services that still raise exceptions instead of returning error dicts)
                error_msg = str(service_error)
                if hasattr(service_error, 'message'):
                    error_msg = service_error.message
                
                error_details = {
                    "service": service_name,
                    "error": error_msg,
                    "error_type": type(service_error).__name__,
                }
                
                result["error"] = error_msg
                result[f"{service_name}_error"] = error_msg
                result[f"{service_name}_error_details"] = error_details
                
                raise ValueError(f"{service_name} failed: {error_msg}") from service_error

            # Check if result indicates an error (structured error response)
            if isinstance(service_result, dict) and service_result.get("status") == "error":
                # Handle structured error response
                error_info = service_result.get("error", {})
                error_msg = error_info.get("message", "Unknown error")
                error_type_name = error_info.get("type", "UnknownError")
                
                # Store error information
                result["error"] = error_msg
                result[f"{service_name}_error"] = error_msg
                result[f"{service_name}_error_details"] = error_info
                
                # Raise exception to stop workflow
                raise ValueError(f"{service_name} failed: {error_msg}")

            # Process result and merge into workflow context
            if isinstance(service_result, dict):
                result[f"{service_name}_result"] = service_result

                # Store service-specific results with standardized keys for downstream services
                if service_name == "deployment":
                    result["deployment"] = service_result
                    result["deployment_result"] = service_result
                elif service_name == "testing":
                    # Store test results with standardized key for deployment service
                    result["test_result"] = service_result
                    # Also store in workflow_context for deployment service access
                    if "workflow_context" not in result:
                        result["workflow_context"] = {}
                    if not isinstance(result["workflow_context"], dict):
                        result["workflow_context"] = {}
                    result["workflow_context"]["test_result"] = service_result
                elif service_name == "audit":
                    # Store audit results with standardized key for deployment service
                    result["audit_result"] = service_result
                    # Also store in workflow_context for deployment service access
                    if "workflow_context" not in result:
                        result["workflow_context"] = {}
                    if not isinstance(result["workflow_context"], dict):
                        result["workflow_context"] = {}
                    result["workflow_context"]["audit_result"] = service_result

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

    async def _process_with_feedback_loop(
        self,
        service: ServiceInterface,
        request: Dict[str, Any],
        max_retries: int,
        error_type: str,
    ) -> Dict[str, Any]:
        """
        Process service with feedback loop for automatic error fixing

        Args:
            service: Service to process
            request: Request data
            max_retries: Maximum number of retry attempts
            error_type: Type of error ("compilation" or "audit")

        Returns:
            Service result dictionary
        """
        retry_count = 0
        last_error = None
        contract_code = request.get("contract_code") or request.get("contract_code")
        original_prompt = request.get("nlp_description") or request.get("original_prompt")

        # Initialize feedback loops tracking
        feedback_loops = []

        while retry_count <= max_retries:
            try:
                # Process service
                service_result = await service.process(request)

                # Check if result indicates success
                if isinstance(service_result, dict):
                    if service_result.get("status") == "success":
                        # Success - return result with feedback loop info
                        if feedback_loops:
                            service_result["feedback_loops"] = feedback_loops
                        return service_result
                    elif service_result.get("status") == "error":
                        # Structured error response
                        error_info = service_result.get("error", {})
                        last_error = Exception(error_info.get("message", "Unknown error"))
                    else:
                        # Assume success if status is not explicitly error
                        if feedback_loops:
                            service_result["feedback_loops"] = feedback_loops
                        return service_result
                else:
                    # Non-dict result - assume success
                    if feedback_loops:
                        return {"status": "success", "result": service_result, "feedback_loops": feedback_loops}
                    return service_result

            except Exception as service_error:
                last_error = service_error
                retry_count += 1

                if retry_count > max_retries:
                    logger.warning(
                        f"{error_type} failed after {max_retries} retries. "
                        f"Last error: {last_error}"
                    )
                    # Return structured error
                    error_msg = str(last_error)
                    return {
                        "status": "error",
                        "error": {
                            "type": type(last_error).__name__,
                            "message": error_msg,
                            "original_error": error_msg,
                            "retry_count": retry_count - 1,
                            "max_retries": max_retries,
                        },
                        "feedback_loops": feedback_loops,
                    }

                # Analyze error
                logger.info(
                    f"{error_type} failed (attempt {retry_count}/{max_retries + 1}). "
                    f"Analyzing error and generating fix..."
                )

                try:
                    # Analyze error
                    if error_type == "compilation":
                        error_analysis = await self.error_analyzer.analyze_compilation_error(
                            last_error, contract_code or ""
                        )
                    else:  # audit
                        # For audit, we need audit_result from previous attempt
                        audit_result = {
                            "vulnerabilities": [],
                            "overall_risk_score": 100,
                            "audit_status": "failed",
                        }
                        error_analysis = await self.error_analyzer.analyze_audit_failure(audit_result)

                    # Check if error is fixable
                    if not error_analysis.fixable:
                        logger.warning(
                            f"{error_type} error is not fixable automatically. "
                            f"Stopping retries."
                        )
                        return {
                            "status": "error",
                            "error": {
                                "type": error_analysis.error_type,
                                "message": error_analysis.message,
                                "fixable": False,
                                "retry_count": retry_count - 1,
                            },
                            "feedback_loops": feedback_loops,
                        }

                    # Generate fix suggestion
                    fix_suggestion = await self.error_analyzer.suggest_fix(
                        error_analysis, contract_code or ""
                    )

                    # Generate fixed code
                    if contract_code:
                        fixed_code = await self.fix_generator.generate_fix(
                            contract_code,
                            error_analysis,
                            fix_suggestion,
                            original_prompt,
                        )

                        # Update request with fixed code
                        request["contract_code"] = fixed_code
                        contract_code = fixed_code

                        # Track feedback loop
                        feedback_loops.append(
                            {
                                "attempt": retry_count,
                                "error_analysis": error_analysis.dict(),
                                "fix_suggestion": fix_suggestion.dict(),
                                "strategy": fix_suggestion.strategy.value,
                            }
                        )

                        logger.info(
                            f"Generated fix using strategy: {fix_suggestion.strategy.value}. "
                            f"Retrying {error_type}..."
                        )
                    else:
                        logger.warning(
                            f"No contract code available for fix generation. "
                            f"Stopping retries."
                        )
                        return {
                            "status": "error",
                            "error": {
                                "type": error_analysis.error_type,
                                "message": error_analysis.message,
                                "fixable": True,
                                "retry_count": retry_count - 1,
                                "reason": "No contract code available for fix",
                            },
                            "feedback_loops": feedback_loops,
                        }

                except Exception as fix_error:
                    logger.error(
                        f"Failed to generate fix for {error_type} error: {fix_error}",
                        exc_info=True,
                    )
                    # Return error with feedback loop info
                    return {
                        "status": "error",
                        "error": {
                            "type": type(last_error).__name__,
                            "message": str(last_error),
                            "fix_generation_failed": str(fix_error),
                            "retry_count": retry_count - 1,
                        },
                        "feedback_loops": feedback_loops,
                    }

        # Should not reach here, but return error if we do
        return {
            "status": "error",
            "error": {
                "type": "MaxRetriesExceeded",
                "message": f"{error_type} failed after {max_retries} retries",
                "retry_count": retry_count - 1,
            },
            "feedback_loops": feedback_loops,
        }
