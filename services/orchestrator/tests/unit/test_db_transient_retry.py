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
        return SimpleNamespace(
            data=[{"id": "run-1", "workflow_state": {"status": "running"}}]
        )


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
                {
                    "runs": {
                        "projects": {
                            "wallet_user_id": "550e8400-e29b-41d4-a716-446655440000"
                        }
                    }
                }
            ]
        )


class _CountQuery:
    def __init__(self) -> None:
        self.attempts = 0

    def select(self, *_args, **_kwargs):
        return self

    def execute(self):
        self.attempts += 1
        if self.attempts == 1:
            raise RuntimeError("ConnectionTerminated error_code:9")
        return SimpleNamespace(count=7)


def test_list_workflow_states_retries_on_transient_error(monkeypatch) -> None:
    query_first = _RunsQuery()
    query_second = _RunsQuery()
    query_second.attempts = 1
    invalidations = {"count": 0}
    client_calls = {"count": 0}

    class _Client:
        def __init__(self, query):
            self._query = query

        def table(self, _name: str):
            return self._query

    def _client_factory():
        client_calls["count"] += 1
        return _Client(query_first if client_calls["count"] == 1 else query_second)

    monkeypatch.setattr(db, "_client", _client_factory)
    monkeypatch.setattr(
        db,
        "is_transient_supabase_http_error",
        lambda exc: "ConnectionTerminated" in str(exc),
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
    assert client_calls["count"] == 2


def test_count_distinct_auditors_retries_on_transient_error(monkeypatch) -> None:
    query_first = _RunStepsQuery()
    query_second = _RunStepsQuery()
    query_second.attempts = 1
    invalidations = {"count": 0}
    client_calls = {"count": 0}

    class _Client:
        def __init__(self, query):
            self._query = query

        def table(self, _name: str):
            return self._query

    def _client_factory():
        client_calls["count"] += 1
        return _Client(query_first if client_calls["count"] == 1 else query_second)

    monkeypatch.setattr(db, "_client", _client_factory)
    monkeypatch.setattr(
        db,
        "is_transient_supabase_http_error",
        lambda exc: "ConnectionTerminated" in str(exc),
    )
    monkeypatch.setattr(
        db,
        "invalidate_supabase_client",
        lambda: invalidations.__setitem__("count", invalidations["count"] + 1),
    )

    out = db.count_distinct_auditors()
    assert out == 1
    assert invalidations["count"] == 1
    assert client_calls["count"] == 2


def test_count_security_findings_retries_on_transient_error(monkeypatch) -> None:
    query_first = _CountQuery()
    query_second = _CountQuery()
    query_second.attempts = 1
    invalidations = {"count": 0}
    client_calls = {"count": 0}

    class _Client:
        def __init__(self, query):
            self._query = query

        def table(self, _name: str):
            return self._query

    def _client_factory():
        client_calls["count"] += 1
        return _Client(query_first if client_calls["count"] == 1 else query_second)

    monkeypatch.setattr(db, "_client", _client_factory)
    monkeypatch.setattr(
        db,
        "is_transient_supabase_http_error",
        lambda exc: "ConnectionTerminated" in str(exc),
    )
    monkeypatch.setattr(
        db,
        "invalidate_supabase_client",
        lambda: invalidations.__setitem__("count", invalidations["count"] + 1),
    )

    out = db.count_security_findings()
    assert out == 7
    assert invalidations["count"] == 1
    assert client_calls["count"] == 2
