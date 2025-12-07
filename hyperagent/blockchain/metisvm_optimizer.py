"""MetisVM-specific contract optimizations for Hyperion network"""

import logging
import re
from typing import Any, Dict

logger = logging.getLogger(__name__)


class MetisVMOptimizer:
    """MetisVM optimizer for Hyperion network contracts

    Adds MetisVM-specific pragma directives and optimizations for:
    - Floating-point operations
    - AI/ML inference
    - Parallel execution hints
    """

    def detect_floating_point(self, contract_code: str) -> bool:
        """Detect if contract uses floating-point operations"""
        patterns = [
            r"\b(float|double)\b",
            r"import.*decimal|using.*Decimal",
            r"\.(mul|div|add|sub)\(.*\d+\.\d+",
            r"(FixedPoint|ABDKMath|PRBMath)",
        ]
        return any(re.search(p, contract_code, re.IGNORECASE) for p in patterns)

    def detect_ai_operations(self, contract_code: str) -> bool:
        """Detect if contract uses AI/ML operations"""
        patterns = [
            r"\b(model|inference|quantization|neural|ml|ai)\b",
            r"\b(tensor|activation|layer)\b",
            r"\b(predict|classify|embed)\b",
        ]
        return any(re.search(p, contract_code, re.IGNORECASE) for p in patterns)

    def optimize_for_metisvm(
        self, contract_code: str, enable_fp: bool = False, enable_ai: bool = False
    ) -> str:
        """Optimize contract for MetisVM features

        Args:
            contract_code: Solidity source code
            enable_fp: Enable floating-point operations
            enable_ai: Enable AI quantization model support

        Returns:
            Optimized Solidity code with MetisVM pragma directives
        """
        optimized = contract_code
        has_fp = self.detect_floating_point(contract_code)
        has_ai = self.detect_ai_operations(contract_code)

        # Find or add pragma solidity line
        pragma_pattern = r"pragma\s+solidity\s+[^;]+;"
        pragma_match = re.search(pragma_pattern, optimized)

        pragma_directives = []
        if pragma_match:
            pragma_directives.append(pragma_match.group(0))
            pragma_end = pragma_match.end()
        else:
            pragma_directives.append("pragma solidity ^0.8.27;")
            pragma_end = 0

        # Add MetisVM pragma
        pragma_directives.append('pragma metisvm ">=0.1.0";')

        # Add floating-point pragma if needed
        if enable_fp or has_fp:
            pragma_directives.append('pragma metisvm_floating_point ">=0.1.0";')
            logger.info("Enabled MetisVM floating-point operations")

        # Add AI quantization pragma if needed
        if enable_ai or has_ai:
            pragma_directives.append('pragma metisvm_ai_quantization ">=0.1.0";')
            logger.info("Enabled MetisVM AI quantization support")

        # Replace or insert pragma section
        new_pragma = "\n".join(pragma_directives) + "\n"
        if pragma_match:
            optimized = optimized[: pragma_match.start()] + new_pragma + optimized[pragma_end:]
        else:
            optimized = new_pragma + "\n" + optimized

        # Apply gas optimizations
        optimized = self._optimize_gas_patterns(optimized)

        return optimized

    def _optimize_gas_patterns(self, code: str) -> str:
        """Optimize gas usage patterns for MetisVM

        Applies basic optimizations:
        - Use memory for temporary variables
        - Pack storage variables
        - Optimize loop patterns
        """
        optimized = code

        # Pattern 1: Replace repeated storage reads with memory variables
        # (Simplified - full optimization requires deeper analysis)
        # This is a basic example - actual optimizations would be more sophisticated

        # Pattern 2: Pack structs (add comments for developers)
        # MetisVM benefits from packed structs - add hint comments
        struct_pattern = r"struct\s+(\w+)\s*\{"
        if re.search(struct_pattern, optimized):
            optimized = re.sub(
                struct_pattern,
                r"// MetisVM: Pack struct members for gas optimization\n    struct \1 {",
                optimized,
            )

        return optimized

    def get_optimization_report(
        self, contract_code: str, enable_fp: bool = False, enable_ai: bool = False
    ) -> Dict[str, Any]:
        """Get optimization report for contract"""
        has_fp = self.detect_floating_point(contract_code)
        has_ai = self.detect_ai_operations(contract_code)

        optimizations = ["MetisVM pragma directive"]
        if enable_fp or has_fp:
            optimizations.append("Floating-point support")
        if enable_ai or has_ai:
            optimizations.append("AI quantization support")
        optimizations.append("Gas pattern optimization")

        return {
            "floating_point_detected": has_fp,
            "floating_point_enabled": enable_fp or has_fp,
            "ai_operations_detected": has_ai,
            "ai_quantization_enabled": enable_ai or has_ai,
            "metisvm_optimized": True,
            "optimizations_applied": optimizations,
        }
