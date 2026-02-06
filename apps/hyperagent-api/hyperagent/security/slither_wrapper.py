"""Slither analyzer wrapper"""

import json
import logging
import os
import subprocess
import tempfile
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class SlitherWrapper:
    """
    Slither Wrapper

    Concept: Python wrapper for Slither static analyzer
    Logic: Execute Slither, parse JSON output, extract vulnerabilities
    """

    def __init__(self):
        self.available = self._check_availability()

    def _check_availability(self) -> bool:
        """Check if Slither is installed"""
        try:
            subprocess.run(["slither", "--version"], capture_output=True, check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            return False

    async def analyze(self, contract_code: str, contract_path: str = None) -> Dict[str, Any]:
        """
        Analyze contract with Slither

        Logic:
        1. Write contract to temporary file
        2. Run Slither with JSON output
        3. Parse results
        4. Extract vulnerabilities by severity
        """
        if not self.available:
            return {"status": "error", "message": "Slither not available", "vulnerabilities": []}

        # Use provided path or create temp file
        if not contract_path:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".sol", delete=False) as f:
                f.write(contract_code)
                contract_path = f.name
            temp_file = True
        else:
            temp_file = False

        try:
            # Run Slither
            result = subprocess.run(
                ["slither", contract_path, "--json", "-"],
                capture_output=True,
                text=True,
                timeout=300,
            )

            if result.returncode == 0:
                slither_data = json.loads(result.stdout)
                vulnerabilities = self._parse_results(slither_data)
                summary = self._generate_summary(vulnerabilities)

                return {
                    "status": "success",
                    "vulnerabilities": vulnerabilities,
                    "tool": "slither",
                    "summary": summary,
                    "total_issues": len(vulnerabilities),
                }
            else:
                return {"status": "error", "message": result.stderr, "vulnerabilities": []}

        except subprocess.TimeoutExpired:
            return {
                "status": "timeout",
                "message": "Slither analysis timed out",
                "vulnerabilities": [],
            }

        finally:
            if temp_file and os.path.exists(contract_path):
                os.unlink(contract_path)

    def _parse_results(self, slither_data: Dict) -> List[Dict[str, Any]]:
        """
        Parse Slither JSON output into vulnerability list

        Concept: Extract and categorize vulnerabilities from Slither output
        Logic:
            1. Parse detectors from results
            2. Map Slither impact to standard severity
            3. Extract location information
            4. Format vulnerability data
        """
        vulnerabilities = []

        # Slither structure: results.detectors
        detectors = slither_data.get("results", {}).get("detectors", [])

        for detector in detectors:
            # Map Slither impact to standard severity
            impact = detector.get("impact", "Informational")
            severity = self._map_severity(impact)

            # Extract location information
            elements = detector.get("elements", [])
            locations = []
            for element in elements:
                if isinstance(element, dict):
                    source_mapping = element.get("source_mapping", {})
                    locations.append(
                        {
                            "file": source_mapping.get("filename_absolute", ""),
                            "line": (
                                source_mapping.get("lines", [None])[0]
                                if source_mapping.get("lines")
                                else None
                            ),
                            "function": element.get("name", ""),
                            "type": element.get("type", ""),
                        }
                    )

            vulnerability = {
                "severity": severity,
                "title": detector.get("check", "Unknown"),
                "description": detector.get("description", ""),
                "tool": "slither",
                "confidence": detector.get("confidence", "unknown").lower(),
                "impact": impact,
                "locations": locations,
                "swc_id": detector.get(
                    "swc_id", ""
                ),  # SWC (Smart Contract Weakness Classification)
                "markdown": detector.get("markdown", ""),
                "first_markdown_element": detector.get("first_markdown_element", ""),
            }

            vulnerabilities.append(vulnerability)

        logger.info(f"Parsed {len(vulnerabilities)} vulnerabilities from Slither")
        return vulnerabilities

    def _map_severity(self, impact: str) -> str:
        """
        Map Slither impact to standard severity levels

        Concept: Normalize severity across different tools
        Logic:
            - High/Medium/Low/Informational → critical/high/medium/low/info
            - Handle edge cases and unknown values

        Args:
            impact: Slither impact level

        Returns:
            Standardized severity string
        """
        mapping = {
            "High": "high",
            "Medium": "medium",
            "Low": "low",
            "Informational": "info",
            "Optimization": "info",
        }

        severity = mapping.get(impact, "info")

        # Additional mapping for critical issues
        critical_keywords = ["critical", "severe", "dangerous"]
        if any(keyword in impact.lower() for keyword in critical_keywords):
            severity = "critical"

        return severity

    def _generate_summary(self, vulnerabilities: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Generate summary statistics from vulnerabilities

        Concept: Aggregate vulnerability data for reporting
        Logic:
            1. Count by severity
            2. Count by confidence
            3. Identify most common issues
        """
        summary = {
            "total": len(vulnerabilities),
            "by_severity": {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0},
            "by_confidence": {"high": 0, "medium": 0, "low": 0},
            "top_issues": [],
        }

        # Count by severity
        for vuln in vulnerabilities:
            severity = vuln.get("severity", "info")
            summary["by_severity"][severity] = summary["by_severity"].get(severity, 0) + 1

            # Count by confidence
            confidence = vuln.get("confidence", "unknown").lower()
            if confidence in summary["by_confidence"]:
                summary["by_confidence"][confidence] += 1

        # Find top issues (by frequency)
        issue_counts = {}
        for vuln in vulnerabilities:
            title = vuln.get("title", "Unknown")
            issue_counts[title] = issue_counts.get(title, 0) + 1

        # Sort by count and get top 5
        top_issues = sorted(issue_counts.items(), key=lambda x: x[1], reverse=True)[:5]
        summary["top_issues"] = [{"title": title, "count": count} for title, count in top_issues]

        return summary
