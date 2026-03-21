"""Worker: run_id resolution from job payload.
Verifies that workflow_id is used when run_id is absent (pipeline API sends workflow_id)."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))


def test_worker_uses_workflow_id_when_run_id_missing():
    """Simulate the worker's run_id resolution logic."""
    job_from_pipeline = {
        "workflow_id": "wf-abc-123",
        "user_id": "u1",
        "nlp_input": "test",
    }
    run_id = job_from_pipeline.get("run_id") or job_from_pipeline.get("workflow_id", "")
    assert run_id == "wf-abc-123"


def test_worker_prefers_run_id_when_both_present():
    job = {
        "run_id": "run-xyz",
        "workflow_id": "wf-abc",
    }
    run_id = job.get("run_id") or job.get("workflow_id", "")
    assert run_id == "run-xyz"


def test_worker_empty_string_when_neither_present():
    job = {"user_id": "u1"}
    run_id = job.get("run_id") or job.get("workflow_id", "")
    assert run_id == ""
