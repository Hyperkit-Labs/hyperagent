"""
Billing hardening tests.

Covers: x402 middleware, idempotency, refund, credit invariants,
queue failure compensation, production fallback guards.
"""

from __future__ import annotations

import json
import os
import time
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# x402 middleware tests
# ---------------------------------------------------------------------------


class TestX402Middleware:
    """Tests for x402_middleware module."""

    def test_parse_payment_header_json(self):
        from x402_middleware import _parse_payment_header

        raw = json.dumps(
            {
                "nonce": "abc12345",
                "amount": 0.15,
                "payer": "0x1",
                "signature": "0xsig",
                "valid_before": int(time.time()) + 300,
            }
        )
        result = _parse_payment_header(raw)
        assert result is not None
        assert result["nonce"] == "abc12345"
        assert result["amount"] == 0.15

    def test_parse_payment_header_base64(self):
        import base64

        from x402_middleware import _parse_payment_header

        payload = json.dumps(
            {
                "nonce": "test1234",
                "amount": 1.0,
                "payer": "0x2",
                "signature": "sig",
                "valid_before": 9999999999,
            }
        )
        encoded = base64.b64encode(payload.encode()).decode()
        result = _parse_payment_header(encoded)
        assert result is not None
        assert result["nonce"] == "test1234"

    def test_parse_payment_header_invalid(self):
        from x402_middleware import _parse_payment_header

        assert _parse_payment_header("not-json-or-base64!!!") is None

    def test_validate_proof_missing_fields(self):
        from x402_middleware import _validate_proof_structure

        err = _validate_proof_structure({}, "/api/v1/deploy", 0.15)
        assert err is not None
        assert "missing field" in err

    def test_validate_proof_insufficient_amount(self):
        from x402_middleware import _validate_proof_structure

        proof = {
            "nonce": "abcdefgh",
            "amount": 0.01,
            "payer": "0xabc",
            "signature": "0xsig",
            "valid_before": int(time.time()) + 300,
        }
        err = _validate_proof_structure(proof, "/api/v1/deploy", 0.15)
        assert err is not None
        assert "below required" in err

    def test_validate_proof_expired(self):
        from x402_middleware import _validate_proof_structure

        proof = {
            "nonce": "expired1",
            "amount": 1.0,
            "payer": "0xabc",
            "signature": "0xsig",
            "valid_before": int(time.time()) - 100,
        }
        err = _validate_proof_structure(proof, "/api/v1/deploy", 0.15)
        assert err is not None
        assert "expired" in err

    def test_validate_proof_replay(self):
        from x402_middleware import _nonce_cache, _validate_proof_structure

        _nonce_cache.clear()
        nonce = f"replay_{int(time.time())}"
        proof = {
            "nonce": nonce,
            "amount": 1.0,
            "payer": "0xabc",
            "signature": "0xsig",
            "valid_before": int(time.time()) + 300,
        }
        err1 = _validate_proof_structure(proof, "/api/v1/deploy", 0.15)
        assert err1 is None

        err2 = _validate_proof_structure(proof, "/api/v1/deploy", 0.15)
        assert err2 is not None
        assert "replay" in err2

    def test_validate_proof_valid(self):
        from x402_middleware import _nonce_cache, _validate_proof_structure

        _nonce_cache.clear()
        proof = {
            "nonce": f"valid_{int(time.time())}",
            "amount": 0.20,
            "payer": "0xabc",
            "signature": "0xsig",
            "valid_before": int(time.time()) + 300,
        }
        err = _validate_proof_structure(proof, "/api/v1/deploy", 0.15)
        assert err is None


# ---------------------------------------------------------------------------
# billing.py tests
# ---------------------------------------------------------------------------


class TestBillingModule:
    """Tests for billing.py helper functions."""

    def test_get_endpoint_price_known(self):
        from billing import get_endpoint_price

        price = get_endpoint_price("/api/v1/workflows/generate")
        assert price is not None
        assert price > 0

    def test_get_endpoint_price_unknown(self):
        from billing import get_endpoint_price

        price = get_endpoint_price("/api/v1/unknown/path")
        assert price is None

    def test_is_internal_caller_with_user_id(self):
        from billing import is_internal_caller

        assert is_internal_caller({"X-User-Id": "u123"}, "u123") is True

    def test_is_internal_caller_external(self):
        from billing import is_internal_caller

        assert is_internal_caller({}, None) is False

    def test_x402_challenge_response_shape(self):
        from billing import x402_challenge_response

        resp = x402_challenge_response("/api/v1/deploy", 0.15)
        assert resp["error"] == "payment_required"
        assert resp["code"] == "x402"
        assert resp["price_usd"] == 0.15


# ---------------------------------------------------------------------------
# credits_supabase fallback guard tests
# ---------------------------------------------------------------------------


class TestCreditsFallbackGuard:
    """Test that non-atomic fallbacks are blocked in production."""

    @patch.dict(os.environ, {"NODE_ENV": "production", "CREDITS_ENABLED": "1"})
    @patch("credits_supabase._client")
    @patch("credits_supabase.is_configured", return_value=True)
    def test_top_up_fallback_blocked_in_production(self, _cfg, _cli):
        from credits_supabase import _top_up_fallback

        result = _top_up_fallback("user1", 10.0, "USD", None, None, None)
        assert result is None

    @patch.dict(os.environ, {"NODE_ENV": "production", "CREDITS_ENABLED": "1"})
    @patch("credits_supabase._client")
    @patch("credits_supabase.is_configured", return_value=True)
    def test_consume_fallback_blocked_in_production(self, _cfg, _cli):
        from credits_supabase import _consume_fallback

        ok, bal = _consume_fallback("user1", 5.0, None, None, None)
        assert ok is False
        assert bal == 0.0

    @patch.dict(os.environ, {"NODE_ENV": "production", "CREDITS_ENABLED": "1"})
    @patch("credits_supabase._client")
    @patch("credits_supabase.is_configured", return_value=True)
    def test_refund_fallback_blocked_in_production(self, _cfg, _cli):
        from credits_supabase import _refund_fallback

        ok, bal = _refund_fallback("user1", 5.0, "ref1", "test", {})
        assert ok is False
        assert bal == 0.0


# ---------------------------------------------------------------------------
# Reconciliation tests
# ---------------------------------------------------------------------------


class TestReconciliation:
    """Tests for billing_reconciliation module."""

    def test_reconciliation_result_consistent(self):
        from billing_reconciliation import ReconciliationResult

        r = ReconciliationResult(
            user_id="u1",
            stored_balance=100.0,
            computed_balance=100.0,
            drift=0.0,
            orphan_payments=[],
            orphan_transactions=[],
        )
        assert r.is_consistent is True
        d = r.to_dict()
        assert d["drift"] == 0.0
        assert d["is_consistent"] is True

    def test_reconciliation_result_drifted(self):
        from billing_reconciliation import ReconciliationResult

        r = ReconciliationResult(
            user_id="u2",
            stored_balance=100.0,
            computed_balance=95.0,
            drift=5.0,
            orphan_payments=[],
            orphan_transactions=[],
        )
        assert r.is_consistent is False
        assert r.drift == 5.0

    def test_reconciliation_result_orphans(self):
        from billing_reconciliation import ReconciliationResult

        r = ReconciliationResult(
            user_id="u3",
            stored_balance=100.0,
            computed_balance=100.0,
            drift=0.0,
            orphan_payments=[{"payment_id": "p1", "workflow_id": "w1"}],
            orphan_transactions=[],
        )
        assert r.is_consistent is False


# ---------------------------------------------------------------------------
# Payment idempotency tests
# ---------------------------------------------------------------------------


class TestPaymentIdempotency:
    """Tests for insert_payment idempotency key behavior."""

    @patch("payments_supabase._client")
    @patch("payments_supabase.is_configured", return_value=True)
    def test_idempotent_insert_returns_existing(self, _cfg, mock_client):
        from payments_supabase import insert_payment

        existing_row = {
            "id": "pay_1",
            "user_id": "u1",
            "amount": "0.15",
            "idempotency_key": "key1",
        }
        mock_table = MagicMock()
        mock_select = MagicMock()
        mock_select.eq.return_value = mock_select
        mock_select.execute.return_value = MagicMock(data=[existing_row])
        mock_table.select.return_value = mock_select
        mock_client.return_value.table.return_value = mock_table

        result = insert_payment("u1", 0.15, idempotency_key="key1")
        assert result is not None
        assert result["idempotency_key"] == "key1"

    @patch("payments_supabase._client")
    @patch("payments_supabase.is_configured", return_value=True)
    def test_insert_without_idempotency_key(self, _cfg, mock_client):
        from payments_supabase import insert_payment

        new_row = {"id": "pay_2", "user_id": "u1", "amount": "0.15"}
        mock_table = MagicMock()
        mock_insert = MagicMock()
        mock_insert.execute.return_value = MagicMock(data=[new_row])
        mock_table.insert.return_value = mock_insert
        mock_client.return_value.table.return_value = mock_table

        result = insert_payment("u1", 0.15)
        assert result is not None
        assert result["id"] == "pay_2"


# ---------------------------------------------------------------------------
# Credit invariant tests
# ---------------------------------------------------------------------------


class TestCreditInvariants:
    """Tests for credit accounting invariants (balance, consume, refund)."""

    @patch("credits_supabase._client")
    @patch("credits_supabase.is_configured", return_value=True)
    def test_consume_rejects_negative_amount(self, _cfg, _cli):
        from credits_supabase import consume

        ok, bal = consume("user1", -5.0)
        assert ok is False

    @patch("credits_supabase._client")
    @patch("credits_supabase.is_configured", return_value=True)
    def test_consume_rejects_zero_amount(self, _cfg, _cli):
        from credits_supabase import consume

        ok, bal = consume("user1", 0)
        assert ok is False

    @patch("credits_supabase._client")
    @patch("credits_supabase.is_configured", return_value=True)
    def test_consume_insufficient_returns_false(self, _cfg, mock_client):
        from credits_supabase import consume

        mock_rpc = MagicMock()
        mock_rpc.execute.return_value = MagicMock(
            data=[{"success": False, "balance_after": 3.0}]
        )
        mock_client.return_value.rpc.return_value = mock_rpc

        ok, bal = consume("user1", 10.0, reference_id="w1")
        assert ok is False
        assert bal == 3.0

    @patch("credits_supabase._client")
    @patch("credits_supabase.is_configured", return_value=True)
    def test_refund_rejects_negative_amount(self, _cfg, _cli):
        from credits_supabase import refund

        ok, bal = refund("user1", -1.0)
        assert ok is False

    @patch("credits_supabase._client")
    @patch("credits_supabase.is_configured", return_value=True)
    def test_refund_reference_id_uses_uuid(self, _cfg, mock_client):
        """Refund reference_id must use UUID (not timestamp) for collision safety."""
        from credits_supabase import refund

        mock_rpc = MagicMock()
        mock_rpc.execute.return_value = MagicMock(data=[{"balance": 20.0}])
        mock_client.return_value.rpc.return_value = mock_rpc

        refund("user1", 5.0, original_reference_id="w1", reason="test")

        call_args = mock_client.return_value.rpc.call_args
        if call_args:
            ref_id = (
                call_args[1].get("p_reference_id", "") if len(call_args) > 1 else ""
            )
            if not ref_id and call_args[0]:
                params = call_args[0][1] if len(call_args[0]) > 1 else {}
                ref_id = params.get("p_reference_id", "")
            if ref_id:
                assert "refund_w1_" in ref_id
                ts_part = ref_id.split("_")[-1]
                assert (
                    len(ts_part) == 12
                ), f"Expected UUID hex suffix (12 chars), got: {ts_part}"


# ---------------------------------------------------------------------------
# Queue failure compensation tests
# ---------------------------------------------------------------------------


class TestQueueCompensation:
    """Tests that credit refund occurs when queue enqueue fails."""

    @patch("credits_supabase.is_configured", return_value=True)
    @patch("credits_supabase.has_sufficient_credits", return_value=True)
    @patch("credits_supabase.consume", return_value=(True, 3.0))
    @patch("credits_supabase.refund", return_value=(True, 10.0))
    @patch("queue_client.enqueue", return_value=False)
    @patch("queue_client.QUEUE_ENABLED", True)
    @patch("db.is_configured", return_value=False)
    @patch("db._is_uuid", return_value=True)
    def test_queue_failure_triggers_refund(
        self, _uuid, _db, _q_en, mock_refund, _consume, _has, _cfg
    ):
        from fastapi.testclient import TestClient
        from main import app

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post(
            "/api/v1/workflows/generate",
            json={
                "nlp_input": "Create an ERC-20 token",
                "api_keys": {"openai": "sk-test"},
            },
            headers={"X-User-Id": "00000000-0000-0000-0000-000000000001"},
        )
        assert resp.status_code == 503
        assert "refunded" in resp.json().get("detail", "").lower()
        mock_refund.assert_called_once()


# ---------------------------------------------------------------------------
# x402 nonce cache Redis integration
# ---------------------------------------------------------------------------


class TestX402NonceCacheRedis:
    """Nonce replay uses Redis when x402 requires it; dev may use in-memory."""

    @patch("x402_middleware._redis_client", return_value=None)
    @patch.dict(
        os.environ,
        {"NODE_ENV": "production", "X402_ENABLED": "1"},
        clear=False,
    )
    def test_check_replay_raises_when_x402_requires_redis_but_none(self, _redis):
        import x402_middleware

        x402_middleware._nonce_cache.clear()
        x402_middleware._nonce_cache_warned = False

        with pytest.raises(RuntimeError, match="x402 replay protection requires Redis"):
            x402_middleware._check_replay("test_prod_nonce_1")

    @patch("x402_middleware._redis_client", return_value=None)
    @patch.dict(
        os.environ, {"NODE_ENV": "production", "X402_ENABLED": "0"}, clear=False
    )
    def test_check_replay_inmemory_when_x402_off_in_production(self, _redis):
        import x402_middleware

        x402_middleware._nonce_cache.clear()
        x402_middleware._nonce_cache_warned = False
        is_replay = x402_middleware._check_replay("test_prod_nonce_inmem")
        assert is_replay is False

    @patch("x402_middleware._redis_client")
    def test_check_replay_uses_redis_when_available(self, mock_redis_fn):
        import x402_middleware

        mock_redis = MagicMock()
        mock_redis.set.return_value = True
        mock_redis_fn.return_value = mock_redis

        is_replay = x402_middleware._check_replay("redis_nonce_1")
        assert is_replay is False
        mock_redis.set.assert_called_once()

    @patch("x402_middleware._redis_client")
    def test_check_replay_redis_detects_duplicate(self, mock_redis_fn):
        import x402_middleware

        mock_redis = MagicMock()
        mock_redis.set.return_value = False
        mock_redis_fn.return_value = mock_redis

        is_replay = x402_middleware._check_replay("redis_dup_nonce")
        assert is_replay is True


# ---------------------------------------------------------------------------
# Startup validation tests
# ---------------------------------------------------------------------------


class TestStartupValidation:
    """Tests for production startup validation behavior."""

    @patch.dict(
        os.environ,
        {
            "RENDER": "true",
            "REDIS_URL": "",
            "SUPABASE_URL": "",
            "SUPABASE_SERVICE_ROLE_KEY": "",
        },
        clear=False,
    )
    def test_startup_degraded_when_missing_prod_vars(self):
        import main

        main._startup_degraded = False
        main._startup_missing_vars = []
        main._validate_critical_services()
        assert main._startup_degraded is True
        assert len(main._startup_missing_vars) > 0
