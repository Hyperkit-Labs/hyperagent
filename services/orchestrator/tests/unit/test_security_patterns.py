"""Unit tests for security_patterns module (extracted from nodes.py security_gate_agent)."""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from security_patterns import scan_contracts, SENSITIVE_PATTERNS


def test_detects_private_key():
    contracts = {"Token.sol": "privateKey = 0x" + "a" * 64}
    findings = scan_contracts(contracts)
    assert len(findings) == 1
    assert "Private key" in findings[0]


def test_detects_mnemonic():
    contracts = {
        "Token.sol": "mnemonic = 'abandon ability able about above absent absorb abstract absurd abuse'"
    }
    findings = scan_contracts(contracts)
    assert len(findings) == 1
    assert "mnemonic" in findings[0].lower()


def test_clean_contracts_pass():
    contracts = {"Token.sol": "pragma solidity ^0.8.24; contract Token {}"}
    findings = scan_contracts(contracts)
    assert len(findings) == 0


def test_non_string_values_ignored():
    contracts = {"Token.sol": 42}
    findings = scan_contracts(contracts)
    assert len(findings) == 0


def test_multiple_findings():
    code = "privateKey = 0x" + "b" * 64 + "\n" 'api_key = "sk-secret-value"'
    contracts = {"Token.sol": code}
    findings = scan_contracts(contracts)
    assert len(findings) == 2
