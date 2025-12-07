"""Coordinator Agent implementation"""

import asyncio
import logging
import traceback
import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from hyperagent.core.agent_system import ServiceInterface, WorkflowStage
from hyperagent.core.config import settings
from hyperagent.core.orchestrator import WorkflowCoordinator
from hyperagent.events.event_bus import EventBus
from hyperagent.events.event_types import Event, EventType

logger = logging.getLogger(__name__)


class CoordinatorAgent(ServiceInterface):
    """
    Coordinator Agent

    Concept: Orchestrates workflow execution
    Logic: Manages state, coordinates agents, handles errors
    SLA: p99 < 800s, p95 < 600s
    """

    def __init__(
        self,
        workflow_coordinator: WorkflowCoordinator,
        event_bus: Optional[EventBus] = None,
        redis_client=None,
    ):
        self.coordinator = workflow_coordinator
        self.event_bus = event_bus or workflow_coordinator.event_bus
        self.redis_client = redis_client
        self.workflow_id = None
        self.state = {}

    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute complete workflow with error handling and retry logic

        Logic:
            1. Check for cancellation flag
            2. Execute workflow
            3. Handle errors with retry logic
            4. Persist state
        """
        workflow_id = input_data["workflow_id"]
        nlp_input = input_data["nlp_input"]
        network = input_data["network"]

        self.workflow_id = workflow_id
        self.state = {
            "workflow_id": workflow_id,
            "nlp_input": nlp_input,
            "network": network,
            "retry_count": 0,
            "current_stage": None,
        }

        # Check for cancellation
        if await self._is_cancelled(workflow_id):
            return await self._handle_cancellation(workflow_id)

        try:
            result = await self.coordinator.execute_workflow(workflow_id, nlp_input, network)

            # Update state on success
            self.state["status"] = "completed"
            await self._persist_state()

            return result
        except Exception as e:
            await self.on_error(e)
            raise

    async def validate(self, data: Dict[str, Any]) -> bool:
        """Validate workflow input"""
        return bool(data.get("workflow_id") and data.get("nlp_input") and data.get("network"))

    async def on_error(self, error: Exception) -> None:
        """
        Handle coordinator errors with retry logic

        Concept: Exponential backoff retry with state persistence
        Logic:
            1. Log error with context
            2. Update workflow state to FAILED
            3. Persist state to database/cache
            4. Publish error event
            5. Attempt retry if retry_count < max_retries
        """
        # Log error with full context
        logger.error(
            f"Coordinator error for workflow {self.workflow_id}",
            exc_info=error,
            extra={
                "workflow_id": self.workflow_id,
                "current_stage": self.state.get("current_stage"),
                "retry_count": self.state.get("retry_count", 0),
            },
        )

        # Update workflow state
        self.state["status"] = WorkflowStage.FAILED.value
        self.state["error_message"] = str(error)
        self.state["error_stacktrace"] = traceback.format_exc()
        self.state["retry_count"] = self.state.get("retry_count", 0) + 1

        # Persist state
        await self._persist_state()

        # Publish error event
        await self.event_bus.publish(
            Event(
                id=str(uuid.uuid4()),
                type=EventType.WORKFLOW_FAILED,
                workflow_id=self.workflow_id or "unknown",
                timestamp=datetime.now(),
                data={
                    "error": str(error),
                    "retry_count": self.state["retry_count"],
                    "can_retry": self.state["retry_count"] < settings.max_retries,
                    "current_stage": self.state.get("current_stage"),
                },
                source_agent="coordinator",
            )
        )

        # Retry logic
        if self.state["retry_count"] < settings.max_retries:
            wait_time = (
                settings.retry_backoff_base ** self.state["retry_count"]
            )  # Exponential backoff
            logger.info(
                f"Retrying workflow {self.workflow_id} after {wait_time}s (attempt {self.state['retry_count']})"
            )
            await asyncio.sleep(wait_time)

            # Retry execution
            try:
                result = await self.coordinator.execute_workflow(
                    self.workflow_id, self.state["nlp_input"], self.state["network"]
                )
                self.state["status"] = "completed"
                await self._persist_state()
                return result
            except Exception as retry_error:
                # If retry also fails, increment count and try again (up to max)
                if self.state["retry_count"] < settings.max_retries:
                    await self.on_error(retry_error)
                else:
                    logger.error(
                        f"Workflow {self.workflow_id} failed after {settings.max_retries} retries"
                    )

    async def cancel_workflow(self, workflow_id: str) -> Dict[str, Any]:
        """
        Cancel running workflow

        Concept: Graceful cancellation with cleanup
        Logic:
            1. Set cancellation flag in Redis
            2. Stop current agent execution
            3. Clean up resources
            4. Update state to CANCELLED
        """
        # Set cancellation flag in Redis
        if self.redis_client:
            await self.redis_client.set(f"workflow:{workflow_id}:cancelled", "true", ex=3600)

        # Update state
        self.state["status"] = WorkflowStage.CANCELLED.value
        self.state["cancelled_at"] = datetime.now().isoformat()
        await self._persist_state()

        # Publish cancellation event
        await self.event_bus.publish(
            Event(
                id=str(uuid.uuid4()),
                type=EventType.WORKFLOW_CANCELLED,
                workflow_id=workflow_id,
                timestamp=datetime.now(),
                data={"reason": "User requested cancellation"},
                source_agent="coordinator",
            )
        )

        return {"status": "cancelled", "workflow_id": workflow_id}

    async def _is_cancelled(self, workflow_id: str) -> bool:
        """Check if workflow is cancelled"""
        if not self.redis_client:
            return False
        try:
            cancelled = await self.redis_client.get(f"workflow:{workflow_id}:cancelled")
            return cancelled == "true"
        except Exception:
            return False

    async def _handle_cancellation(self, workflow_id: str) -> Dict[str, Any]:
        """Handle workflow cancellation"""
        return await self.cancel_workflow(workflow_id)

    async def _persist_state(self) -> None:
        """Persist workflow state to cache/database"""
        if not self.workflow_id:
            return

        # Persist to Redis cache
        if self.redis_client:
            try:
                await self.redis_client.set(
                    f"workflow:{self.workflow_id}:state", str(self.state), ex=86400  # 24 hours
                )
            except Exception as e:
                logger.warning(f"Failed to persist state to Redis: {e}")

        # TODO: Persist to database via Workflow model
        # This would require database session injection
