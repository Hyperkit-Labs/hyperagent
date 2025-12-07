"""Event bus implementation using Redis Streams with in-memory fallback"""

import json
import logging
import uuid
from datetime import datetime
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional

import redis.asyncio as redis

from hyperagent.events.event_types import Event, EventType

logger = logging.getLogger(__name__)


class EventBus:
    """
    Event Bus Pattern with Redis Streams and in-memory fallback

    Concept: Central hub for event publishing/subscribing
    Logic: Publishers send events, subscribers receive via Redis Streams (or in-memory queue)
    Benefits: Decoupling, scalability, persistence (with Redis), graceful degradation (without Redis)
    """

    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self._handlers: Dict[EventType, List[Callable[..., Any]]] = {}
        self._fallback_queue: List[Event] = []  # In-memory fallback queue
        self._redis_available = redis_client is not None

    async def publish(self, event: Event) -> None:
        """
        Publish event to Redis Stream (with in-memory fallback)

        Logic Flow:
        1. Try to store in Redis Stream (if available)
        2. If Redis fails, use in-memory queue
        3. Always notify local subscribers
        4. Return immediately (async)
        """
        # Try Redis first (if available)
        if self.redis and self._redis_available:
            try:
                stream_key = f"events:{event.type.value}"
                await self.redis.xadd(
                    stream_key, {"data": json.dumps(event.to_dict())}, id="*"  # Auto-generate ID
                )
            except Exception as e:
                logger.warning(f"Redis unavailable, using in-memory fallback: {e}")
                self._redis_available = False
                # Fallback to in-memory queue
                self._fallback_queue.append(event)
        else:
            # No Redis available, use in-memory queue
            self._fallback_queue.append(event)

        # Always notify local handlers (works without Redis)
        if event.type in self._handlers:
            for handler in self._handlers[event.type]:
                try:
                    await handler(event)
                except Exception as e:
                    logger.error(f"Handler error: {e}", exc_info=True)

    def subscribe(self, event_type: EventType, handler: Callable):
        """
        Subscribe to event type

        Example:
            async def on_generation_complete(event: Event):
                print(f"Contract generated: {event.data['contract_code']}")

            event_bus.subscribe(EventType.GENERATION_COMPLETED, on_generation_complete)
        """
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)

    async def consume_stream(
        self, event_type: EventType, consumer_group: str = "default"
    ) -> AsyncGenerator[Event, None]:
        """
        Consume events from Redis Stream

        Logic: Read events from stream, process, acknowledge
        Use Case: Background workers processing events
        """
        stream_key = f"events:{event_type.value}"

        # Create consumer group if not exists
        try:
            await self.redis.xgroup_create(stream_key, consumer_group, id="0", mkstream=True)
        except redis.ResponseError:
            pass  # Group already exists

        while True:
            # Read events
            messages = await self.redis.xreadgroup(
                consumer_group, "worker-1", {stream_key: ">"}, count=10, block=1000
            )

            for stream, events in messages:
                for event_id, event_data in events:
                    # Process event
                    event_dict = json.loads(event_data[b"data"])
                    # Reconstruct Event object
                    event = Event(
                        id=event_dict["id"],
                        type=EventType(event_dict["type"]),
                        workflow_id=event_dict["workflow_id"],
                        timestamp=datetime.fromisoformat(event_dict["timestamp"]),
                        data=event_dict["data"],
                        source_agent=event_dict["source_agent"],
                        metadata=event_dict.get("metadata"),
                    )

                    # Acknowledge
                    await self.redis.xack(stream_key, consumer_group, event_id)

                    yield event
