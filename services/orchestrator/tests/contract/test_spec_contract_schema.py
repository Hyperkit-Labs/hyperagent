"""Contract tests for the canonical Spec Lock schema mirrors."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

ROMA_SERVICE_ROOT = Path(__file__).resolve().parents[4] / "services" / "roma-service"
if str(ROMA_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(ROMA_SERVICE_ROOT))

from spec_contract import SPEC_LOCK_EXAMPLE, SpecModel, spec_lock_json_schema


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


def test_spec_lock_schema_registry_matches_canonical_model() -> None:
    schema_path = (
        _repo_root()
        / "packages"
        / "schema-registry"
        / "spec-contracts"
        / "v1"
        / "spec-lock.schema.json"
    )
    committed = json.loads(schema_path.read_text(encoding="utf-8"))
    assert committed == spec_lock_json_schema()


def test_spec_lock_api_contract_mirror_matches_registry() -> None:
    root = _repo_root()
    registry_path = (
        root
        / "packages"
        / "schema-registry"
        / "spec-contracts"
        / "v1"
        / "spec-lock.schema.json"
    )
    api_contract_path = (
        root / "packages" / "api-contracts" / "openapi" / "spec-lock.schema.json"
    )
    assert json.loads(api_contract_path.read_text(encoding="utf-8")) == json.loads(
        registry_path.read_text(encoding="utf-8")
    )


def test_spec_lock_fixture_validates_against_model() -> None:
    fixture_path = (
        _repo_root()
        / "packages"
        / "schema-registry"
        / "fixtures"
        / "spec-contracts"
        / "spec-lock-valid.json"
    )
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    parsed = SpecModel.model_validate(fixture)
    assert parsed.model_dump(mode="json", exclude_none=True) == SPEC_LOCK_EXAMPLE
