"""Security auditor with multiple tool integration"""

import asyncio
import os
import tempfile
from typing import Any, Dict, List

from hyperagent.security.echidna_wrapper import EchidnaWrapper
from hyperagent.security.mythril_wrapper import MythrilWrapper
from hyperagent.security.slither_wrapper import SlitherWrapper


class SecurityAuditor:
    """
    Security Auditor

    Concept: Aggregates multiple security analysis tools
    Logic: Run tools in parallel, aggregate results, calculate risk
    Tools: Slither (static analysis), Mythril (bytecode analysis), Echidna (fuzzing)
    """

    def __init__(self):
        self.slither = SlitherWrapper()
        self.mythril = MythrilWrapper()
        self.echidna = EchidnaWrapper()

    async def run_slither(self, contract_code: str, contract_path: str = None) -> Dict[str, Any]:
        """
        Run Slither static analysis

        Logic:
        1. Use SlitherWrapper to analyze
        2. Return results
        """
        return await self.slither.analyze(contract_code, contract_path)

    async def run_mythril(self, contract_bytecode: str) -> Dict[str, Any]:
        """
        Run Mythril bytecode analysis

        Logic:
        1. Use MythrilWrapper to analyze bytecode
        2. Return results
        """
        return await self.mythril.analyze(contract_bytecode)

    async def run_echidna(
        self, contract_path: str, property_path: str = None, config_path: str = None
    ) -> Dict[str, Any]:
        """
        Run Echidna fuzzing on contract

        Logic:
        1. Use EchidnaWrapper to run fuzzing
        2. Return results
        """
        return await self.echidna.analyze(contract_path, property_path, config_path)

    async def compile_contract(self, contract_code: str) -> Dict[str, Any]:
        """
        Compile contract to get bytecode for Mythril

        Logic:
        1. Compile using py-solc-x
        2. Extract bytecode
        3. Return bytecode and ABI
        """
        try:
            from py_solc_x import compile_source

            # Strip markdown code blocks if present (safety net)
            contract_code = self._strip_markdown_code_blocks(contract_code)

            compiled = compile_source(contract_code)
            if not compiled:
                return {"success": False, "bytecode": None, "abi": None}

            # Get first contract
            contract_name = list(compiled.keys())[0]
            contract_data = compiled[contract_name]

            return {
                "success": True,
                "bytecode": contract_data.get("evm", {}).get("bytecode", {}).get("object", ""),
                "abi": contract_data.get("abi", []),
            }
        except Exception as e:
            return {"success": False, "error": str(e), "bytecode": None, "abi": None}

    def _strip_markdown_code_blocks(self, text: str) -> str:
        """
        Strip markdown code blocks from contract code (safety net)

        This is a fallback in case markdown wasn't stripped earlier in the pipeline.

        Args:
            text: Contract code that may contain markdown formatting

        Returns:
            Clean Solidity code without markdown
        """
        import re

        if not text:
            return ""

        text = text.strip()

        # If code starts with ```, extract content
        if text.startswith("```"):
            # Try to find closing ```
            closing_index = text.find("```", 3)  # Start searching after first ```
            if closing_index != -1:
                # Extract content between code block markers
                first_newline = text.find("\n")
                if first_newline != -1:
                    text = text[first_newline + 1 : closing_index].strip()
            else:
                # No closing ```, extract everything after first line
                first_newline = text.find("\n")
                if first_newline != -1:
                    text = text[first_newline + 1 :].strip()
                # Remove any trailing backticks
                text = text.rstrip("`").strip()

        return text
