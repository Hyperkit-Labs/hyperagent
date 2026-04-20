"""Shared pytest defaults for orchestrator tests."""

from __future__ import annotations

import os

# Unit tests typically have no TCP Redis. Repo `.env` may enable x402; keep payment gate off
# unless a test sets these (python-dotenv does not override existing keys).
os.environ.setdefault("X402_ENABLED", "0")
os.environ.setdefault("X402_MANDATORY_V01", "0")
os.environ.setdefault("LLM_REQUIRE_KMS_IN_PRODUCTION", "0")
