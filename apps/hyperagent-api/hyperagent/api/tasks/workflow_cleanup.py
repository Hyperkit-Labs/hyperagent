"""Periodic task to clean up stuck workflows"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select

from hyperagent.core.config import settings
from hyperagent.db.session import AsyncSessionLocal
from hyperagent.models.workflow import Workflow, WorkflowStatus

logger = logging.getLogger(__name__)

# Configuration (from settings, with defaults)
STUCK_WORKFLOW_TIMEOUT_MINUTES = getattr(settings, "workflow_stuck_timeout_minutes", 30)
CLEANUP_INTERVAL_SECONDS = getattr(settings, "workflow_cleanup_interval_seconds", 300)


async def cleanup_stuck_workflows():
    """
    Mark workflows as failed if they've been stuck in generating/processing status too long
    
    This prevents workflows from hanging indefinitely when background tasks crash or hang.
    """
    async with AsyncSessionLocal() as db:
        try:
            # Calculate cutoff time (workflows older than this are considered stuck)
            cutoff_time = datetime.utcnow() - timedelta(minutes=STUCK_WORKFLOW_TIMEOUT_MINUTES)
            
            # Find workflows stuck in generating/processing status
            result = await db.execute(
                select(Workflow).where(
                    Workflow.status.in_([
                        WorkflowStatus.GENERATING.value,
                        WorkflowStatus.NLP_PARSING.value,
                        "processing",  # Some workflows might have this status
                    ])
                ).where(
                    Workflow.updated_at < cutoff_time
                )
            )
            
            stuck_workflows = result.scalars().all()
            
            if not stuck_workflows:
                logger.debug("No stuck workflows found in cleanup cycle")
                return
            
            logger.warning(f"Found {len(stuck_workflows)} stuck workflow(s), marking as failed")
            
            for workflow in stuck_workflows:
                age_minutes = (datetime.utcnow() - workflow.updated_at).total_seconds() / 60
                logger.warning(
                    f"Marking workflow {workflow.id} as failed: "
                    f"stuck in '{workflow.status}' status for {age_minutes:.1f} minutes"
                )
                
                # Mark as failed
                workflow.status = WorkflowStatus.FAILED.value
                workflow.error_message = (
                    f"Workflow timed out after {age_minutes:.1f} minutes. "
                    "The generation process appears to have hung or crashed. "
                    "Please try creating a new workflow."
                )
                workflow.updated_at = datetime.utcnow()
            
            await db.commit()
            logger.info(f"Marked {len(stuck_workflows)} stuck workflow(s) as failed")
            
        except Exception as e:
            logger.error(f"Error in workflow cleanup task: {e}", exc_info=True)
            await db.rollback()


async def run_cleanup_loop():
    """
    Run cleanup task periodically
    
    This function runs in a loop, checking for stuck workflows every CLEANUP_INTERVAL_SECONDS.
    """
    logger.info(
        f"Starting workflow cleanup task: checking every {CLEANUP_INTERVAL_SECONDS}s, "
        f"timeout threshold: {STUCK_WORKFLOW_TIMEOUT_MINUTES} minutes"
    )
    
    while True:
        try:
            await cleanup_stuck_workflows()
        except Exception as e:
            logger.error(f"Error in cleanup loop: {e}", exc_info=True)
        
        # Wait before next cleanup cycle
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)


def start_cleanup_task():
    """
    Start the cleanup task as a background coroutine
    
    Call this from FastAPI startup event.
    """
    asyncio.create_task(run_cleanup_loop())
    logger.info("Workflow cleanup task started")

