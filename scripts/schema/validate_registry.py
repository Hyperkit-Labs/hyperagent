#!/usr/bin/env python3
"""Validate JSON Schema files and optional fixtures under packages/schema-registry."""

from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    from jsonschema import Draft202012Validator
except ImportError as exc:
    print("Install jsonschema: pip install jsonschema", file=sys.stderr)
    raise SystemExit(2) from exc


def _root() -> Path:
    return Path(__file__).resolve().parents[2]


def main() -> None:
    root = _root()
    reg = root / "packages" / "schema-registry"
    manifest_path = reg / "manifest.json"
    if not manifest_path.is_file():
        print(f"Missing {manifest_path}", file=sys.stderr)
        raise SystemExit(1)

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    schemas = manifest.get("schemas") or []
    errors = 0

    for entry in schemas:
        rel = entry.get("path")
        if not rel:
            print("Manifest entry missing path", file=sys.stderr)
            errors += 1
            continue
        schema_path = reg / rel
        if not schema_path.is_file():
            print(f"Missing schema file: {schema_path}", file=sys.stderr)
            errors += 1
            continue
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
        try:
            Draft202012Validator.check_schema(schema)
        except Exception as e:
            print(f"Invalid JSON Schema {schema_path}: {e}", file=sys.stderr)
            errors += 1
            continue

        fix = entry.get("fixture")
        if not fix:
            continue
        inst_path = reg / fix
        if not inst_path.is_file():
            print(f"Missing fixture: {inst_path}", file=sys.stderr)
            errors += 1
            continue
        instance = json.loads(inst_path.read_text(encoding="utf-8"))
        validator = Draft202012Validator(schema)
        try:
            validator.validate(instance)
        except Exception as e:
            print(f"Fixture failed {inst_path} vs {schema_path}: {e}", file=sys.stderr)
            errors += 1

    if errors:
        raise SystemExit(1)
    print(f"OK: validated {len(schemas)} schema(s) and fixtures under {reg}")


if __name__ == "__main__":
    main()
