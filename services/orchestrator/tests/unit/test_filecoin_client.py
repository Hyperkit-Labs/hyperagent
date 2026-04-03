"""Unit tests for Filecoin First helpers."""

from __future__ import annotations

import os
import sys

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)


def test_should_mark_filecoin_archived_active() -> None:
    from filecoin_client import should_mark_filecoin_archived

    assert should_mark_filecoin_archived({"data": [{"dealStatus": "Active on chain"}]})
    assert not should_mark_filecoin_archived({"data": []})
    assert not should_mark_filecoin_archived({})


def test_observability_includes_storage_counters() -> None:
    from observability import format_prometheus_metrics, inc_storage_ipfs_pin_success

    inc_storage_ipfs_pin_success()
    text = format_prometheus_metrics()
    assert "hyperagent_storage_ipfs_pin_success_total" in text
    assert "hyperagent_storage_filecoin_register_success_total" in text
