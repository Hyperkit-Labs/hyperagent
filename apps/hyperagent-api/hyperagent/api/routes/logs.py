"""Logs API routes for system observability"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from hyperagent.db.session import get_db
from hyperagent.models.event_log import EventLog

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/logs", tags=["logs"])


class LogEntry(BaseModel):
    """Log entry response model"""
    id: str
    timestamp: str
    level: str
    service: Optional[str]
    message: str
    workflow_id: Optional[str]
    source_agent: Optional[str]
    host: Optional[str]
    duration_ms: Optional[str]
    data: Optional[Dict[str, Any]]


class LogsResponse(BaseModel):
    """Logs list response"""
    logs: List[LogEntry]
    total: int
    page: int
    page_size: int


@router.get("", response_model=LogsResponse)
async def get_logs(
    level: Optional[str] = Query(None, description="Filter by log level (INFO, ERROR, WARN, DEBUG)"),
    service: Optional[str] = Query(None, description="Filter by service name"),
    host: Optional[str] = Query(None, description="Filter by host"),
    workflow_id: Optional[str] = Query(None, description="Filter by workflow ID"),
    search: Optional[str] = Query(None, description="Search in message"),
    time_range: str = Query("24h", description="Time range (15m, 1h, 24h, 7d)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=500, description="Items per page"),
    db: AsyncSession = Depends(get_db),
):
    """Get system logs with filtering and pagination"""
    try:
        # Calculate time range
        time_ranges = {
            "15m": timedelta(minutes=15),
            "1h": timedelta(hours=1),
            "24h": timedelta(hours=24),
            "7d": timedelta(days=7),
        }
        time_delta = time_ranges.get(time_range, timedelta(hours=24))
        start_time = datetime.utcnow() - time_delta

        # Build query
        conditions = [EventLog.timestamp >= start_time]

        if level and level != "All":
            conditions.append(EventLog.level == level.upper())

        if service and service != "All":
            conditions.append(
                or_(
                    EventLog.service == service,
                    EventLog.source_agent == service,
                )
            )

        if host:
            conditions.append(EventLog.host == host)

        if workflow_id:
            conditions.append(EventLog.workflow_id == workflow_id)

        if search:
            conditions.append(EventLog.message.ilike(f"%{search}%"))

        # Count total
        count_stmt = select(func.count(EventLog.id)).where(and_(*conditions))
        count_result = await db.execute(count_stmt)
        total = count_result.scalar()

        # Get logs
        offset = (page - 1) * page_size
        stmt = (
            select(EventLog)
            .where(and_(*conditions))
            .order_by(EventLog.timestamp.desc())
            .offset(offset)
            .limit(page_size)
        )

        result = await db.execute(stmt)
        logs = result.scalars().all()

        log_entries = [LogEntry(**log.to_dict()) for log in logs]

        return LogsResponse(
            logs=log_entries,
            total=total,
            page=page,
            page_size=page_size,
        )

    except Exception as e:
        logger.error(f"Error getting logs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/services", response_model=List[str])
async def get_services(db: AsyncSession = Depends(get_db)):
    """Get list of available services for filtering"""
    try:
        stmt = (
            select(EventLog.service, EventLog.source_agent)
            .distinct()
            .where(EventLog.service.isnot(None) | EventLog.source_agent.isnot(None))
        )
        result = await db.execute(stmt)
        rows = result.all()
        
        services = set()
        for row in rows:
            if row.service:
                services.add(row.service)
            if row.source_agent:
                services.add(row.source_agent)
        
        return sorted(list(services))
    except Exception as e:
        logger.error(f"Error getting services: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/hosts", response_model=List[str])
async def get_hosts(db: AsyncSession = Depends(get_db)):
    """Get list of available hosts for filtering"""
    try:
        stmt = (
            select(EventLog.host)
            .distinct()
            .where(EventLog.host.isnot(None))
        )
        result = await db.execute(stmt)
        hosts = [row[0] for row in result.all() if row[0]]
        return sorted(hosts)
    except Exception as e:
        logger.error(f"Error getting hosts: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

