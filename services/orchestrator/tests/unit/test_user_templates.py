"""User template package validation."""

from __future__ import annotations

import json
import os
import sys

import pytest

sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)


def test_template_package_v1_roundtrip() -> None:
    from api.user_templates import TemplatePackageV1, _canonical_json_bytes, sha256_hex

    pkg = TemplatePackageV1(
        name="Test",
        description="d",
        files=[{"path": "contracts/A.sol", "content": "// SPDX"}],
        metadata={"k": "v"},
    )
    d = pkg.model_dump(mode="json")
    h1 = sha256_hex(_canonical_json_bytes(d))
    h2 = sha256_hex(_canonical_json_bytes(d))
    assert h1 == h2
    assert len(h1) == 64


def test_template_package_rejects_too_many_files() -> None:
    from api.user_templates import TemplateFile, TemplatePackageV1
    from pydantic import ValidationError

    files = [
        TemplateFile(path=f"f{i}.sol", content="x") for i in range(201)
    ]
    with pytest.raises(ValidationError):
        TemplatePackageV1(name="x", files=files)
