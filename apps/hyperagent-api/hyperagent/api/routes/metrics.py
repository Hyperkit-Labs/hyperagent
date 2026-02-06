"""Prometheus metrics endpoint"""

from typing import Any, Dict

from fastapi import APIRouter, Depends
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import Response

from hyperagent.db.session import get_db
from hyperagent.models.workflow import Workflow, WorkflowStatus

router = APIRouter(prefix="/api/v1/metrics", tags=["metrics"])


@router.get("/prometheus")
async def prometheus_metrics() -> Response:
    """
    Prometheus metrics endpoint

    Usage: Scrape this endpoint for Prometheus monitoring
    Format: Prometheus text format
    """
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@router.get("")
async def get_metrics(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """
    Get workflow and deployment metrics

    Returns:
        Metrics including workflow counts, deployment stats, and performance data
    """
    try:
        total_stmt = select(func.count(Workflow.id))
        completed_stmt = select(func.count(Workflow.id)).where(
            Workflow.status == WorkflowStatus.COMPLETED.value
        )
        failed_stmt = select(func.count(Workflow.id)).where(
            Workflow.status == WorkflowStatus.FAILED.value
        )
        in_progress_stmt = select(func.count(Workflow.id)).where(
            Workflow.status.in_(
                [
                    WorkflowStatus.CREATED.value,
                    WorkflowStatus.GENERATING.value,
                    WorkflowStatus.COMPILING.value,
                    WorkflowStatus.AUDITING.value,
                    WorkflowStatus.TESTING.value,
                    WorkflowStatus.DEPLOYING.value,
                ]
            )
        )

        total_result = await db.execute(total_stmt)
        completed_result = await db.execute(completed_stmt)
        failed_result = await db.execute(failed_stmt)
        in_progress_result = await db.execute(in_progress_stmt)

        total = total_result.scalar() or 0
        completed = completed_result.scalar() or 0
        failed = failed_result.scalar() or 0
        in_progress = in_progress_result.scalar() or 0

        from hyperagent.models.deployment import Deployment

        deployment_stmt = (
            select(Deployment.network, func.count(Deployment.id))
            .group_by(Deployment.network)
            .where(Deployment.status == "confirmed")
        )
        deployment_result = await db.execute(deployment_stmt)
        deployments_by_network = {
            row[0]: row[1] for row in deployment_result.all() if row[0]
        }

        total_deployments = sum(deployments_by_network.values())

        return {
            "workflows": {
                "total": total,
                "completed": completed,
                "failed": failed,
                "in_progress": in_progress,
            },
            "deployments": {
                "total": total_deployments,
                "by_network": deployments_by_network,
            },
            "performance": {
                "avg_generation_time": 0,
                "avg_compilation_time": 0,
                "avg_deployment_time": 0,
            },
        }
    except Exception as e:
        return {
            "workflows": {"total": 0, "completed": 0, "failed": 0, "in_progress": 0},
            "deployments": {"total": 0, "by_network": {}},
            "performance": {
                "avg_generation_time": 0,
                "avg_compilation_time": 0,
                "avg_deployment_time": 0,
            },
        }


@router.get("/workflows/{workflow_id}/token-metrics")
async def get_workflow_token_metrics(
    workflow_id: str,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get detailed token usage and cost breakdown for a workflow
    
    Returns input/output token split and cost transparency metrics
    """
    try:
        from hyperagent.monitoring.mlflow_tracker import MLflowTracker
        
        tracker = MLflowTracker()
        builds = await tracker.query_builds(build_id=workflow_id, limit=1)
        
        if not builds:
            return {
                "workflow_id": workflow_id,
                "token_split": {
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "input_percentage": 0,
                    "output_percentage": 0
                },
                "cost_breakdown": {
                    "context_cost_usd": 0,
                    "generation_cost_usd": 0,
                    "total_cost_usd": 0
                },
                "rag_context": {
                    "templates_used": 0,
                    "estimated_context_tokens": 0
                }
            }
        
        build = builds[0]
        
        return {
            "workflow_id": workflow_id,
            "token_split": {
                "input_tokens": build.get("input_tokens", 0),
                "output_tokens": build.get("output_tokens", 0),
                "input_percentage": build.get("input_percentage", 0),
                "output_percentage": build.get("output_percentage", 0)
            },
            "cost_breakdown": {
                "context_cost_usd": build.get("context_cost", 0),
                "generation_cost_usd": build.get("generation_cost", 0),
                "total_cost_usd": build.get("total_cost", 0)
            },
            "rag_context": {
                "templates_used": build.get("templates_count", 5),
                "estimated_context_tokens": build.get("context_tokens", 0)
            }
        }
    except Exception as e:
        return {
            "workflow_id": workflow_id,
            "error": str(e),
            "token_split": {"input_tokens": 0, "output_tokens": 0},
            "cost_breakdown": {"total_cost_usd": 0},
            "rag_context": {"templates_used": 0}
        }

