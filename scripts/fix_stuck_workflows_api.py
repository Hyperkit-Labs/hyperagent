#!/usr/bin/env python3
"""
Fix stuck workflows via API endpoint
"""
import requests
import sys
from typing import List

API_BASE_URL = "http://localhost:8000/api/v1"


def cancel_workflow(workflow_id: str) -> bool:
    """Cancel a workflow via API"""
    try:
        response = requests.post(
            f"{API_BASE_URL}/workflows/{workflow_id}/cancel",
            timeout=10
        )
        if response.status_code == 200:
            print(f"[OK] Cancelled workflow {workflow_id}")
            return True
        else:
            print(f"[ERROR] Failed to cancel {workflow_id}: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"[ERROR] Error cancelling {workflow_id}: {e}")
        return False


def get_workflow_status(workflow_id: str) -> dict:
    """Get workflow status"""
    try:
        response = requests.get(
            f"{API_BASE_URL}/workflows/{workflow_id}",
            timeout=10
        )
        if response.status_code == 200:
            return response.json()
        else:
            print(f"[ERROR] Failed to get status for {workflow_id}: {response.status_code}")
            return {}
    except Exception as e:
        print(f"[ERROR] Error getting status for {workflow_id}: {e}")
        return {}


def main():
    workflow_ids = [
        "3cc7e58d-2ed5-4a3b-9ffb-b40747c98a3d",
        "f16f79f1-7be7-46be-8af4-6e8726c01a5e",
        "dd1fe37a-34c2-40c6-b125-26217403f8a5",
    ]
    
    if len(sys.argv) > 1:
        workflow_ids = sys.argv[1:]
    
    print(f"Checking {len(workflow_ids)} workflow(s)...\n")
    
    for workflow_id in workflow_ids:
        status = get_workflow_status(workflow_id)
        if status:
            current_status = status.get("status", "unknown")
            progress = status.get("progress_percentage", 0)
            print(f"Workflow {workflow_id}:")
            print(f"  Status: {current_status}")
            print(f"  Progress: {progress}%")
            
            if current_status in ["generating", "processing"]:
                print(f"  Action: Cancelling stuck workflow...")
                cancel_workflow(workflow_id)
            else:
                print(f"  Action: No action needed (status: {current_status})")
        print()


if __name__ == "__main__":
    main()

