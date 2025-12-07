"""Mythril analyzer wrapper"""

import asyncio
import json
import logging
import os
import subprocess
import tempfile
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class MythrilWrapper:
    """
    Mythril Wrapper

    Concept: Python wrapper for Mythril bytecode analyzer
    Logic: Execute Mythril on bytecode, parse results
    Note: Requires compiled bytecode, not source code
    """

    def __init__(self):
        self.available = self._check_availability()

    def _check_availability(self) -> bool:
        """Check if Mythril is available"""
        try:
            subprocess.run(["myth", "--version"], capture_output=True, check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False

    async def analyze(self, bytecode: str, contract_path: str = None) -> Dict[str, Any]:
        """
        Analyze bytecode with Mythril

        Concept: Mythril analyzes EVM bytecode for security vulnerabilities
        Logic:
            1. Write bytecode to temporary file (if needed)
            2. Execute mythril analyze command
            3. Parse JSON output
            4. Categorize findings by severity

        Args:
            bytecode: Contract bytecode (hex string with or without 0x)
            contract_path: Optional path to contract file (for source mapping)
        """
        if not self.available:
            return {"status": "error", "message": "Mythril not available", "vulnerabilities": []}

        # Clean bytecode (remove 0x prefix if present)
        if bytecode.startswith("0x"):
            bytecode = bytecode[2:]

        # Write bytecode to temp file if needed
        temp_file = None
        try:
            # Mythril can work with bytecode directly, but file is more reliable
            with tempfile.NamedTemporaryFile(mode="w", suffix=".bin", delete=False) as f:
                f.write(bytecode)
                temp_file = f.name

            process = await asyncio.create_subprocess_exec(
                "myth",
                "analyze",
                temp_file,
                "--execution-timeout",
                "60",
                "--solver-timeout",
                "10000",
                "--outform",
                "json",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=300)

            if process.returncode == 0:
                try:
                    mythril_data = json.loads(stdout.decode())
                    vulnerabilities = self._parse_results(mythril_data)
                    summary = self._generate_summary(vulnerabilities)

                    logger.info(f"Mythril found {len(vulnerabilities)} issues")

                    return {
                        "status": "success",
                        "vulnerabilities": vulnerabilities,
                        "tool": "mythril",
                        "summary": summary,
                        "total_issues": len(vulnerabilities),
                    }
                except json.JSONDecodeError as e:
                    logger.error(f"Mythril JSON parse error: {e}")
                    # Try to parse text output as fallback
                    return {
                        "status": "partial",
                        "message": "JSON parse failed, using text output",
                        "vulnerabilities": self._parse_text_output(stdout.decode()),
                        "tool": "mythril",
                    }
            else:
                error_msg = stderr.decode()
                logger.warning(f"Mythril analysis failed: {error_msg}")
                return {"status": "error", "message": error_msg, "vulnerabilities": []}

        except asyncio.TimeoutError:
            logger.error("Mythril analysis timed out")
            return {
                "status": "timeout",
                "message": "Mythril analysis timed out after 300 seconds",
                "vulnerabilities": [],
            }
        finally:
            if temp_file and os.path.exists(temp_file):
                os.unlink(temp_file)

    def _parse_results(self, mythril_data: Dict) -> List[Dict[str, Any]]:
        """
        Parse Mythril JSON output into vulnerability list

        Concept: Extract and format vulnerabilities from Mythril output
        Logic:
            1. Parse issues from JSON
            2. Map severity levels
            3. Extract location and trace information
            4. Format vulnerability data
        """
        vulnerabilities = []

        # Mythril structure: issues array
        issues = mythril_data.get("issues", [])

        for issue in issues:
            # Map severity
            severity = self._map_severity(issue.get("severity", "unknown"))

            # Extract location information
            address = issue.get("address")
            location = {
                "address": address,
                "function": issue.get("function", ""),
                "code": issue.get("code", ""),
            }

            # Extract trace if available
            trace = issue.get("swc-id", "")  # SWC ID for classification

            vulnerability = {
                "severity": severity,
                "title": issue.get("title", "Unknown"),
                "description": issue.get("description", ""),
                "tool": "mythril",
                "address": address,
                "location": location,
                "swc_id": trace,
                "test_case": issue.get("test-case", ""),
                "function": issue.get("function", ""),
                "code": issue.get("code", ""),
            }

            vulnerabilities.append(vulnerability)

        return vulnerabilities

    def _map_severity(self, severity: str) -> str:
        """
        Map Mythril severity to standard levels

        Concept: Normalize severity across tools
        Logic:
            - Map Mythril severity levels to standard format
            - Handle edge cases
        """
        severity_lower = severity.lower()

        if "critical" in severity_lower or severity_lower == "high":
            return "critical"
        elif severity_lower == "medium":
            return "medium"
        elif severity_lower == "low":
            return "low"
        else:
            return "info"

    def _parse_text_output(self, output: str) -> List[Dict[str, Any]]:
        """
        Parse Mythril text output as fallback

        Concept: Extract issues from text when JSON parsing fails
        Logic:
            1. Look for issue patterns in text
            2. Extract severity and description
            3. Return formatted vulnerabilities
        """
        vulnerabilities = []

        # Simple text parsing (basic implementation)
        lines = output.split("\n")
        current_issue = None

        for line in lines:
            if "Vulnerability:" in line or "Issue:" in line:
                if current_issue:
                    vulnerabilities.append(current_issue)
                current_issue = {
                    "severity": "medium",
                    "title": line.split(":")[-1].strip(),
                    "description": "",
                    "tool": "mythril",
                }
            elif current_issue and line.strip():
                current_issue["description"] += line.strip() + " "

        if current_issue:
            vulnerabilities.append(current_issue)

        return vulnerabilities

    def _generate_summary(self, vulnerabilities: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Generate summary statistics from vulnerabilities

        Concept: Aggregate vulnerability data for reporting
        """
        summary = {
            "total": len(vulnerabilities),
            "by_severity": {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0},
            "by_swc": {},
        }

        # Count by severity
        for vuln in vulnerabilities:
            severity = vuln.get("severity", "info")
            summary["by_severity"][severity] = summary["by_severity"].get(severity, 0) + 1

            # Count by SWC ID
            swc_id = vuln.get("swc_id", "")
            if swc_id:
                summary["by_swc"][swc_id] = summary["by_swc"].get(swc_id, 0) + 1

        return summary
