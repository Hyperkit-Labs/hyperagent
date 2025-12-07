"""WebSocket support for real-time updates"""

import asyncio
import json
import logging
from typing import Dict, List

from fastapi import WebSocket, WebSocketDisconnect

from hyperagent.core.config import settings
from hyperagent.events.event_bus import EventBus
from hyperagent.events.event_types import Event, EventType

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    WebSocket Connection Manager

    Concept: Manages WebSocket connections for real-time updates
    Logic: Register connections, broadcast events, handle disconnections
    """

    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, workflow_id: str):
        """Accept WebSocket connection and register"""
        await websocket.accept()

        if workflow_id not in self.active_connections:
            self.active_connections[workflow_id] = []

        self.active_connections[workflow_id].append(websocket)

    def disconnect(self, websocket: WebSocket, workflow_id: str):
        """Remove WebSocket connection"""
        if workflow_id in self.active_connections:
            self.active_connections[workflow_id].remove(websocket)
            if not self.active_connections[workflow_id]:
                del self.active_connections[workflow_id]

    async def broadcast(self, workflow_id: str, message: dict):
        """Broadcast message to all connections for workflow"""
        if workflow_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[workflow_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    disconnected.append(connection)

            # Remove disconnected connections
            for conn in disconnected:
                self.disconnect(conn, workflow_id)


# Global connection manager
manager = ConnectionManager()


async def websocket_endpoint(websocket: WebSocket, workflow_id: str):
    """
    WebSocket endpoint for real-time workflow updates

    Concept: Subscribe to workflow events, broadcast to client
    Logic:
        1. Accept WebSocket connection
        2. Subscribe to workflow events via event bus
        3. Forward events to client
        4. Handle heartbeat/ping-pong
        5. Handle disconnection gracefully

    Args:
        websocket: WebSocket connection
        workflow_id: Workflow identifier to subscribe to
    """
    await manager.connect(websocket, workflow_id)
    logger.info(f"WebSocket connected for workflow {workflow_id}")

    # Get event bus instance (would be injected via dependency)
    # Redis is optional - EventBus has in-memory fallback
    import redis.asyncio as redis

    from hyperagent.core.config import settings

    redis_client = None
    if settings.redis_url:
        try:
            redis_client = redis.from_url(settings.redis_url, decode_responses=False)
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e} - using in-memory fallback")
    event_bus = EventBus(redis_client)

    # Subscribe to all workflow-related events
    workflow_event_types = [
        EventType.WORKFLOW_CREATED,
        EventType.WORKFLOW_STARTED,
        EventType.WORKFLOW_PROGRESSED,
        EventType.WORKFLOW_COMPLETED,
        EventType.WORKFLOW_FAILED,
        EventType.WORKFLOW_CANCELLED,
        EventType.GENERATION_STARTED,
        EventType.GENERATION_COMPLETED,
        EventType.AUDIT_STARTED,
        EventType.AUDIT_COMPLETED,
        EventType.TESTING_STARTED,
        EventType.TESTING_COMPLETED,
        EventType.DEPLOYMENT_STARTED,
        EventType.DEPLOYMENT_CONFIRMED,
        EventType.DEPLOYMENT_FAILED,
    ]

    # Create event consumer task
    consumer_tasks = []
    for event_type in workflow_event_types:
        task = asyncio.create_task(
            _consume_and_broadcast(event_bus, event_type, workflow_id, websocket)
        )
        consumer_tasks.append(task)

    try:
        # Heartbeat loop - keep connection alive
        while True:
            try:
                # Wait for ping or timeout
                data = await asyncio.wait_for(
                    websocket.receive_text(), timeout=30.0  # 30 second timeout
                )

                # Handle ping/pong
                if data == "ping":
                    await websocket.send_json(
                        {"type": "pong", "timestamp": asyncio.get_event_loop().time()}
                    )
                elif data.startswith("subscribe:"):
                    # Handle subscription changes if needed
                    pass

            except asyncio.TimeoutError:
                # Send heartbeat
                await websocket.send_json(
                    {
                        "type": "heartbeat",
                        "workflow_id": workflow_id,
                        "timestamp": asyncio.get_event_loop().time(),
                    }
                )
            except WebSocketDisconnect:
                break

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for workflow {workflow_id}")
    except Exception as e:
        logger.error(f"WebSocket error for workflow {workflow_id}: {e}", exc_info=True)
    finally:
        # Cancel consumer tasks
        for task in consumer_tasks:
            task.cancel()
        await asyncio.gather(*consumer_tasks, return_exceptions=True)

        # Disconnect
        manager.disconnect(websocket, workflow_id)
        logger.info(f"WebSocket cleanup complete for workflow {workflow_id}")


async def _consume_and_broadcast(
    event_bus: EventBus, event_type: EventType, workflow_id: str, websocket: WebSocket
):
    """
    Consume events from event bus and broadcast to WebSocket

    Concept: Filter events by workflow_id and forward to client
    Logic:
        1. Consume events from Redis Stream
        2. Filter by workflow_id
        3. Send to WebSocket client
    """
    consumer_group = f"websocket_{workflow_id}"
    consumer_name = f"client_{workflow_id}"

    try:
        async for event in event_bus.consume_stream(event_type, consumer_group):
            # Filter by workflow_id
            if event.workflow_id == workflow_id:
                try:
                    await websocket.send_json(
                        {
                            "type": event.type.value,
                            "workflow_id": event.workflow_id,
                            "data": event.data,
                            "timestamp": event.timestamp.isoformat(),
                            "source_agent": event.source_agent,
                            "metadata": event.metadata or {},
                        }
                    )
                    logger.debug(f"Broadcasted {event.type.value} to workflow {workflow_id}")
                except Exception as e:
                    logger.error(f"Failed to send event to WebSocket: {e}")
                    break  # Connection likely closed
    except asyncio.CancelledError:
        logger.debug(f"Event consumer cancelled for {event_type.value}")
    except Exception as e:
        logger.error(f"Event consumer error: {e}", exc_info=True)
