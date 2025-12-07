"""Agent-to-Agent (A2A) Protocol Implementation"""

import asyncio
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict

from hyperagent.events.event_bus import EventBus
from hyperagent.events.event_types import Event, EventType


@dataclass
class A2AMessage:
    """
    Agent-to-Agent Message

    Concept: Structured message between agents
    Logic: Request/Response pattern with correlation tracking
    Fields:
        - sender_agent: Who sent the message
        - receiver_agent: Who should receive it
        - message_type: request, response, or event
        - correlation_id: Links request to response
        - payload: Actual data
    """

    sender_agent: str
    receiver_agent: str
    message_type: str  # "request", "response", "event"
    correlation_id: str
    payload: Dict[str, Any]
    timestamp: str
    retry_count: int = 0
    timeout_ms: int = 5000


class A2AProtocol:
    """
    Agent-to-Agent Communication Protocol

    Concept: Decoupled agent communication
    Logic: Agents send messages via event bus, wait for responses
    Benefits: Loose coupling, async communication, retry logic
    """

    def __init__(self, event_bus: EventBus):
        self.event_bus = event_bus
        self._pending_requests: Dict[str, asyncio.Future] = {}

    async def send_request(self, message: A2AMessage) -> Dict[str, Any]:
        """
        Send request and wait for response

        Logic Flow:
        1. Create future for response
        2. Store future with correlation_id
        3. Publish request event
        4. Wait for response (with timeout)
        5. Return response or raise timeout
        """
        future = asyncio.Future()
        self._pending_requests[message.correlation_id] = future

        # Publish request event
        event = Event(
            id=str(uuid.uuid4()),
            type=EventType.A2A_REQUEST,
            workflow_id=message.payload.get("workflow_id", ""),
            timestamp=datetime.now(),
            data=message.__dict__,
            source_agent=message.sender_agent,
        )
        await self.event_bus.publish(event)

        # Wait for response
        try:
            response = await asyncio.wait_for(future, timeout=message.timeout_ms / 1000)
            return response
        except asyncio.TimeoutError:
            # Retry logic
            if message.retry_count < 3:
                message.retry_count += 1
                await asyncio.sleep(2**message.retry_count)  # Exponential backoff
                return await self.send_request(message)
            raise
        finally:
            self._pending_requests.pop(message.correlation_id, None)

    async def send_response(self, correlation_id: str, response_data: Dict[str, Any]):
        """Send response back to requesting agent"""
        if correlation_id in self._pending_requests:
            self._pending_requests[correlation_id].set_result(response_data)
