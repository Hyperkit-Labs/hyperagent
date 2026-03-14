"""Unit tests for store module."""

from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)


def test_ensure_contracts_dict_from_dict():
    from store import _ensure_contracts_dict

    raw = {"Token.sol": "contract Token {}"}
    out = _ensure_contracts_dict(raw)
    assert out == {"Token.sol": "contract Token {}"}


def test_ensure_contracts_dict_from_list():
    from store import _ensure_contracts_dict

    raw = [
        {"name": "Token", "source": "contract Token {}"},
        {"filename": "Vault.sol", "code": "contract Vault {}"},
    ]
    out = _ensure_contracts_dict(raw)
    assert "Token.sol" in out or "Contract_0.sol" in out
    assert "Vault.sol" in out or "Contract_1.sol" in out


def test_ensure_contracts_dict_non_sol_gets_suffix():
    from store import _ensure_contracts_dict

    raw = [{"name": "Token", "source": "contract Token {}"}]
    out = _ensure_contracts_dict(raw)
    assert "Token.sol" in out


def test_create_workflow_in_memory(monkeypatch):
    monkeypatch.setattr("store._db.is_configured", lambda: False)
    from store import create_workflow

    rec = create_workflow("wf-1", "ERC20 token", "base", "user-1", "proj-1")
    assert rec["workflow_id"] == "wf-1"
    assert rec["intent"] == "ERC20 token"
    assert rec["network"] == "base"
    assert rec["simulation_passed"] is False
    assert rec["audit_findings"] == []


def test_intent_truncated_at_max_length(monkeypatch):
    monkeypatch.setattr("store._db.is_configured", lambda: False)
    from store import create_workflow, MAX_INTENT_LENGTH

    long_intent = "x" * (MAX_INTENT_LENGTH + 100)
    rec = create_workflow("wf-2", long_intent)
    assert len(rec["intent"]) == MAX_INTENT_LENGTH
