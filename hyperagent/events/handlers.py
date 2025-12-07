"""Event handlers for A2A communication"""

from typing import Any, Dict

from hyperagent.cache.redis_manager import RedisManager
from hyperagent.events.event_types import Event, EventType


class StateManagerHandler:
    """
    State Manager Handler

    Concept: Manages workflow state based on events
    Logic: Updates state cache when events occur
    """

    def __init__(self, redis_manager: RedisManager):
        self.redis = redis_manager

    async def handle(self, event: Event) -> None:
        """Handle state update events"""
        if event.type == EventType.GENERATION_COMPLETED:
            # Update state with generated contract
            await self.update_state(
                event.workflow_id, {"contract_code": event.data.get("contract_code")}
            )
        elif event.type == EventType.DEPLOYMENT_CONFIRMED:
            # Update state with deployed address
            await self.update_state(
                event.workflow_id, {"deployed_address": event.data.get("contract_address")}
            )

    async def update_state(self, workflow_id: str, updates: Dict[str, Any]):
        """Update workflow state in cache"""
        current_state = await self.redis.get_workflow_state(workflow_id) or {}
        current_state.update(updates)
        await self.redis.set_workflow_state(workflow_id, current_state)


class WebSocketBroadcasterHandler:
    """
    WebSocket Broadcaster Handler

    Concept: Broadcasts events to connected clients
    Logic: Sends events via WebSocket for real-time updates
    """

    def __init__(self):
        self.connections: Dict[str, list] = {}  # workflow_id -> [websocket connections]

    async def handle(self, event: Event) -> None:
        """Broadcast event to WebSocket clients"""
        if event.workflow_id in self.connections:
            for ws in self.connections[event.workflow_id]:
                try:
                    await ws.send_json(event.to_dict())
                except Exception:
                    # Remove dead connections
                    self.connections[event.workflow_id].remove(ws)

    def register(self, workflow_id: str, websocket):
        """Register WebSocket connection"""
        if workflow_id not in self.connections:
            self.connections[workflow_id] = []
        self.connections[workflow_id].append(websocket)

    def unregister(self, workflow_id: str, websocket):
        """Unregister WebSocket connection"""
        if workflow_id in self.connections:
            self.connections[workflow_id].remove(websocket)


class AuditLoggerHandler:
    """
    Audit Logger Handler

    Concept: Logs all events to audit table
    Logic: Persists events for compliance and debugging
    """

    def __init__(self, db_session):
        self.db_session = db_session

    async def handle(self, event: Event) -> None:
        """Log event to database"""
        # TODO: Implement database logging
        # from hyperagent.models.audit import EventLog
        # event_log = EventLog(
        #     event_type=event.type.value,
        #     workflow_id=event.workflow_id,
        #     data=event.data,
        #     source_agent=event.source_agent
        # )
        # self.db_session.add(event_log)
        # self.db_session.commit()
        pass
