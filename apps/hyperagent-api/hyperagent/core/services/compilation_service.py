"""Compilation service implementation"""

import hashlib
import logging
import re
from typing import Any, Dict

from hyperagent.core.agent_system import ServiceInterface

logger = logging.getLogger(__name__)


class CompilationService(ServiceInterface):
    """Compiles Solidity source code to bytecode and ABI"""

    def __init__(self, default_solc_version: str = "0.8.27"):
        """
        Initialize compilation service

        Args:
            default_solc_version: Default Solidity version if pragma not found
            Standardized to 0.8.27 to match generation service pragma
        """
        self.default_solc_version = default_solc_version
        # Supported versions: 0.8.20 - 0.8.28 (installed: 0.8.20, 0.8.27, 0.8.28, 0.8.30)
        self.available_versions = ["0.8.20", "0.8.27", "0.8.28", "0.8.30"]
        self._ensure_solc_available()

    def _ensure_solc_available(self):
        """Ensure Solidity compiler is available via solc-select or system solc"""
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
            f"System solc not found. Compilation may fail. Install with: solc-select install {self.default_solc_version}"
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
        from hyperagent.utils.markdown import strip_markdown_code_blocks
        contract_code = strip_markdown_code_blocks(contract_code)
        
        # Remove template placeholders that might have been generated
        from hyperagent.utils.markdown import clean_template_placeholders
        original_code = contract_code
        contract_code = clean_template_placeholders(contract_code)
        
        # Warn if placeholders were found (for debugging)
        if original_code != contract_code:
            import re
            placeholder_pattern = r'\{+\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}+'
            found_placeholders = re.findall(placeholder_pattern, original_code)
            if found_placeholders:
                logger.warning(f"Found and replaced template placeholders: {found_placeholders}")
        
        # Clean malformed docstrings that might cause DocstringParsingError
        contract_code = self._clean_docstrings(contract_code)
        
        # Additional code cleaning for common parser errors
        contract_code = self._clean_common_parser_issues(contract_code)
        
        # Pre-compilation validation: check for remaining placeholders
        placeholder_check = re.search(r'\{+\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\}+', contract_code)
        if placeholder_check:
            logger.error(f"Found unreplaced placeholder in code: {placeholder_check.group()}")
            # Try to clean again with more aggressive pattern
            contract_code = re.sub(r'\{+\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}+', '0', contract_code)

        try:
            import json
            import os

            from solcx import compile_source, compile_standard, set_solc_version

            # Detect Solidity version from pragma
            solidity_version = self._detect_solidity_version(contract_code)

            # Set solc version before compilation
            # This ensures the correct compiler version is used
            version_to_use = solidity_version
            
            # Try to install version if not available
            try:
                from solcx import get_installed_solc_versions, install_solc
                installed_versions = get_installed_solc_versions()
                
                if solidity_version not in installed_versions:
                    logger.info(f"Version {solidity_version} not installed, attempting to install...")
                    try:
                        install_solc(solidity_version)
                        logger.info(f"Successfully installed solc {solidity_version}")
                    except Exception as install_error:
                        logger.warning(f"Failed to install {solidity_version}: {install_error}")
                        # Try to use closest available version
                        if solidity_version in self.available_versions:
                            # Try another available version
                            for alt_version in self.available_versions:
                                if alt_version in installed_versions:
                                    logger.info(f"Using alternative installed version: {alt_version}")
                                    version_to_use = alt_version
                                    break
                        else:
                            # Use default if version not in available list
                            version_to_use = self.default_solc_version
                            logger.info(f"Using default version: {version_to_use}")
            except ImportError:
                logger.warning("solcx not available for version checking")
            
            try:
                set_solc_version(version_to_use, silent=True)
                logger.info(f"Set solc version to {version_to_use} for compilation")
            except Exception as e:
                logger.warning(
                    f"Failed to set solc version {version_to_use}: {e}. "
                    f"Trying default version {self.default_solc_version}."
                )
                # Try default version if detected version fails
                try:
                    set_solc_version(self.default_solc_version, silent=True)
                    version_to_use = self.default_solc_version
                    logger.info(f"Using default solc version {self.default_solc_version} instead")
                    
                    # Update pragma in contract code to match compiler version if mismatch
                    if solidity_version != self.default_solc_version:
                        logger.warning(
                            f"Pragma version {solidity_version} not available, "
                            f"using {self.default_solc_version}. Updating pragma in contract."
                        )
                        # Update pragma to match compiler version
                        contract_code = re.sub(
                            r'pragma\s+solidity\s+[^;]+;',
                            f'pragma solidity ^{self.default_solc_version};',
                            contract_code,
                            flags=re.IGNORECASE
                        )
                except Exception as e2:
                    logger.error(
                        f"Failed to set default solc version {self.default_solc_version}: {e2}. "
                        f"Will attempt compilation without version specification."
                    )
                    # Don't pass solc_version to compile_standard - let it use whatever is available
                    version_to_use = None

            # Configure import paths for OpenZeppelin contracts
            # Use environment variable or default to /app/node_modules
            node_modules_path = os.getenv("NODE_MODULES_PATH", "/app/node_modules")
            import_remappings = []
            include_paths = []

            # Always add node_modules to remappings if it exists
            if os.path.exists(node_modules_path):
                logger.info(f"Found node_modules at: {node_modules_path}")
                
                # Add node_modules to include paths so solc can find imports
                include_paths.append(node_modules_path)
                
                # Create remappings for OpenZeppelin and other common packages
                openzeppelin_path = os.path.join(node_modules_path, "@openzeppelin")
                openzeppelin_contracts_path = os.path.join(openzeppelin_path, "contracts")
                nomicfoundation_path = os.path.join(node_modules_path, "@nomicfoundation")

                # Verify OpenZeppelin installation
                if os.path.exists(openzeppelin_path):
                    # Check if contracts directory exists
                    if os.path.exists(openzeppelin_contracts_path):
                        # Map @openzeppelin/ to /app/node_modules/@openzeppelin/
                        # So @openzeppelin/contracts/... resolves to /app/node_modules/@openzeppelin/contracts/...
                        remapping = f"@openzeppelin/={openzeppelin_path}/"
                        import_remappings.append(remapping)
                        logger.info(f"Configured OpenZeppelin import path: {remapping}")
                        
                        # Verify installation by checking for common files (check multiple locations)
                        # OpenZeppelin v4.x has ReentrancyGuard in security/, v5.x might have it in utils/
                        test_files = [
                            os.path.join(openzeppelin_contracts_path, "security", "ReentrancyGuard.sol"),
                            os.path.join(openzeppelin_contracts_path, "utils", "ReentrancyGuard.sol"),
                            os.path.join(openzeppelin_contracts_path, "token", "ERC20", "ERC20.sol"),  # Common file
                        ]
                        found_file = None
                        for test_file in test_files:
                            if os.path.exists(test_file):
                                found_file = test_file
                                break
                        
                        if found_file:
                            logger.info(f"Verified OpenZeppelin installation - found: {found_file}")
                        else:
                            # List available directories to help debug
                            try:
                                dirs = [d for d in os.listdir(openzeppelin_contracts_path) 
                                       if os.path.isdir(os.path.join(openzeppelin_contracts_path, d))]
                                logger.warning(
                                    f"OpenZeppelin contracts directory exists but common files not found. "
                                    f"Available directories: {dirs[:10]}"
                                )
                            except Exception:
                                logger.warning("OpenZeppelin contracts directory exists but could not list contents")
                    else:
                        logger.error(f"OpenZeppelin contracts directory not found at {openzeppelin_contracts_path}")
                else:
                    logger.error(f"OpenZeppelin not found at {openzeppelin_path}. Installation may have failed.")

                # Check and add NomicFoundation remapping
                if os.path.exists(nomicfoundation_path):
                    remapping = f"@nomicfoundation/={nomicfoundation_path}/"
                    import_remappings.append(remapping)
                    logger.info(f"Configured NomicFoundation import path: {remapping}")
            else:
                logger.error(f"node_modules not found at {node_modules_path}. OpenZeppelin imports will fail.")
                logger.error("This indicates OpenZeppelin was not installed in the Docker container.")
                logger.error("Please rebuild the Docker image: docker compose build --no-cache")

            # Compile contract with import remappings
            # Use compile_standard for better control over compilation options
            # Always use compile_standard to support remappings properly
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
                    "remappings": import_remappings,
                    "optimizer": {"enabled": False},
                },
            }
            
            # Add includePaths if available (some solc versions support this)
            # This helps solc find imports even without explicit remappings
            if include_paths:
                # Note: includePaths is not standard JSON but some solc versions support it
                # We'll rely on remappings primarily, but log include paths for debugging
                logger.info(f"Available include paths: {include_paths}")
            
            if import_remappings:
                logger.info(f"Compiling with remappings: {import_remappings}")
            else:
                logger.warning("Compiling without remappings - OpenZeppelin imports may fail")

            # Use the version that was successfully set (may have been changed by fallback)
            try:
                if version_to_use:
                    compiled_output = compile_standard(compile_input, solc_version=version_to_use)
                else:
                    # Don't specify version - use whatever is currently set
                    compiled_output = compile_standard(compile_input)
            except Exception as compile_error:
                # Extract detailed error information from Solidity compiler
                error_details = self._extract_compilation_errors(compile_error, contract_code)
                
                # Log the full error for debugging
                logger.error(f"Compilation failed with error: {error_details}", exc_info=True)
                logger.error(f"Contract code length: {len(contract_code)} chars")
                logger.error(f"Contract code preview (first 500 chars):\n{contract_code[:500]}")
                
                # Return structured error for feedback loops
                return {
                    "status": "error",
                    "error": {
                        "type": type(compile_error).__name__,
                        "message": error_details,
                        "original_error": str(compile_error),
                        "contract_code": contract_code,
                        "contract_code_length": len(contract_code),
                    },
                }

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
            return {
                "status": "error",
                "error": {
                    "type": "ImportError",
                    "message": error_msg,
                    "original_error": error_msg,
                    "contract_code": contract_code if 'contract_code' in locals() else "",
                    "contract_code_length": len(contract_code) if 'contract_code' in locals() else 0,
                },
            }
        except ValueError as e:
            # Return structured error information for feedback loops
            error_details = self._extract_compilation_errors(e, contract_code)
            original_error_str = str(e)
            if len(error_details) < len(original_error_str) and original_error_str not in error_details:
                error_details = f"{error_details}\n\nFull error details: {original_error_str}"
            
            logger.error(f"Compilation failed: {error_details}", exc_info=True)
            
            # Return structured error instead of raising
            return {
                "status": "error",
                "error": {
                    "type": "ValueError",
                    "message": error_details,
                    "original_error": original_error_str,
                    "contract_code": contract_code,
                    "contract_code_length": len(contract_code),
                },
            }
        except Exception as e:
            # Extract detailed error information
            error_details = self._extract_compilation_errors(e, contract_code)
            
            # Ensure error message is complete and not truncated
            original_error_str = str(e)
            if len(error_details) < len(original_error_str) and original_error_str not in error_details:
                # If extracted error is shorter than original, include both
                error_details = f"{error_details}\n\nFull error details: {original_error_str}"
            
            logger.error(f"Compilation failed: {error_details}", exc_info=True)
            logger.error(f"Contract code length: {len(contract_code)} chars")
            logger.error(f"Contract code preview (first 200 chars):\n{contract_code[:200]}")
            
            # Return structured error instead of raising
            return {
                "status": "error",
                "error": {
                    "type": type(e).__name__,
                    "message": error_details,
                    "original_error": original_error_str,
                    "contract_code": contract_code,
                    "contract_code_length": len(contract_code),
                },
            }

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


    def _detect_solidity_version(self, contract_code: str) -> str:
        """
        Detect Solidity version from pragma statement
        
        Handles:
        - Exact versions: pragma solidity 0.8.27;
        - Range versions: pragma solidity ^0.8.27; or pragma solidity >=0.8.0 <0.9.0;
        
        For range versions, uses the default compiler version (0.8.27) which satisfies most ranges.

        Args:
            contract_code: Solidity source code

        Returns:
            Detected version or default version
        """
        # Match pragma solidity with version or range
        # Examples: pragma solidity ^0.8.27; pragma solidity 0.8.27; pragma solidity >=0.8.0 <0.9.0;
        pragma_pattern = r"pragma\s+solidity\s+([\^>=<!\s\d\.]+);"
        match = re.search(pragma_pattern, contract_code, re.IGNORECASE)

        if match:
            pragma_expr = match.group(1).strip()
            
            # Check if it's an exact version (no ^, >=, <, etc.)
            exact_version_pattern = r"^(\d+\.\d+\.\d+)$"
            exact_match = re.match(exact_version_pattern, pragma_expr)
            
            if exact_match:
                version = exact_match.group(1)
                logger.debug(f"Detected exact Solidity version: {version}")
                return version
            
            # Check if it's a caret range (^0.8.27)
            caret_pattern = r"\^(\d+\.\d+\.\d+)"
            caret_match = re.search(caret_pattern, pragma_expr)
            if caret_match:
                base_version = caret_match.group(1)
                logger.debug(f"Detected caret range: {pragma_expr}, base version: {base_version}")
                
                # Parse version components
                try:
                    major, minor, patch = map(int, base_version.split('.'))
                    
                    # Check if version is in supported range (0.8.20 - 0.8.28)
                    if major == 0 and minor == 8 and 20 <= patch <= 28:
                        # Find the best matching installed version
                        # Prefer exact match, then closest available version
                        if base_version in self.available_versions:
                            logger.debug(f"Using exact match: {base_version}")
                            return base_version
                        
                        # Find closest available version
                        # For 0.8.20-0.8.27, prefer 0.8.27 (most common)
                        # For 0.8.28, use 0.8.28 (exact match available)
                        # For 0.8.29+, use 0.8.30 (closest available)
                        if patch <= 27:
                            # Use 0.8.27 for versions 0.8.20-0.8.27
                            selected = "0.8.27"
                            logger.debug(f"Version {base_version} in range 0.8.20-0.8.27, using {selected}")
                        elif patch == 28:
                            # Use 0.8.28 for exact match
                            selected = "0.8.28"
                            logger.debug(f"Version {base_version} is 0.8.28, using {selected}")
                        else:
                            # Use 0.8.30 for 0.8.29+ (closest available)
                            selected = "0.8.30"
                            logger.debug(f"Version {base_version} >= 0.8.29, using {selected}")
                        
                        return selected
                    else:
                        # Version outside supported range, use default
                        logger.warning(f"Version {base_version} outside supported range (0.8.20-0.8.28), using default {self.default_solc_version}")
                        return self.default_solc_version
                except ValueError:
                    # Invalid version format, use default
                    logger.warning(f"Invalid version format: {base_version}, using default {self.default_solc_version}")
                    return self.default_solc_version
            
            # For complex ranges (>=0.8.0 <0.9.0), use default version
            # Our default (0.8.27) satisfies most 0.8.x ranges
            logger.debug(f"Detected complex pragma range: {pragma_expr}, using default version: {self.default_solc_version}")
            return self.default_solc_version

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

    def _clean_docstrings(self, contract_code: str) -> str:
        """
        Clean malformed NatSpec docstrings that might cause DocstringParsingError
        
        This function attempts to fix common docstring issues:
        - Unclosed multi-line comments
        - Invalid NatSpec tag syntax
        - Malformed comment blocks
        
        Args:
            contract_code: Solidity source code that may contain malformed docstrings
            
        Returns:
            Cleaned contract code with fixed docstrings
        """
        lines = contract_code.split('\n')
        cleaned_lines = []
        in_multiline_comment = False
        multiline_start = -1
        
        for i, line in enumerate(lines):
            stripped = line.strip()
            
            # Check for start of multi-line comment
            if '/**' in stripped and not in_multiline_comment:
                in_multiline_comment = True
                multiline_start = i
                cleaned_lines.append(line)
                continue
            
            # Check for end of multi-line comment
            if '*/' in stripped and in_multiline_comment:
                in_multiline_comment = False
                cleaned_lines.append(line)
                continue
            
            # If we're in a multi-line comment, check for common issues
            if in_multiline_comment:
                # Check if line looks like it should end the comment but doesn't have */
                if stripped and not stripped.startswith('*') and not stripped.startswith('/'):
                    # This might be a malformed comment - try to close it
                    if multiline_start >= 0:
                        # Add closing */ before this line
                        cleaned_lines.append(' */')
                        in_multiline_comment = False
                        multiline_start = -1
                cleaned_lines.append(line)
                continue
            
            # Check for single-line NatSpec comments (///)
            # These should be fine, but we can validate they're not malformed
            if stripped.startswith('///'):
                cleaned_lines.append(line)
                continue
            
            # Regular code line
            cleaned_lines.append(line)
        
        # If we ended with an unclosed multi-line comment, close it
        if in_multiline_comment:
            cleaned_lines.append(' */')
            logger.warning("Fixed unclosed multi-line comment at end of contract")
        
        return '\n'.join(cleaned_lines)

    def _clean_common_parser_issues(self, contract_code: str) -> str:
        """Clean common parser issues including template placeholders"""
        from hyperagent.utils.markdown import clean_template_placeholders
        
        # First, remove template placeholders
        contract_code = clean_template_placeholders(contract_code)
        """
        Clean common parser issues that cause ParserError
        
        Fixes:
        - Trailing commas in function parameters
        - Unclosed brackets/braces
        - Invalid characters
        - Missing semicolons
        - Malformed pragma statements
        
        Args:
            contract_code: Solidity source code
            
        Returns:
            Cleaned contract code
        """
        lines = contract_code.split('\n')
        cleaned_lines = []
        
        for i, line in enumerate(lines):
            cleaned_line = line
            
            # Fix trailing commas in function parameters (common LLM mistake)
            # Match: function foo(uint256 a,) -> function foo(uint256 a)
            cleaned_line = re.sub(r',\s*\)', ')', cleaned_line)
            
            # Fix trailing commas in struct/enum definitions
            cleaned_line = re.sub(r',\s*}', '}', cleaned_line)
            
            # Fix double semicolons
            cleaned_line = re.sub(r';;+', ';', cleaned_line)
            
            # Remove invalid characters that might cause parser errors
            # Keep only printable ASCII and common Unicode (for comments)
            # Remove control characters except newlines and tabs
            cleaned_line = ''.join(char for char in cleaned_line if ord(char) >= 32 or char in '\n\t')
            
            # Fix malformed pragma (common issue: missing semicolon)
            if 'pragma solidity' in cleaned_line.lower() and not cleaned_line.strip().endswith(';'):
                if not cleaned_line.strip().endswith(';'):
                    cleaned_line = cleaned_line.rstrip() + ';'
            
            # Fix unclosed strings (basic check)
            # Count quotes - if odd number, might be unclosed
            single_quotes = cleaned_line.count("'")
            double_quotes = cleaned_line.count('"')
            # This is a basic check - more complex cases handled by compiler
            
            cleaned_lines.append(cleaned_line)
        
        cleaned_code = '\n'.join(cleaned_lines)
        
        # Fix unclosed braces/brackets (basic balance check)
        open_braces = cleaned_code.count('{')
        close_braces = cleaned_code.count('}')
        open_brackets = cleaned_code.count('[')
        close_brackets = cleaned_code.count(']')
        open_parens = cleaned_code.count('(')
        close_parens = cleaned_code.count(')')
        
        # If braces are unbalanced, try to fix (add missing closing braces at end)
        if open_braces > close_braces:
            missing = open_braces - close_braces
            logger.warning(f"Detected {missing} unclosed brace(s), attempting to fix")
            cleaned_code += '\n' + '}' * missing
        
        # Similar for brackets and parens (less common but possible)
        if open_brackets > close_brackets:
            missing = open_brackets - close_brackets
            logger.warning(f"Detected {missing} unclosed bracket(s), attempting to fix")
            cleaned_code += ']' * missing
        
        if open_parens > close_parens:
            missing = open_parens - close_parens
            logger.warning(f"Detected {missing} unclosed parenthesis, attempting to fix")
            cleaned_code += ')' * missing
        
        return cleaned_code

    def _extract_compilation_errors_from_output(self, errors: list, contract_code: str) -> str:
        """
        Extract detailed error information from Solidity compiler output errors

        Args:
            errors: List of error dictionaries from compiler output
            contract_code: Original contract code for context

        Returns:
            Formatted error message with details
        """
        error_messages = []
        lines = contract_code.split('\n')
        
        for err in errors:
            if isinstance(err, dict):
                message = err.get('message', str(err))
                formatted_message = message
                
                # Extract source location if available
                source_location = err.get('sourceLocation', {})
                if source_location:
                    file = source_location.get('file', 'contract.sol')
                    start = source_location.get('start', 0)
                    end = source_location.get('end', 0)
                    
                    # Calculate line and column from character position
                    if start > 0:
                        # Find line number from character position
                        char_count = 0
                        line_num = 1
                        col_num = 1
                        for i, line in enumerate(lines, 1):
                            if char_count + len(line) + 1 >= start:  # +1 for newline
                                line_num = i
                                col_num = start - char_count + 1
                                break
                            char_count += len(line) + 1
                        
                        # Get problematic line
                        if line_num <= len(lines):
                            problem_line = lines[line_num - 1]
                            formatted_message = (
                                f"{message}\n"
                                f"  Location: Line {line_num}, Column {col_num}\n"
                                f"  Code: {problem_line.strip()}"
                            )
                        else:
                            formatted_message = f"{message} (Position: {start}-{end})"
                
                error_messages.append(formatted_message)
            else:
                error_messages.append(str(err))
        
        if error_messages:
            return "Compilation failed:\n" + "\n".join(f"  • {msg}" for msg in error_messages)
        
        return "Compilation failed: Unknown error"

    def _extract_compilation_errors(self, error: Exception, contract_code: str) -> str:
        """
        Extract detailed error information from Solidity compiler errors

        Args:
            error: Exception raised during compilation
            contract_code: Original contract code for context

        Returns:
            Formatted error message with details
        """
        error_str = str(error)
        
        # Try to extract structured error information
        if hasattr(error, 'errors') and isinstance(error.errors, list):
            return self._extract_compilation_errors_from_output(error.errors, contract_code)
        
        # Handle DocstringParsingError specifically
        if "DocstringParsingError" in error_str or "docstring" in error_str.lower():
            # Extract line number if available
            line_match = re.search(r'(\d+):(\d+)', error_str)
            if line_match:
                line_num = int(line_match.group(1))
                col_num = int(line_match.group(2))
                lines = contract_code.split('\n')
                
                # Find the problematic docstring
                problem_line = lines[line_num - 1] if line_num <= len(lines) else ""
                
                # Look for NatSpec comment patterns around the error line
                context_start = max(0, line_num - 5)
                context_end = min(len(lines), line_num + 3)
                context_lines = lines[context_start:context_end]
                
                formatted_context = []
                for i, line in enumerate(context_lines, start=context_start + 1):
                    marker = " ← Error here" if i == line_num else ""
                    formatted_context.append(f"  Line {i}: {line.rstrip()}{marker}")
                
                return (
                    f"DocstringParsingError: Malformed NatSpec comment detected\n"
                    f"  Location: Line {line_num}, Column {col_num}\n"
                    f"  Issue: {error_str}\n\n"
                    f"  Code Context:\n" + "\n".join(formatted_context) + "\n\n"
                    f"  Suggestion: Check NatSpec comment syntax (/// for single-line, /** */ for multi-line).\n"
                    f"  Ensure all comment tags are properly closed and formatted."
                )
            else:
                return (
                    f"DocstringParsingError: Malformed NatSpec comment detected\n"
                    f"  {error_str}\n\n"
                    f"  Suggestion: Check NatSpec comment syntax in your contract.\n"
                    f"  NatSpec comments should use:\n"
                    f"    - Single-line: /// comment\n"
                    f"    - Multi-line: /** comment */\n"
                    f"  Ensure all tags are properly closed."
                )
        
        # Try to extract from error message patterns
        if "ParserError" in error_str or "Source" in error_str or "Parser error" in error_str.lower():
            # Extract line number if available - try multiple patterns
            line_match = re.search(r'(\d+):(\d+)', error_str)
            if not line_match:
                # Try alternative pattern: "line 123" or "Line 123"
                line_match = re.search(r'[Ll]ine\s+(\d+)', error_str)
                if line_match:
                    line_num = int(line_match.group(1))
                    col_num = 1  # Default column
                else:
                    # Try to find line number from "at line X" pattern
                    line_match = re.search(r'at\s+line\s+(\d+)', error_str, re.IGNORECASE)
                    if line_match:
                        line_num = int(line_match.group(1))
                        col_num = 1
                    else:
                        # No line number found, return full error
                        return (
                            f"ParserError detected:\n"
                            f"  {error_str}\n\n"
                            f"  Common causes:\n"
                            f"  - Missing semicolon\n"
                            f"  - Unclosed brackets/braces\n"
                            f"  - Invalid syntax\n"
                            f"  - Trailing commas in function parameters\n"
                            f"  - Malformed pragma statement\n\n"
                            f"  Please check the contract code for syntax errors."
                        )
            
            if line_match:
                line_num = int(line_match.group(1))
                col_num = int(line_match.group(2)) if len(line_match.groups()) > 1 else 1
                
                # Get the problematic line from contract code
                lines = contract_code.split('\n')
                if line_num <= len(lines):
                    problem_line = lines[line_num - 1]
                    # Show context (previous and next lines)
                    context_start = max(0, line_num - 3)
                    context_end = min(len(lines), line_num + 2)
                    context_lines = []
                    
                    for i in range(context_start, context_end):
                        marker = " ← Error here" if i == line_num - 1 else ""
                        context_lines.append(f"  Line {i + 1}: {lines[i].rstrip()}{marker}")
                    
                    # Preserve the full original error message - don't truncate
                    # Build comprehensive error message with complete details
                    full_error_msg = (
                        f"ParserError at line {line_num}, column {col_num}:\n"
                        f"  {error_str}\n\n"
                        f"  Code Context:\n" + "\n".join(context_lines) + "\n\n"
                        f"  Common fixes:\n"
                        f"  - Check for missing semicolon on line {line_num}\n"
                        f"  - Verify brackets/braces are properly closed\n"
                        f"  - Check for trailing commas in function parameters\n"
                        f"  - Ensure pragma statement is valid: pragma solidity ^0.8.27;\n"
                        f"  - Remove any invalid characters or control characters\n"
                        f"  - Ensure all strings are properly closed"
                    )
                    
                    return full_error_msg
        
        # Try to extract error type and message
        error_type_match = re.search(r'(\w+Error):\s*(.+)', error_str)
        if error_type_match:
            error_type = error_type_match.group(1)
            error_msg = error_type_match.group(2)
            return f"{error_type}: {error_msg}"
        
        # Fallback to full error message - preserve complete error (no truncation)
        # Database Text field supports unlimited length, so preserve full error message
        return f"Compilation failed: {error_str}"
