"""Prometheus metrics endpoint"""

from fastapi import APIRouter
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from starlette.responses import Response

router = APIRouter(prefix="/api/v1/metrics", tags=["metrics"])


@router.get("/prometheus")
async def prometheus_metrics() -> Response:
    """
    Prometheus metrics endpoint

    Usage: Scrape this endpoint for Prometheus monitoring
    Format: Prometheus text format
    """
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
