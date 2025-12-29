"""Event handlers for A2A communication"""

from typing import Any, Dict

from hyperagent.cache.redis_manager import RedisManager
from hyperagent.events.event_types import Event, EventType


class StateManagerHandler:
    """Manages workflow state based on events"""

    def __init__(self, redis_manager: RedisManager):
        self.redis = redis_manager

    async def handle(self, event: Event) -> None:
        """Handle state update events"""
        if event.type == EventType.GENERATION_COMPLETED:
            await self.update_state(
                event.workflow_id, {"contract_code": event.data.get("contract_code")}
            )
        elif event.type == EventType.DEPLOYMENT_CONFIRMED:
            await self.update_state(
                event.workflow_id, {"deployed_address": event.data.get("contract_address")}
            )

    async def update_state(self, workflow_id: str, updates: Dict[str, Any]):
        """Update workflow state in cache"""
        current_state = await self.redis.get_workflow_state(workflow_id) or {}
        current_state.update(updates)
        await self.redis.set_workflow_state(workflow_id, current_state)


class WebSocketBroadcasterHandler:
    """Broadcasts events to connected clients via WebSocket"""

    def __init__(self):
        self.connections: Dict[str, list] = {}

    async def handle(self, event: Event) -> None:
        """Broadcast event to WebSocket clients"""
        if event.workflow_id not in self.connections:
            return
        
        dead_connections = []
        for ws in self.connections[event.workflow_id]:
            try:
                await ws.send_json(event.to_dict())
            except Exception:
                dead_connections.append(ws)
        
        for ws in dead_connections:
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
    """Logs events to audit table for compliance and debugging"""

    def __init__(self, db_session):
        self.db_session = db_session

    async def handle(self, event: Event) -> None:
        """Log event to database"""
        try:
            from hyperagent.models.event_log import EventLog
            
            event_log = EventLog(
                event_type=event.type.value,
                workflow_id=event.workflow_id,
                data=event.data,
                source_agent=event.source_agent
            )
            self.db_session.add(event_log)
            await self.db_session.commit()
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to log event to database: {e}")
