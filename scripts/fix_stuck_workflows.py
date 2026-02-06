#!/usr/bin/env python3
"""
Fix stuck workflows by marking them as failed if they've been running too long
"""
import asyncio
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from hyperagent.db.session import AsyncSessionLocal
from hyperagent.models.workflow import Workflow, WorkflowStatus


async def fix_stuck_workflows(max_age_minutes: int = 30):
    """
    Mark workflows as failed if they've been in generating/processing status too long
    
    Args:
        max_age_minutes: Maximum age in minutes before marking as stuck
    """
    async with AsyncSessionLocal() as db:
        try:
            # Find workflows stuck in generating/processing status
            cutoff_time = datetime.utcnow() - timedelta(minutes=max_age_minutes)
            
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
                print("No stuck workflows found.")
                return
            
            print(f"Found {len(stuck_workflows)} stuck workflow(s):")
            
            for workflow in stuck_workflows:
                age_minutes = (datetime.utcnow() - workflow.updated_at).total_seconds() / 60
                print(f"  - {workflow.id}: status={workflow.status}, age={age_minutes:.1f} minutes")
                
                # Mark as failed
                workflow.status = WorkflowStatus.FAILED.value
                workflow.error_message = (
                    f"Workflow timed out after {age_minutes:.1f} minutes. "
                    "The generation process appears to have hung or crashed. "
                    "Please try creating a new workflow."
                )
                workflow.updated_at = datetime.utcnow()
            
            await db.commit()
            print(f"\n[OK] Marked {len(stuck_workflows)} workflow(s) as failed.")
            
        except Exception as e:
            print(f"[ERROR] Error fixing stuck workflows: {e}")
            await db.rollback()
            raise


async def fix_specific_workflows(workflow_ids: list[str]):
    """Mark specific workflows as failed"""
    async with AsyncSessionLocal() as db:
        try:
            from uuid import UUID
            
            workflows_to_fix = []
            for workflow_id in workflow_ids:
                try:
                    result = await db.execute(
                        select(Workflow).where(Workflow.id == UUID(workflow_id))
                    )
                    workflow = result.scalar_one_or_none()
                    if workflow:
                        workflows_to_fix.append(workflow)
                    else:
                        print(f"[WARN] Workflow {workflow_id} not found")
                except ValueError:
                    print(f"[WARN] Invalid workflow ID: {workflow_id}")
            
            if not workflows_to_fix:
                print("No workflows to fix.")
                return
            
            print(f"Marking {len(workflows_to_fix)} workflow(s) as failed:")
            
            for workflow in workflows_to_fix:
                age_minutes = (datetime.utcnow() - workflow.updated_at).total_seconds() / 60
                print(f"  - {workflow.id}: status={workflow.status}, age={age_minutes:.1f} minutes")
                
                workflow.status = WorkflowStatus.FAILED.value
                workflow.error_message = (
                    f"Workflow manually marked as failed. "
                    f"Was stuck in '{workflow.status}' status for {age_minutes:.1f} minutes. "
                    "Please try creating a new workflow."
                )
                workflow.updated_at = datetime.utcnow()
            
            await db.commit()
            print(f"\n[OK] Marked {len(workflows_to_fix)} workflow(s) as failed.")
            
        except Exception as e:
            print(f"[ERROR] Error fixing workflows: {e}")
            await db.rollback()
            raise


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Fix stuck workflows")
    parser.add_argument(
        "--workflow-ids",
        nargs="+",
        help="Specific workflow IDs to fix",
    )
    parser.add_argument(
        "--max-age-minutes",
        type=int,
        default=30,
        help="Maximum age in minutes before marking as stuck (default: 30)",
    )
    
    args = parser.parse_args()
    
    if args.workflow_ids:
        asyncio.run(fix_specific_workflows(args.workflow_ids))
    else:
        asyncio.run(fix_stuck_workflows(args.max_age_minutes))

