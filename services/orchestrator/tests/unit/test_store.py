"""Unit tests for store. Workflow CRUD with mocked db."""

from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))


@pytest.fixture(autouse=True)
def _mock_db(monkeypatch):
    """Mock db so store uses in-memory only."""
    import db as db_mod

    monkeypatch.setattr(db_mod, "is_configured", lambda: False)
    monkeypatch.setattr(db_mod, "upsert_run_state", lambda *a, **k: None)
    monkeypatch.setattr(db_mod, "upsert_workflow_state", lambda *a, **k: None)
    monkeypatch.setattr(db_mod, "upsert_workflow_artifacts", lambda *a, **k: None)
    monkeypatch.setattr(db_mod, "is_uuid", lambda s: bool(s and len(str(s)) == 36))


def test_create_workflow():
    """create_workflow returns record with correct fields."""
    from store import create_workflow

    rec = create_workflow("wf-1", "Build ERC20 token", user_id="u1", project_id="p1")
    assert rec["workflow_id"] == "wf-1"
    assert rec["intent"] == "Build ERC20 token"
    assert rec["user_id"] == "u1"
    assert rec["project_id"] == "p1"
    assert rec["status"] == "running"
    assert rec["simulation_passed"] is False
    assert rec["audit_findings"] == []


def test_get_workflow_after_create():
    """get_workflow returns created workflow."""
    from store import create_workflow, get_workflow

    create_workflow("wf-2", "Build DEX")
    rec = get_workflow("wf-2")
    assert rec is not None
    assert rec["workflow_id"] == "wf-2"
    assert rec["intent"] == "Build DEX"


def test_get_workflow_missing_returns_none():
    """get_workflow returns None for missing id."""
    from store import get_workflow

    assert get_workflow("nonexistent") is None


def test_update_workflow():
    """update_workflow applies changes."""
    from store import create_workflow, get_workflow, update_workflow

    create_workflow("wf-3", "Build vault")
    update_workflow("wf-3", status="completed", simulation_passed=True)
    rec = get_workflow("wf-3")
    assert rec["status"] == "completed"
    assert rec["simulation_passed"] is True


def test_intent_truncated_at_max_length():
    """Intent exceeding MAX_INTENT_LENGTH is truncated."""
    from store import MAX_INTENT_LENGTH, create_workflow, get_workflow

    long_intent = "x" * (MAX_INTENT_LENGTH + 100)
    create_workflow("wf-4", long_intent)
    rec = get_workflow("wf-4")
    assert len(rec["intent"]) <= MAX_INTENT_LENGTH
