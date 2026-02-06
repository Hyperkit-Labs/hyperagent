"""Audit service implementation"""

import logging
from typing import Any, Dict, List

from hyperagent.core.agent_system import ServiceInterface
from hyperagent.security.audit import SecurityAuditor

logger = logging.getLogger(__name__)


class AuditService(ServiceInterface):
    """Security auditing service"""

    def __init__(self, security_auditor: SecurityAuditor):
        self.security_auditor = security_auditor

    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Run security audits on contract"""
        contract_code = input_data.get("contract_code")

        try:
            # Run Slither
            slither_result = await self.security_auditor.run_slither(contract_code)

            # Aggregate findings
            vulnerabilities = slither_result.get("vulnerabilities", [])

            # Calculate risk score
            risk_score = self._calculate_risk_score(vulnerabilities)

            # Classify vulnerabilities by fixability
            fixable_vulns, unfixable_vulns = self._classify_vulnerabilities(vulnerabilities)

            # Generate fix suggestions for fixable vulnerabilities
            fix_suggestions = self._generate_fix_suggestions(fixable_vulns)

            audit_status = "passed" if risk_score < 30 else "failed"

            return {
                "status": "success" if audit_status == "passed" else "failed",
                "vulnerabilities": vulnerabilities,
                "fixable_vulnerabilities": fixable_vulns,
                "unfixable_vulnerabilities": unfixable_vulns,
                "overall_risk_score": risk_score,
                "audit_status": audit_status,
                "fix_suggestions": fix_suggestions,
                "contract_code": contract_code,  # Include for fix generation
            }
        except Exception as e:
            logger.error(f"Audit service error: {e}", exc_info=True)
            return {
                "status": "error",
                "error": {
                    "type": type(e).__name__,
                    "message": str(e),
                    "original_error": str(e),
                    "contract_code": contract_code,
                },
            }

    async def validate(self, data: Dict[str, Any]) -> bool:
        """Validate input has contract code"""
        return bool(data.get("contract_code"))

    async def on_error(self, error: Exception) -> None:
        """Handle service-specific errors"""
        print(f"Audit service error: {error}")

    def _calculate_risk_score(self, vulnerabilities: list) -> float:
        """Calculate aggregate risk score (0-100)"""
        weights = {"critical": 25, "high": 10, "medium": 5, "low": 1}
        score = 0

        for vuln in vulnerabilities:
            severity = vuln.get("severity", "low")
            score += weights.get(severity, 1)

        return min(100, score)

    def _classify_vulnerabilities(
        self, vulnerabilities: List[Dict[str, Any]]
    ) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Classify vulnerabilities as fixable or unfixable"""
        fixable = []
        unfixable = []

        fixable_patterns = [
            "reentrancy",
            "missing check",
            "unchecked",
            "overflow",
            "access control",
            "missing modifier",
            "uninitialized",
            "unused",
        ]

        for vuln in vulnerabilities:
            title = vuln.get("title", "").lower()
            description = vuln.get("description", "").lower()
            severity = vuln.get("severity", "low")

            # Most vulnerabilities are fixable except architectural issues
            is_fixable = any(
                pattern in title or pattern in description for pattern in fixable_patterns
            ) or severity in ["low", "medium"]

            # Critical architectural issues are usually unfixable automatically
            if severity == "critical" and not is_fixable:
                unfixable.append(vuln)
            else:
                fixable.append(vuln)

        return fixable, unfixable

    def _generate_fix_suggestions(
        self, fixable_vulns: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Generate fix suggestions for fixable vulnerabilities"""
        suggestions = []

        for vuln in fixable_vulns[:10]:  # Limit to top 10
            title = vuln.get("title", "")
            severity = vuln.get("severity", "low")
            description = vuln.get("description", "")

            # Generate suggestion based on vulnerability type
            suggestion = self._get_fix_suggestion_for_vuln(title, description, severity)
            suggestions.append(
                {
                    "vulnerability": title,
                    "severity": severity,
                    "suggestion": suggestion,
                    "description": description[:200],
                }
            )

        return suggestions

    def _get_fix_suggestion_for_vuln(
        self, title: str, description: str, severity: str
    ) -> str:
        """Get specific fix suggestion for a vulnerability"""
        title_lower = title.lower()
        desc_lower = description.lower()

        if "reentrancy" in title_lower or "reentrancy" in desc_lower:
            return "Add ReentrancyGuard modifier to functions that make external calls"
        elif "unchecked" in title_lower or "unchecked" in desc_lower:
            return "Add require() or revert() statements to validate conditions"
        elif "access control" in title_lower or "access control" in desc_lower:
            return "Add access control modifiers (e.g., onlyOwner, onlyRole)"
        elif "overflow" in title_lower or "overflow" in desc_lower:
            return "Use SafeMath or Solidity 0.8+ built-in overflow protection"
        elif "uninitialized" in title_lower:
            return "Initialize variables before use"
        elif "missing modifier" in desc_lower:
            return "Add appropriate modifier to function"
        else:
            return f"Review and fix {title} vulnerability"
