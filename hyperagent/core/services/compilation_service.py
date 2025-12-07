"""Compilation service implementation"""

import hashlib
import logging
import re
from typing import Any, Dict

from hyperagent.core.agent_system import ServiceInterface

logger = logging.getLogger(__name__)


class CompilationService(ServiceInterface):
    """
    Compilation Service

    Concept: Compile Solidity source code to bytecode and ABI
    Logic:
        1. Extract Solidity version from pragma (or default to 0.8.30)
        2. Ensure correct solc version is available via solc-select
        3. Compile using solcx (py-solc-x)
        4. Extract bytecode, ABI, and contract name
        5. Return compiled contract data
    """

    def __init__(self, default_solc_version: str = "0.8.30"):
        """
        Initialize compilation service

        Args:
            default_solc_version: Default Solidity version if pragma not found
        """
        self.default_solc_version = default_solc_version
        self._ensure_solc_available()

    def _ensure_solc_available(self):
        """
        Ensure Solidity compiler is available via solc-select or system solc

        Logic:
        1. Try solc-select first (preferred method)
        2. Fallback to system solc if solc-select fails
        3. Log warnings if neither is available
        """
        try:
            # Try solc-select first
            import solc_select

            try:
                # Check if default version is installed, install if not
                solc_select.set_target_version(self.default_solc_version, always_install=True)
                logger.info(f"Using solc-select with version {self.default_solc_version}")
                return
            except Exception as e:
                logger.warning(f"solc-select setup failed: {e}, trying system solc")
                self._check_system_solc()
        except ImportError:
            logger.warning("solc-select not available, using system solc")
            self._check_system_solc()

    def _check_system_solc(self):
        """
        Check if system solc is available as fallback

        Checks both:
        - /usr/local/bin/solc (npm solc)
        - solc in PATH (system installation)
        """
        import shutil
        import subprocess

        # Check for solc in PATH
        solc_path = shutil.which("solc")
        if solc_path:
            try:
                result = subprocess.run(
                    ["solc", "--version"], capture_output=True, text=True, timeout=5
                )
                if result.returncode == 0:
                    logger.info(f"System solc available: {result.stdout.strip()[:50]}")
                    return
            except (subprocess.TimeoutExpired, FileNotFoundError):
                pass

        logger.warning(
            "System solc not found. Compilation may fail. Install with: solc-select install 0.8.30"
        )

    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compile Solidity contract to bytecode + ABI

        Args:
            input_data: Dictionary containing:
                - contract_code: Solidity source code (required)

        Returns:
            Dictionary with:
                - status: "success"
                - compiled_contract: {bytecode, abi}
                - contract_name: Extracted contract name
                - contract_code: Original source code (pass-through)
                - solidity_version: Detected or default version
        """
        contract_code = input_data.get("contract_code")
        if not contract_code:
            raise ValueError("contract_code is required for compilation")

        # Strip markdown code blocks if present (safety net)
        contract_code = self._strip_markdown_code_blocks(contract_code)

        try:
            import json
            import os

            from solcx import compile_source, compile_standard, set_solc_version

            # Detect Solidity version from pragma
            solidity_version = self._detect_solidity_version(contract_code)

            # Set solc version before compilation
            # This ensures the correct compiler version is used
            version_to_use = solidity_version
            try:
                set_solc_version(solidity_version, silent=True)
                logger.debug(f"Set solc version to {solidity_version} for compilation")
                version_to_use = solidity_version
            except Exception as e:
                logger.warning(
                    f"Failed to set solc version {solidity_version}: {e}. Trying default version {self.default_solc_version}."
                )
                # Try default version if detected version fails
                try:
                    set_solc_version(self.default_solc_version, silent=True)
                    version_to_use = self.default_solc_version
                    logger.info(f"Using default solc version {self.default_solc_version} instead")
                except Exception as e2:
                    logger.warning(
                        f"Failed to set default solc version {self.default_solc_version}: {e2}. Will not specify version in compile_standard."
                    )
                    # Don't pass solc_version to compile_standard - let it use whatever is available
                    version_to_use = None

            # Configure import paths for OpenZeppelin contracts
            # Use environment variable or default to /app/node_modules
            node_modules_path = os.getenv("NODE_MODULES_PATH", "/app/node_modules")
            import_remappings = {}

            if os.path.exists(node_modules_path):
                # Create remappings for OpenZeppelin and other common packages
                openzeppelin_path = os.path.join(node_modules_path, "@openzeppelin")
                nomicfoundation_path = os.path.join(node_modules_path, "@nomicfoundation")

                if os.path.exists(openzeppelin_path):
                    import_remappings["@openzeppelin/"] = openzeppelin_path + "/"
                    logger.debug(f"Configured OpenZeppelin import path: {openzeppelin_path}")

                if os.path.exists(nomicfoundation_path):
                    import_remappings["@nomicfoundation/"] = nomicfoundation_path + "/"
                    logger.debug(f"Configured NomicFoundation import path: {nomicfoundation_path}")

            # Compile contract with import remappings
            # Use compile_standard for better control over compilation options
            if import_remappings:
                # Use compile_standard which supports settings.remappings
                compile_input = {
                    "language": "Solidity",
                    "sources": {"contract.sol": {"content": contract_code}},
                    "settings": {
                        "outputSelection": {
                            "*": {
                                "*": [
                                    "abi",
                                    "evm.bytecode",
                                    "evm.deployedBytecode",
                                    "evm.bytecode.object",
                                    "evm.deployedBytecode.object",
                                ]
                            }
                        },
                        "remappings": (
                            [f"{k}={v}" for k, v in import_remappings.items()]
                            if import_remappings
                            else []
                        ),
                        "optimizer": {"enabled": False},
                    },
                }

                # Use the version that was successfully set (may have been changed by fallback)
                if version_to_use:
                    compiled_output = compile_standard(compile_input, solc_version=version_to_use)
                else:
                    # Don't specify version - use whatever is currently set
                    compiled_output = compile_standard(compile_input)

                # Convert compile_standard output to compile_source format for compatibility
                if "contracts" not in compiled_output or not compiled_output["contracts"]:
                    raise ValueError("Compilation returned empty result")

                # Extract contract from standard JSON output
                contracts = compiled_output["contracts"]["contract.sol"]
                if not contracts:
                    raise ValueError("No contracts found in compilation output")

                # Get first contract
                contract_name = list(contracts.keys())[0]
                contract_data = contracts[contract_name]

                # Convert to compile_source format
                compiled = {
                    f"<stdin>:{contract_name}": {
                        "abi": contract_data.get("abi", []),
                        "evm": {
                            "bytecode": {
                                "object": contract_data.get("evm", {})
                                .get("bytecode", {})
                                .get("object", "")
                            },
                            "deployedBytecode": {
                                "object": contract_data.get("evm", {})
                                .get("deployedBytecode", {})
                                .get("object", "")
                            },
                        },
                    }
                }
            else:
                # No remappings needed, use standard compile_source
                # Note: compile_source uses the version set by set_solc_version above
                compiled = compile_source(contract_code)

            if not compiled:
                raise ValueError("Compilation returned empty result")

            # Get first contract (py-solc-x returns dict with keys like "<stdin>:ContractName")
            contract_key = list(compiled.keys())[0]
            contract_data = compiled[contract_key]

            # Extract contract name from key (format: "<stdin>:ContractName")
            contract_name = contract_key.split(":")[-1] if ":" in contract_key else "Contract"

            # Extract bytecode and ABI
            bytecode = contract_data.get("evm", {}).get("bytecode", {}).get("object", "")
            abi = contract_data.get("abi", [])

            # Extract deployed bytecode (runtime bytecode)
            deployed_bytecode = (
                contract_data.get("evm", {}).get("deployedBytecode", {}).get("object", "")
            )

            if not bytecode:
                raise ValueError("Compilation succeeded but no bytecode found")

            logger.info(
                f"Successfully compiled contract '{contract_name}' (Solidity {solidity_version})"
            )

            return {
                "status": "success",
                "compiled_contract": {
                    "bytecode": bytecode,
                    "abi": abi,
                    "deployed_bytecode": deployed_bytecode,
                },
                "contract_name": contract_name,
                "contract_code": contract_code,  # Pass through for audit/testing
                "solidity_version": solidity_version,
                "source_code_hash": self._calculate_hash(contract_code),
            }

        except ImportError:
            error_msg = "solcx (py-solc-x) not installed. Install with: pip install py-solc-x"
            logger.error(error_msg)
            raise ValueError(error_msg)
        except Exception as e:
            error_msg = f"Compilation failed: {str(e)}"
            logger.error(error_msg, exc_info=True)
            raise ValueError(error_msg)

    async def validate(self, data: Dict[str, Any]) -> bool:
        """
        Validate compilation input

        Args:
            data: Input data dictionary

        Returns:
            True if contract_code exists and is non-empty
        """
        contract_code = data.get("contract_code")
        if not contract_code:
            return False
        return len(contract_code.strip()) > 0

    async def on_error(self, error: Exception) -> None:
        """Handle compilation errors"""
        logger.error(f"Compilation service error: {error}", exc_info=True)

    def _strip_markdown_code_blocks(self, text: str) -> str:
        """
        Strip markdown code blocks from contract code (safety net)

        This is a fallback in case markdown wasn't stripped earlier in the pipeline.
        Handles cases where code blocks weren't properly extracted.

        Args:
            text: Contract code that may contain markdown formatting

        Returns:
            Clean Solidity code without markdown
        """
        from hyperagent.utils.markdown import strip_markdown_code_blocks

        return strip_markdown_code_blocks(text)

    def _detect_solidity_version(self, contract_code: str) -> str:
        """
        Detect Solidity version from pragma statement

        Args:
            contract_code: Solidity source code

        Returns:
            Detected version or default version
        """
        # Match pragma solidity ^0.8.27; or pragma solidity 0.8.27;
        pragma_pattern = r"pragma\s+solidity\s+([\^>=<]?)(\d+\.\d+\.\d+)"
        match = re.search(pragma_pattern, contract_code, re.IGNORECASE)

        if match:
            version = match.group(2)
            logger.debug(f"Detected Solidity version: {version}")
            return version

        logger.debug(f"No pragma found, using default version: {self.default_solc_version}")
        return self.default_solc_version

    def _calculate_hash(self, source_code: str) -> str:
        """
        Calculate SHA256 hash of source code for integrity verification

        Args:
            source_code: Solidity source code

        Returns:
            Hex string of SHA256 hash (66 chars with 0x prefix)
        """
        hash_obj = hashlib.sha256(source_code.encode("utf-8"))
        return "0x" + hash_obj.hexdigest()
