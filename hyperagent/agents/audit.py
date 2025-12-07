"""Audit Agent implementation"""

import asyncio
import logging
import os
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from hyperagent.core.agent_system import ServiceInterface
from hyperagent.events.event_bus import EventBus
from hyperagent.events.event_types import Event, EventType
from hyperagent.security.audit import SecurityAuditor

logger = logging.getLogger(__name__)


class AuditAgent(ServiceInterface):
    """
    Audit Agent

    Concept: Security analysis of smart contracts
    Logic: Parallel execution of Slither, Mythril, Echidna
    SLA: p99 < 90s, p95 < 60s
    """

    def __init__(self, security_auditor: SecurityAuditor, event_bus: EventBus):
        self.auditor = security_auditor
        self.event_bus = event_bus

    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run security audit with multiple tools

        Logic:
        1. Compile contract for Mythril (bytecode analysis)
        2. Write contract to temp file for Slither and Echidna
        3. Run all tools in parallel
        4. Aggregate and deduplicate results
        5. Calculate risk score
        6. Format audit report
        """
        workflow_id = input_data.get("workflow_id", str(uuid.uuid4()))
        contract_code = input_data["contract_code"]
        audit_level = input_data.get("audit_level", "standard")  # standard or comprehensive

        # Publish start event
        await self.event_bus.publish(
            Event(
                id=str(uuid.uuid4()),
                type=EventType.AUDIT_STARTED,
                workflow_id=workflow_id,
                timestamp=datetime.now(),
                data={"contract_code_length": len(contract_code), "audit_level": audit_level},
                source_agent="audit",
            )
        )

        # Create temp directory for contract file
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            contract_file = temp_path / "contract.sol"
            contract_file.write_text(contract_code)

            # Compile contract for Mythril
            compilation_result = await self.auditor.compile_contract(contract_code)
            bytecode = (
                compilation_result.get("bytecode") if compilation_result.get("success") else None
            )

            # Build task list
            tasks = [self.auditor.run_slither(contract_code, str(contract_file))]

            # Add Mythril if bytecode available
            if bytecode:
                tasks.append(self.auditor.run_mythril(bytecode))

            # Add Echidna for comprehensive audits
            if audit_level == "comprehensive":
                tasks.append(self.auditor.run_echidna(str(contract_file)))

            # Run tools in parallel with timeout
            try:
                results = await asyncio.wait_for(
                    asyncio.gather(*tasks, return_exceptions=True), timeout=300  # 5 minute timeout
                )
            except asyncio.TimeoutError:
                logger.error("Audit timeout after 5 minutes")
                results = []

        # Aggregate vulnerabilities
        all_vulns = []
        tool_results = {}

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Audit tool error: {result}", exc_info=result)
                tool_results[f"tool_{i}"] = {"status": "error", "error": str(result)}
                continue

            tool_name = result.get("tool", f"tool_{i}")
            tool_results[tool_name] = result

            if result.get("status") == "success":
                vulns = result.get("vulnerabilities", [])
                all_vulns.extend(vulns)

        # Deduplicate vulnerabilities
        all_vulns = self._deduplicate_vulnerabilities(all_vulns)

        # Calculate risk score
        risk_score = self._calculate_risk_score(all_vulns)

        # Generate audit report
        audit_result = {
            "status": "success",
            "vulnerabilities": all_vulns,
            "overall_risk_score": risk_score,
            "audit_status": (
                "passed" if risk_score < 30 else "warning" if risk_score < 70 else "failed"
            ),
            "critical_count": sum(1 for v in all_vulns if v.get("severity") == "critical"),
            "high_count": sum(1 for v in all_vulns if v.get("severity") == "high"),
            "medium_count": sum(1 for v in all_vulns if v.get("severity") == "medium"),
            "low_count": sum(1 for v in all_vulns if v.get("severity") == "low"),
            "info_count": sum(1 for v in all_vulns if v.get("severity") == "info"),
            "tool_results": tool_results,
            "report": self._format_audit_report(all_vulns, risk_score),
        }

        # Publish completion event
        await self.event_bus.publish(
            Event(
                id=str(uuid.uuid4()),
                type=EventType.AUDIT_COMPLETED,
                workflow_id=workflow_id,
                timestamp=datetime.now(),
                data=audit_result,
                source_agent="audit",
            )
        )

        return audit_result

    async def validate(self, data: Dict[str, Any]) -> bool:
        """Validate input has contract code"""
        return bool(data.get("contract_code"))

    async def on_error(self, error: Exception) -> None:
        """Handle audit errors"""
        logger.error(f"Audit agent error: {error}", exc_info=error)
        await self.event_bus.publish(
            Event(
                id=str(uuid.uuid4()),
                type=EventType.AUDIT_FAILED,
                workflow_id="",
                timestamp=datetime.now(),
                data={"error": str(error)},
                source_agent="audit",
            )
        )

    def _calculate_risk_score(self, vulnerabilities: List[Dict]) -> float:
        """
        Calculate aggregate risk score (0-100)

        Concept: Weighted scoring based on severity
        Logic:
            - Critical: 25 points each
            - High: 10 points each
            - Medium: 5 points each
            - Low: 1 point each
            - Cap at 100
        """
        weights = {"critical": 25, "high": 10, "medium": 5, "low": 1, "info": 0}
        score = 0

        for vuln in vulnerabilities:
            severity = vuln.get("severity", "low").lower()
            score += weights.get(severity, 1)

        return min(100, score)

    def _deduplicate_vulnerabilities(self, vulnerabilities: List[Dict]) -> List[Dict]:
        """
        Deduplicate vulnerabilities based on title and description

        Concept: Remove duplicate findings from different tools
        Logic: Group by normalized title/description, keep highest severity
        """
        seen = {}
        deduplicated = []

        for vuln in vulnerabilities:
            # Create key from title and description
            title = vuln.get("title", "").lower().strip()
            desc = vuln.get("description", "").lower().strip()[:100]  # First 100 chars
            key = f"{title}:{desc}"

            if key not in seen:
                seen[key] = vuln
                deduplicated.append(vuln)
            else:
                # Keep the one with higher severity
                existing = seen[key]
                severity_order = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}
                existing_sev = severity_order.get(existing.get("severity", "low").lower(), 0)
                new_sev = severity_order.get(vuln.get("severity", "low").lower(), 0)

                if new_sev > existing_sev:
                    # Replace with higher severity
                    deduplicated.remove(existing)
                    seen[key] = vuln
                    deduplicated.append(vuln)

        return deduplicated

    def _format_audit_report(self, vulnerabilities: List[Dict], risk_score: float) -> str:
        """
        Format audit report as human-readable text

        Concept: Generate formatted report for display
        Logic: Group by severity, format with details
        """
        if not vulnerabilities:
            return f"Audit Report\n============\n\nNo vulnerabilities found.\nRisk Score: {risk_score}/100\n"

        report_lines = [
            "Audit Report",
            "=" * 50,
            f"\nRisk Score: {risk_score}/100",
            f"Status: {'PASSED' if risk_score < 30 else 'WARNING' if risk_score < 70 else 'FAILED'}",
            f"\nTotal Issues: {len(vulnerabilities)}",
            f"  - Critical: {sum(1 for v in vulnerabilities if v.get('severity') == 'critical')}",
            f"  - High: {sum(1 for v in vulnerabilities if v.get('severity') == 'high')}",
            f"  - Medium: {sum(1 for v in vulnerabilities if v.get('severity') == 'medium')}",
            f"  - Low: {sum(1 for v in vulnerabilities if v.get('severity') == 'low')}",
            "\n" + "=" * 50,
            "\nVulnerabilities:\n",
        ]

        # Group by severity
        by_severity = {"critical": [], "high": [], "medium": [], "low": [], "info": []}
        for vuln in vulnerabilities:
            severity = vuln.get("severity", "low").lower()
            by_severity.get(severity, []).append(vuln)

        # Format each severity group
        for severity in ["critical", "high", "medium", "low", "info"]:
            vulns = by_severity[severity]
            if not vulns:
                continue

            report_lines.append(f"\n{severity.upper()} Severity ({len(vulns)}):")
            report_lines.append("-" * 50)

            for i, vuln in enumerate(vulns, 1):
                report_lines.append(f"\n{i}. {vuln.get('title', 'Unknown')}")
                report_lines.append(f"   Tool: {vuln.get('tool', 'unknown')}")
                if vuln.get("description"):
                    desc = vuln["description"][:200]  # First 200 chars
                    report_lines.append(f"   Description: {desc}")

        return "\n".join(report_lines)
