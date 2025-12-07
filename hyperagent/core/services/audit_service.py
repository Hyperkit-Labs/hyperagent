"""Audit service implementation"""

from typing import Any, Dict

from hyperagent.core.agent_system import ServiceInterface
from hyperagent.security.audit import SecurityAuditor


class AuditService(ServiceInterface):
    """Security auditing service"""

    def __init__(self, security_auditor: SecurityAuditor):
        self.security_auditor = security_auditor

    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Run security audits on contract"""
        contract_code = input_data.get("contract_code")

        # Run Slither
        slither_result = await self.security_auditor.run_slither(contract_code)

        # Aggregate findings
        vulnerabilities = slither_result.get("vulnerabilities", [])

        # Calculate risk score
        risk_score = self._calculate_risk_score(vulnerabilities)

        return {
            "status": "success",
            "vulnerabilities": vulnerabilities,
            "overall_risk_score": risk_score,
            "audit_status": "passed" if risk_score < 30 else "failed",
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
