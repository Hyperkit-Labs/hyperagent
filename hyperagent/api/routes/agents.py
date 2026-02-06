"""Agents API routes for service/agent status tracking"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from hyperagent.db.session import get_db
from hyperagent.models.event_log import EventLog
from hyperagent.models.workflow import Workflow

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/agents", tags=["agents"])


class AgentStatus(BaseModel):
    """Agent status response model"""
    id: str
    name: str
    agent_id: str
    badge: Dict[str, str]
    icon: str
    icon_gradient: str
    model: str
    context_used: int
    context_total: int
    status: str  # thinking, active, idle, offline
    activity: Dict[str, Optional[str]]
    enabled: bool
    is_disabled: Optional[bool] = False


class AgentsResponse(BaseModel):
    """Agents list response"""
    agents: List[AgentStatus]
    total: int


# Agent definitions based on HyperAgent services
AGENT_DEFINITIONS = {
    "generation": {
        "id": "1",
        "name": "Architect-Alpha",
        "badge": {"label": "DEV", "color": "violet"},
        "icon": "code-2",
        "icon_gradient": "from-violet-500/20 to-fuchsia-500/20",
        "model": "Claude 4.5",
        "context_total": 200000,
    },
    "audit": {
        "id": "2",
        "name": "Audit-Sentinel",
        "badge": {"label": "SEC", "color": "emerald"},
        "icon": "shield-alert",
        "icon_gradient": "from-emerald-500/20 to-teal-500/20",
        "model": "Slither + AI",
        "context_total": 200000,
    },
    "testing": {
        "id": "3",
        "name": "QA-Bot-04",
        "badge": {"label": "TEST", "color": "blue"},
        "icon": "test-tube-2",
        "icon_gradient": "from-blue-500/20 to-cyan-500/20",
        "model": "Foundry + Hardhat",
        "context_total": 8000,
    },
    "deployment": {
        "id": "4",
        "name": "Deploy-Mainnet",
        "badge": {"label": "OPS", "color": "slate"},
        "icon": "box",
        "icon_gradient": "bg-slate-800",
        "model": "Thirdweb SDK",
        "context_total": 16000,
    },
}


@router.get("", response_model=AgentsResponse)
async def get_agents(
    db: AsyncSession = Depends(get_db),
):
    """Get agent statuses based on recent workflow activity"""
    try:
        # Get activity from last hour
        one_hour_ago = datetime.utcnow() - timedelta(hours=1)

        # Check recent events for each agent type
        agents = []

        for agent_type, definition in AGENT_DEFINITIONS.items():
            # Get recent events for this agent type
            stmt = (
                select(EventLog)
                .where(
                    and_(
                        EventLog.timestamp >= one_hour_ago,
                        or_(
                            EventLog.source_agent.ilike(f"%{agent_type}%"),
                            EventLog.service.ilike(f"%{agent_type}%"),
                            EventLog.event_type.ilike(f"%{agent_type}%"),
                        ),
                    )
                )
                .order_by(EventLog.timestamp.desc())
                .limit(10)
            )
            result = await db.execute(stmt)
            recent_events = result.scalars().all()

            # Get active workflows for this agent type
            workflow_stmt = (
                select(Workflow)
                .where(
                    and_(
                        Workflow.created_at >= one_hour_ago,
                        Workflow.status.in_(["generating", "auditing", "testing", "deploying"]),
                    )
                )
            )
            workflow_result = await db.execute(workflow_stmt)
            active_workflows = workflow_result.scalars().all()

            # Determine status
            status = "idle"
            activity_message = "Awaiting trigger"
            activity_detail = None
            context_used = 0

            if recent_events:
                latest_event = recent_events[0]
                if latest_event.level == "ERROR":
                    status = "offline"
                    activity_message = "Error detected"
                    activity_detail = latest_event.message[:50]
                elif latest_event.timestamp >= datetime.utcnow() - timedelta(minutes=5):
                    status = "active"
                    activity_message = latest_event.message[:50] or "Processing"
                else:
                    status = "idle"
                    activity_message = "Awaiting trigger"
                    activity_detail = f"Last run: {int((datetime.utcnow() - latest_event.timestamp).total_seconds() / 60)}m ago"

                # Estimate context usage (mock for now)
                context_used = min(len(recent_events) * 5000, definition["context_total"])

            # Check if agent is enabled (has recent successful activity)
            enabled = len(recent_events) > 0 or agent_type in ["generation", "audit"]

            agent_status = AgentStatus(
                id=definition["id"],
                name=definition["name"],
                agent_id=f"{agent_type[:8]}...{definition['id']}",
                badge=definition["badge"],
                icon=definition["icon"],
                icon_gradient=definition["icon_gradient"],
                model=definition["model"],
                context_used=context_used,
                context_total=definition["context_total"],
                status=status,
                activity={"message": activity_message, "detail": activity_detail},
                enabled=enabled,
                is_disabled=not enabled,
            )
            agents.append(agent_status)

        return AgentsResponse(agents=agents, total=len(agents))

    except Exception as e:
        logger.error(f"Error getting agents: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

