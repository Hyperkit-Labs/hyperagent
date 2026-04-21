from __future__ import annotations

from types import SimpleNamespace

import db


class _RunsQuery:
    def __init__(self) -> None:
        self.attempts = 0

    def select(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def execute(self):
        self.attempts += 1
        if self.attempts == 1:
            raise RuntimeError("ConnectionTerminated error_code:1")
        return SimpleNamespace(data=[{"id": "run-1", "workflow_state": {"status": "running"}}])


class _RunStepsQuery:
    def __init__(self) -> None:
        self.attempts = 0

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def execute(self):
        self.attempts += 1
        if self.attempts == 1:
            raise RuntimeError("ConnectionTerminated error_code:1")
        return SimpleNamespace(
            data=[
                {"runs": {"projects": {"wallet_user_id": "550e8400-e29b-41d4-a716-446655440000"}}}
            ]
        )


def test_list_workflow_states_retries_on_transient_error(monkeypatch) -> None:
    query = _RunsQuery()
    invalidations = {"count": 0}

    class _Client:
        def table(self, _name: str):
            return query

    monkeypatch.setattr(db, "_client", lambda: _Client())
    monkeypatch.setattr(
        db, "is_transient_supabase_http_error", lambda exc: "ConnectionTerminated" in str(exc)
    )
    monkeypatch.setattr(
        db,
        "invalidate_supabase_client",
        lambda: invalidations.__setitem__("count", invalidations["count"] + 1),
    )

    out = db.list_workflow_states(limit=5)
    assert len(out) == 1
    assert out[0]["run_id"] == "run-1"
    assert invalidations["count"] == 1


def test_count_distinct_auditors_retries_on_transient_error(monkeypatch) -> None:
    query = _RunStepsQuery()
    invalidations = {"count": 0}

    class _Client:
        def table(self, _name: str):
            return query

    monkeypatch.setattr(db, "_client", lambda: _Client())
    monkeypatch.setattr(
        db, "is_transient_supabase_http_error", lambda exc: "ConnectionTerminated" in str(exc)
    )
    monkeypatch.setattr(
        db,
        "invalidate_supabase_client",
        lambda: invalidations.__setitem__("count", invalidations["count"] + 1),
    )

    out = db.count_distinct_auditors()
    assert out == 1
    assert invalidations["count"] == 1
