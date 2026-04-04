#!/usr/bin/env python3
"""Emit the FastAPI OpenAPI document (stdout or --out). Used for TS client and contract generation."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_ORCH_ROOT = Path(__file__).resolve().parent.parent
if str(_ORCH_ROOT) not in sys.path:
    sys.path.insert(0, str(_ORCH_ROOT))

from main import app  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        help="Write JSON to this path instead of stdout",
    )
    args = parser.parse_args()
    data = app.openapi()
    text = json.dumps(data, indent=2, ensure_ascii=False)
    if args.out:
        Path(args.out).write_text(text + "\n", encoding="utf-8")
    else:
        print(text)


if __name__ == "__main__":
    main()
