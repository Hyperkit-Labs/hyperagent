"""Sensitive data patterns for contract source scanning. Used by the security_gate_agent node."""

from __future__ import annotations

import re
from typing import Sequence

SENSITIVE_PATTERNS: list[tuple[str, str]] = [
    (r"privateKey\s*=\s*0x[a-fA-F0-9]{64}", "Private key assignment"),
    (r"private_key\s*=\s*0x[a-fA-F0-9]{64}", "Private key assignment"),
    (r"mnemonic\s*=\s*[\"'][^\"']{20,}[\"']", "Hardcoded mnemonic"),
    (r"api[_-]?key\s*=\s*[\"'][^\"']+[\"']", "Hardcoded API key"),
    (r"\.env\s*\[", "Environment variable access"),
]


def scan_contracts(contracts: dict[str, str]) -> list[str]:
    """Scan contract sources for sensitive patterns. Returns a list of findings."""
    findings: list[str] = []
    for name, source in contracts.items():
        if not isinstance(source, str):
            continue
        for pattern, label in SENSITIVE_PATTERNS:
            if re.search(pattern, source):
                findings.append(f"CRITICAL: {label} in {name}")
    return findings
