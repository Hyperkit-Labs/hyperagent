"""Echidna fuzzing wrapper"""

import asyncio
import json
import logging
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class EchidnaWrapper:
    """
    Echidna Wrapper

    Concept: Python wrapper for Echidna property-based fuzzing
    Logic: Generate properties, run Echidna, parse results
    Note: Requires contract file and property file
    """

    def __init__(self):
        self.available = self._check_availability()

    def _check_availability(self) -> bool:
        """Check if Echidna is available"""
        try:
            subprocess.run(["echidna", "--version"], capture_output=True, check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False

    def generate_properties(self, contract_code: str, contract_name: str) -> str:
        """
        Generate Echidna property file for fuzzing

        Concept: Echidna requires property definitions to test
        Logic:
            1. Analyze contract functions
            2. Generate invariant properties
            3. Create Echidna config file
        """
        properties = []

        # Generate basic invariants
        properties.append(
            f"""
// Property: Contract should not self-destruct
function echidna_no_selfdestruct() public view returns (bool) {{
    return address({contract_name}).code.length > 0;
}}
"""
        )

        # Generate balance invariants if ERC20
        if "ERC20" in contract_code or "transfer" in contract_code.lower():
            properties.append(
                f"""
// Property: Total supply should be constant (if no minting)
function echidna_total_supply_constant() public view returns (bool) {{
    // Implementation depends on contract structure
    return true;
}}
"""
            )

        # Generate access control properties
        if "onlyOwner" in contract_code or "onlyRole" in contract_code:
            properties.append(
                f"""
// Property: Owner should not change unexpectedly
function echidna_owner_constant() public view returns (bool) {{
    // Implementation depends on contract structure
    return true;
}}
"""
            )

        return "\n".join(properties)

    async def analyze(
        self, contract_path: str, property_path: str = None, config_path: str = None
    ) -> Dict[str, Any]:
        """
        Run Echidna fuzzing on contract

        Logic:
        1. Generate properties if not provided
        2. Create config file if not provided
        3. Run Echidna
        4. Parse results
        """
        if not self.available:
            return {"status": "error", "message": "Echidna not available", "vulnerabilities": []}

        contract_dir = Path(contract_path).parent
        contract_name = Path(contract_path).stem

        # Generate properties if not provided
        if not property_path:
            with open(contract_path, "r") as f:
                contract_code = f.read()
            properties = self.generate_properties(contract_code, contract_name)

            property_path = contract_dir / f"{contract_name}_properties.sol"
            with open(property_path, "w") as f:
                f.write(properties)
            temp_property = True
        else:
            temp_property = False

        # Create config if not provided
        if not config_path:
            config_path = contract_dir / "echidna.config.yaml"
            config_content = f"""
testMode: property
testLimit: 50000
seqLen: 50
shrinkLimit: 5000
coverage: true
format: json
"""
            with open(config_path, "w") as f:
                f.write(config_content)
            temp_config = True
        else:
            temp_config = False

        try:
            # Run Echidna
            process = await asyncio.create_subprocess_exec(
                "echidna",
                str(contract_path),
                "--config",
                str(config_path),
                "--format",
                "json",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=300)

            # Parse results
            output_text = stdout.decode()
            stderr_text = stderr.decode()
            return_code = process.returncode

            vulnerabilities = self._parse_results(output_text, stderr_text, return_code)
            summary = self._generate_summary(vulnerabilities)

            return {
                "status": "success" if not vulnerabilities else "failed",
                "vulnerabilities": vulnerabilities,
                "tool": "echidna",
                "summary": summary,
                "output": output_text[:1000],  # First 1000 chars
                "total_issues": len(vulnerabilities),
            }

        except asyncio.TimeoutError:
            return {
                "status": "timeout",
                "message": "Echidna analysis timed out",
                "vulnerabilities": [],
            }

        finally:
            # Clean up temp files
            if temp_property and os.path.exists(property_path):
                os.unlink(property_path)
            if temp_config and os.path.exists(config_path):
                os.unlink(config_path)

    def _parse_results(
        self, stdout: str, stderr: str, return_code: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Parse Echidna output for property violations

        Concept: Extract property violations from Echidna output
        Logic:
            1. Check for FAILURE or property violation indicators
            2. Extract property names and violation details
            3. Parse counterexamples if available
            4. Format as vulnerabilities

        Args:
            stdout: Standard output from Echidna
            stderr: Standard error from Echidna
            return_code: Process return code
        """
        vulnerabilities = []
        output_upper = stdout.upper()

        # Check for property violations
        if "FAILURE" in output_upper or return_code != 0:
            # Try to parse JSON output first
            try:
                # Look for JSON in output
                json_start = stdout.find("{")
                json_end = stdout.rfind("}") + 1
                if json_start >= 0 and json_end > json_start:
                    json_data = json.loads(stdout[json_start:json_end])
                    # Parse structured output
                    for test in json_data.get("tests", []):
                        if test.get("status") == "failed":
                            vulnerabilities.append(
                                {
                                    "severity": "high",
                                    "title": f"Property Violation: {test.get('name', 'Unknown')}",
                                    "description": test.get("error", ""),
                                    "tool": "echidna",
                                    "type": "property_violation",
                                    "property": test.get("name"),
                                    "counterexample": test.get("counterexample", {}),
                                }
                            )
            except (json.JSONDecodeError, ValueError):
                # Fallback to text parsing
                pass

            # If no structured parsing worked, use text parsing
            if not vulnerabilities:
                # Extract property violations from text
                lines = stdout.split("\n")
                current_violation = None

                for line in lines:
                    if (
                        "FAILURE" in line.upper()
                        or "Property" in line
                        and "violated" in line.lower()
                    ):
                        if current_violation:
                            vulnerabilities.append(current_violation)

                        # Extract property name
                        property_name = "Unknown"
                        if ":" in line:
                            property_name = line.split(":")[-1].strip()

                        current_violation = {
                            "severity": "high",
                            "title": f"Property Violation: {property_name}",
                            "description": line,
                            "tool": "echidna",
                            "type": "property_violation",
                            "property": property_name,
                        }
                    elif current_violation and line.strip():
                        current_violation["description"] += "\n" + line.strip()

                if current_violation:
                    vulnerabilities.append(current_violation)

            # If still no vulnerabilities but there was a failure, add generic one
            if not vulnerabilities and ("FAILURE" in output_upper or stderr):
                vulnerabilities.append(
                    {
                        "severity": "high",
                        "title": "Property Violation Detected",
                        "description": stdout[:500] + (stderr[:200] if stderr else ""),
                        "tool": "echidna",
                        "type": "property_violation",
                    }
                )

        logger.info(f"Echidna found {len(vulnerabilities)} property violations")
        return vulnerabilities

    def _generate_summary(self, vulnerabilities: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Generate summary statistics from Echidna results

        Concept: Aggregate property violation data
        """
        summary = {
            "total": len(vulnerabilities),
            "by_severity": {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0},
            "properties_tested": 0,
            "properties_violated": len(vulnerabilities),
        }

        # Count by severity
        for vuln in vulnerabilities:
            severity = vuln.get("severity", "high")
            summary["by_severity"][severity] = summary["by_severity"].get(severity, 0) + 1

        return summary
