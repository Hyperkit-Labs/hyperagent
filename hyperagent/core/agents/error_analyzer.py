"""Error analyzer agent for analyzing compilation and audit errors"""

import logging
import re
from typing import Any, Dict, List, Optional

from hyperagent.core.models.error_analysis import (
    ErrorAnalysis,
    ErrorCategory,
    ErrorSeverity,
)
from hyperagent.core.models.fix_suggestion import FixSuggestion, FixStrategy
from hyperagent.core.routing.multi_model_router import MultiModelRouter
from hyperagent.core.memory.long_term_memory import LongTermMemory
from hyperagent.llm.provider import LLMProvider

logger = logging.getLogger(__name__)


class ErrorAnalyzer:
    """Analyzes compilation and audit errors to determine fixability and suggest fixes"""

    def __init__(
        self,
        llm_provider: Optional[LLMProvider] = None,
        multi_model_router: Optional[MultiModelRouter] = None,
        long_term_memory: Optional[LongTermMemory] = None,
    ):
        """
        Initialize Error Analyzer

        Args:
            llm_provider: LLM provider for error analysis
            multi_model_router: Multi-model router for LLM calls
            long_term_memory: Optional long-term memory for retrieving similar failures and fixes
        """
        self.llm_provider = llm_provider
        self.multi_model_router = multi_model_router
        self.long_term_memory = long_term_memory

    async def analyze_compilation_error(
        self, error: Exception, contract_code: str
    ) -> ErrorAnalysis:
        """
        Analyze compilation error and determine fixability

        Args:
            error: The compilation error exception
            contract_code: The contract code that failed to compile

        Returns:
            ErrorAnalysis with fixability assessment
        """
        error_message = str(error)
        error_type = type(error).__name__

        # Extract error details using pattern matching
        category, severity, fixable, confidence = self._classify_compilation_error(
            error_message, error_type
        )

        # Extract location if available
        location = self._extract_error_location(error_message)

        # Generate suggestions using LLM if available
        suggestions = []
        if self.multi_model_router or self.llm_provider:
            try:
                suggestions = await self._generate_suggestions(
                    error_message, contract_code, category
                )
            except Exception as e:
                logger.warning(f"Failed to generate LLM suggestions: {e}")

        return ErrorAnalysis(
            error_type=error_type,
            category=category,
            severity=severity,
            message=error_message,
            location=location,
            fixable=fixable,
            confidence=confidence,
            context=self._extract_context(error_message, contract_code),
            related_errors=self._find_related_errors(error_message),
            suggested_actions=suggestions,
        )

    async def analyze_audit_failure(self, audit_result: Dict[str, Any]) -> ErrorAnalysis:
        """
        Analyze audit failure and determine fixability

        Args:
            audit_result: Audit result dictionary with vulnerabilities

        Returns:
            ErrorAnalysis with fixability assessment
        """
        vulnerabilities = audit_result.get("vulnerabilities", [])
        risk_score = audit_result.get("overall_risk_score", 0)
        audit_status = audit_result.get("audit_status", "unknown")

        # Determine severity based on risk score
        if risk_score >= 50:
            severity = ErrorSeverity.CRITICAL
        elif risk_score >= 30:
            severity = ErrorSeverity.HIGH
        elif risk_score >= 15:
            severity = ErrorSeverity.MEDIUM
        else:
            severity = ErrorSeverity.LOW

        # Classify vulnerabilities
        critical_vulns = [v for v in vulnerabilities if v.get("severity") == "critical"]
        high_vulns = [v for v in vulnerabilities if v.get("severity") == "high"]

        # Most audit issues are fixable (security patterns, missing checks, etc.)
        fixable = len(critical_vulns) == 0 or all(
            self._is_vulnerability_fixable(v) for v in critical_vulns + high_vulns
        )

        # Generate suggestions
        suggestions = []
        for vuln in vulnerabilities[:5]:  # Limit to top 5
            if vuln.get("severity") in ["critical", "high"]:
                suggestions.append(
                    f"Fix {vuln.get('title', 'vulnerability')}: {vuln.get('description', '')[:100]}"
                )

        return ErrorAnalysis(
            error_type="AuditFailure",
            category=ErrorCategory.SECURITY_VULNERABILITY,
            severity=severity,
            message=f"Audit failed with risk score {risk_score}. Found {len(vulnerabilities)} vulnerabilities.",
            location=None,
            fixable=fixable,
            confidence=0.7 if fixable else 0.3,
            context=f"Audit status: {audit_status}. Risk score: {risk_score}",
            related_errors=[v.get("title", "") for v in vulnerabilities[:10]],
            suggested_actions=suggestions,
        )

    async def suggest_fix(
        self, error_analysis: ErrorAnalysis, contract_code: str
    ) -> FixSuggestion:
        """
        Generate fix suggestion based on error analysis

        Args:
            error_analysis: Error analysis result
            contract_code: Current contract code

        Returns:
            FixSuggestion with strategy and details
        """
        # Phase 5: Retrieve similar failures and effective fixes from long-term memory
        similar_failures = []
        effective_fixes = []
        if self.long_term_memory:
            try:
                # Get error categories for retrieval
                error_categories = [error_analysis.category.value] if error_analysis.category else []
                if error_analysis.error_type:
                    error_categories.append(error_analysis.error_type)
                
                # Retrieve similar failures
                similar_failures = await self.long_term_memory.retrieve_similar_failures(
                    error_categories=error_categories,
                    limit=3
                )
                
                # Retrieve effective fixes for this error category
                if error_analysis.category:
                    effective_fixes = await self.long_term_memory.retrieve_effective_fixes(
                        error_category=error_analysis.category.value,
                        limit=2
                    )
                
                if similar_failures or effective_fixes:
                    logger.info(
                        f"Retrieved {len(similar_failures)} similar failures and "
                        f"{len(effective_fixes)} effective fixes from long-term memory"
                    )
            except Exception as e:
                logger.warning(f"Failed to retrieve from long-term memory: {e}", exc_info=True)
        
        # Map error category to fix strategy
        strategy_map = {
            ErrorCategory.MISSING_IMPORT: FixStrategy.ADD_IMPORT,
            ErrorCategory.SYNTAX: FixStrategy.FIX_SYNTAX,
            ErrorCategory.TYPE_MISMATCH: FixStrategy.CORRECT_TYPE,
            ErrorCategory.SECURITY_VULNERABILITY: FixStrategy.ADD_SECURITY_CHECK,
            ErrorCategory.GAS_OPTIMIZATION: FixStrategy.OPTIMIZE_GAS,
            ErrorCategory.LOGIC_ERROR: FixStrategy.REFACTOR_LOGIC,
            ErrorCategory.COMPILATION: FixStrategy.REGENERATE_CODE,
        }

        # If we found effective fixes, use the strategy from the most effective one
        strategy = strategy_map.get(error_analysis.category, FixStrategy.MANUAL_REVIEW)
        if effective_fixes:
            # Use the strategy from the most effective fix
            best_fix = effective_fixes[0]
            improvement_suggestions = best_fix.get("improvement_suggestions", [])
            if improvement_suggestions:
                logger.info(f"Using fix strategy from long-term memory: {improvement_suggestions[0]}")
        
        # Generate detailed fix description using LLM if available
        description = self._generate_fix_description(error_analysis, strategy)
        
        # Enhance description with lessons from similar failures
        if similar_failures:
            lessons = []
            for failure in similar_failures[:2]:  # Use top 2 similar failures
                failure_lessons = failure.get("lessons", [])
                lessons.extend(failure_lessons[:1])  # Take one lesson from each
            
            if lessons:
                description += f"\n\nLessons from similar failures: {', '.join(lessons)}"

        # Determine confidence based on error analysis and memory
        confidence = error_analysis.confidence if error_analysis.fixable else 0.2
        if effective_fixes:
            # Boost confidence if we have effective fixes from memory
            best_effectiveness = effective_fixes[0].get("effectiveness", 0)
            confidence = min(1.0, confidence + (best_effectiveness * 0.2))

        return FixSuggestion(
            strategy=strategy,
            description=description,
            code_changes=None,  # Will be filled by FixGenerator
            confidence=confidence,
            estimated_impact=self._estimate_impact(error_analysis),
            prerequisites=[],
            alternative_strategies=self._get_alternative_strategies(strategy),
        )

    def _classify_compilation_error(
        self, error_message: str, error_type: str
    ) -> tuple[ErrorCategory, ErrorSeverity, bool, float]:
        """Classify compilation error into category, severity, and fixability"""
        error_lower = error_message.lower()

        # Missing import errors
        if "not found" in error_lower or "cannot find" in error_lower or "import" in error_lower:
            return ErrorCategory.MISSING_IMPORT, ErrorSeverity.MEDIUM, True, 0.9

        # Syntax errors
        if (
            "syntax" in error_lower
            or "parsererror" in error_lower
            or "unexpected" in error_lower
            or "expected" in error_lower
        ):
            return ErrorCategory.SYNTAX, ErrorSeverity.HIGH, True, 0.8

        # Type mismatch errors
        if (
            "type" in error_lower
            and ("mismatch" in error_lower or "incompatible" in error_lower)
        ):
            return ErrorCategory.TYPE_MISMATCH, ErrorSeverity.MEDIUM, True, 0.7

        # Unknown errors - try to determine fixability
        if "unboundlocalerror" in error_lower or "nameerror" in error_lower:
            return ErrorCategory.LOGIC_ERROR, ErrorSeverity.MEDIUM, True, 0.6

        # Default: compilation error, may or may not be fixable
        return ErrorCategory.COMPILATION, ErrorSeverity.HIGH, False, 0.5

    def _extract_error_location(self, error_message: str) -> Optional[Dict[str, Any]]:
        """Extract error location from error message"""
        # Pattern: "line X, column Y" or "at line X"
        line_match = re.search(r"line\s+(\d+)", error_message, re.IGNORECASE)
        column_match = re.search(r"column\s+(\d+)", error_message, re.IGNORECASE)
        file_match = re.search(r"file[:\s]+([^\s]+)", error_message, re.IGNORECASE)

        location = {}
        if line_match:
            location["line"] = int(line_match.group(1))
        if column_match:
            location["column"] = int(column_match.group(1))
        if file_match:
            location["file"] = file_match.group(1)

        return location if location else None

    def _extract_context(self, error_message: str, contract_code: str) -> str:
        """Extract relevant context from error message and code"""
        # Extract the problematic line if available
        location = self._extract_error_location(error_message)
        if location and "line" in location:
            line_num = location["line"]
            lines = contract_code.split("\n")
            if 0 < line_num <= len(lines):
                return f"Error at line {line_num}: {lines[line_num - 1]}"

        return error_message[:200]  # First 200 chars of error

    def _find_related_errors(self, error_message: str) -> List[str]:
        """Find related error patterns in the message"""
        related = []
        # Look for multiple error mentions
        if "also" in error_message.lower() or "and" in error_message.lower():
            # Try to split on common separators
            parts = re.split(r"[;\n]", error_message)
            related.extend([p.strip() for p in parts if p.strip()][:5])
        return related

    def _is_vulnerability_fixable(self, vulnerability: Dict[str, Any]) -> bool:
        """Determine if a vulnerability is automatically fixable"""
        title = vulnerability.get("title", "").lower()
        description = vulnerability.get("description", "").lower()

        # Most common fixable vulnerabilities
        fixable_patterns = [
            "reentrancy",
            "missing check",
            "unchecked",
            "overflow",
            "access control",
            "missing modifier",
        ]

        return any(pattern in title or pattern in description for pattern in fixable_patterns)

    async def _generate_suggestions(
        self, error_message: str, contract_code: str, category: ErrorCategory
    ) -> List[str]:
        """Generate fix suggestions using LLM"""
        if not (self.multi_model_router or self.llm_provider):
            return []

        prompt = f"""Analyze this Solidity compilation error and suggest 2-3 specific actions to fix it.

Error: {error_message[:500]}
Error Category: {category.value}

Contract code preview (first 500 chars):
{contract_code[:500]}

Provide 2-3 specific, actionable suggestions to fix this error. Be concise and technical."""

        try:
            if self.multi_model_router:
                response, _ = await self.multi_model_router.route_task(
                    task="gas_optimization",  # Use existing task config
                    context=prompt,
                    budget=10,
                )
            else:
                response = await self.llm_provider.generate(prompt)

            # Parse response into list of suggestions
            suggestions = [
                s.strip()
                for s in response.split("\n")
                if s.strip() and not s.strip().startswith("#")
            ][:3]
            return suggestions
        except Exception as e:
            logger.warning(f"Failed to generate LLM suggestions: {e}")
            return []

    def _generate_fix_description(
        self, error_analysis: ErrorAnalysis, strategy: FixStrategy
    ) -> str:
        """Generate human-readable fix description"""
        descriptions = {
            FixStrategy.ADD_IMPORT: f"Add missing import statement: {error_analysis.message[:100]}",
            FixStrategy.FIX_SYNTAX: f"Fix syntax error: {error_analysis.message[:100]}",
            FixStrategy.CORRECT_TYPE: f"Correct type mismatch: {error_analysis.message[:100]}",
            FixStrategy.ADD_SECURITY_CHECK: f"Add security check for: {error_analysis.message[:100]}",
            FixStrategy.OPTIMIZE_GAS: "Optimize gas usage in contract",
            FixStrategy.REFACTOR_LOGIC: f"Refactor logic to fix: {error_analysis.message[:100]}",
            FixStrategy.REGENERATE_CODE: "Regenerate contract code with corrections",
            FixStrategy.MANUAL_REVIEW: "Requires manual review and intervention",
        }
        return descriptions.get(strategy, f"Apply {strategy.value} strategy")

    def _estimate_impact(self, error_analysis: ErrorAnalysis) -> str:
        """Estimate impact of fixing this error"""
        if error_analysis.severity == ErrorSeverity.CRITICAL:
            return "high"
        elif error_analysis.severity == ErrorSeverity.HIGH:
            return "medium"
        else:
            return "low"

    def _get_alternative_strategies(self, strategy: FixStrategy) -> List[FixStrategy]:
        """Get alternative fix strategies if primary fails"""
        alternatives = {
            FixStrategy.ADD_IMPORT: [FixStrategy.REGENERATE_CODE],
            FixStrategy.FIX_SYNTAX: [FixStrategy.REGENERATE_CODE, FixStrategy.MANUAL_REVIEW],
            FixStrategy.CORRECT_TYPE: [FixStrategy.REGENERATE_CODE],
            FixStrategy.REGENERATE_CODE: [FixStrategy.MANUAL_REVIEW],
        }
        return alternatives.get(strategy, [FixStrategy.MANUAL_REVIEW])

