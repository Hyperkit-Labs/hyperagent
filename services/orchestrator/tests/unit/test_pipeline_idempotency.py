"""Unit tests for pipeline idempotency/provenance helpers."""

from api.pipeline import _find_idempotent_workflow, _intent_sha256


def test_intent_sha256_is_deterministic() -> None:
    text = "build me an escrow dapp"
    assert _intent_sha256(text) == _intent_sha256(text)
    assert len(_intent_sha256(text)) == 64


def test_find_idempotent_workflow_matches_user_and_key(monkeypatch) -> None:
    rows = [
        {
            "workflow_id": "wf-1",
            "user_id": "user-a",
            "metadata": {"idempotency_key": "k1"},
            "status": "running",
        },
        {
            "workflow_id": "wf-2",
            "user_id": "user-b",
            "metadata": {"idempotency_key": "k2"},
            "status": "completed",
        },
    ]

    monkeypatch.setattr("api.pipeline.list_workflows", lambda limit=500: rows)

    hit = _find_idempotent_workflow("user-a", "k1")
    miss_user = _find_idempotent_workflow("user-x", "k1")
    miss_key = _find_idempotent_workflow("user-a", "k9")

    assert hit is not None
    assert hit["workflow_id"] == "wf-1"
    assert miss_user is None
    assert miss_key is None
