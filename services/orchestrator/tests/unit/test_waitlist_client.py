"""Tests for waitlist_client parity with waitlist Next /api/stats."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest


def test_get_waitlist_public_stats_none_without_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("WAITLIST_SUPABASE_URL", raising=False)
    monkeypatch.delenv("WAITLIST_SUPABASE_SERVICE_KEY", raising=False)

    from waitlist_client import get_waitlist_public_stats

    assert get_waitlist_public_stats() is None


def test_get_waitlist_public_stats_three_counts(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("WAITLIST_SUPABASE_URL", "https://wl.example.supabase.co")
    monkeypatch.setenv("WAITLIST_SUPABASE_SERVICE_KEY", "srv-test")

    counts = iter([42, 12, 3])

    def make_table(_name: str) -> MagicMock:
        t = MagicMock()
        t.select.return_value = t
        t.or_.return_value = t
        t.eq.return_value = t
        t.execute.side_effect = lambda: MagicMock(count=next(counts))
        return t

    mock_sb = MagicMock()
    mock_sb.table.side_effect = make_table

    with patch("supabase.create_client", return_value=mock_sb):
        from waitlist_client import get_waitlist_public_stats

        out = get_waitlist_public_stats()

    assert out == {"total": 42, "confirmed": 12, "pending": 3}
    assert mock_sb.table.call_count == 3
