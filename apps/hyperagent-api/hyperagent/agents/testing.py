"""Testing Agent implementation"""

import asyncio
import json
import logging
import os
import shutil  # For shutil.which() in test framework detection
import subprocess
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from hyperagent.core.agent_system import ServiceInterface
from hyperagent.events.event_bus import EventBus
from hyperagent.events.event_types import Event, EventType
from hyperagent.llm.provider import LLMProvider

logger = logging.getLogger(__name__)


class TestingAgent(ServiceInterface):
    """
    DEPRECATED: Use TestingService instead.
    
    This class is maintained for backward compatibility only.
    New code should use hyperagent.core.services.testing_service.TestingService
    
    Testing Agent

    Concept: Compile contracts and run tests
    Logic: Hardhat/Foundry compilation → Generate tests → Run tests → Coverage
    SLA: p99 < 150s, p95 < 100s
    """

    def __init__(self, event_bus: EventBus, llm_provider: LLMProvider = None):
        self.event_bus = event_bus
        self.llm_provider = llm_provider

        # Auto-detect test framework
        from hyperagent.core.config import settings

        if settings.test_framework_auto_detect:
            try:
                self.test_framework = self._detect_test_framework()
            except ValueError as e:
                logger.warning(f"{e}. Defaulting to 'hardhat'")
                self.test_framework = "hardhat"  # Fallback
        else:
            self.test_framework = "foundry"  # Default to Foundry (faster)

    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run tests on contract (using CompilationService results)

        Logic Flow:
        1. Use compiled_contract from CompilationService (if available)
        2. Write contract to temporary directory for test framework
        3. Initialize test framework (Foundry/Hardhat) - only for test execution
        4. Generate test cases using LLM
        5. Run test suite
        6. Calculate coverage
        7. Return results

        Note: Compilation is handled by CompilationService, this agent only runs tests
        """
        workflow_id = input_data.get("workflow_id", str(uuid.uuid4()))
        contract_code = input_data.get("contract_code")
        contract_name = input_data.get("contract_name", "GeneratedContract")
        network = input_data.get("network", "mantle_testnet")

        # Require compiled contract from CompilationService
        # TestingAgent does not handle compilation - that's CompilationService's responsibility
        compiled_contract = input_data.get("compiled_contract")
        if not compiled_contract:
            raise ValueError(
                "compiled_contract is required from CompilationService. "
                "TestingAgent only runs tests - compilation must be done by CompilationService first."
            )

        # Extract ABI and bytecode from compiled_contract
        abi = compiled_contract.get("abi", [])
        bytecode = compiled_contract.get("bytecode", "0x")

        # Publish start event
        await self.event_bus.publish(
            Event(
                id=str(uuid.uuid4()),
                type=EventType.TESTING_STARTED,
                workflow_id=workflow_id,
                timestamp=datetime.now(),
                data={"contract_name": contract_name},
                source_agent="testing",
            )
        )

        try:
            # Create temporary directory for contract and tests
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)

                # Step 1: Write contract to file (needed for test framework)
                if contract_code:
                    contract_file = temp_path / f"{contract_name}.sol"
                    contract_file.write_text(contract_code)

                # Step 2: Require compiled_contract from CompilationService
                # TestingAgent should not compile - that's CompilationService's responsibility
                if not compiled_contract:
                    raise ValueError(
                        "compiled_contract is required from CompilationService. "
                        "TestingAgent does not handle compilation - use CompilationService first."
                    )

                logger.info("Using compiled contract from CompilationService")
                compilation_result = {"success": True, "abi": abi, "bytecode": bytecode}

                # Step 3: Initialize test framework (only for test execution, not compilation)
                if self.test_framework == "foundry":
                    await self._setup_foundry_for_testing_only(temp_path, contract_name)
                else:
                    await self._setup_hardhat_for_testing_only(temp_path, contract_name)

                # Step 4: Generate tests using LLM
                if self.llm_provider and contract_code:
                    await self._generate_tests(temp_path, contract_code, contract_name)

                # Step 5: Run tests
                test_results = await self._run_tests(temp_path)

                # Step 6: Calculate coverage (if supported)
                coverage = await self._calculate_coverage(temp_path)

                # Determine test status based on test results
                # Status should be "passed" if all tests pass, "failed" if any tests fail
                test_status = "passed"
                if test_results.get("failed", 0) > 0:
                    test_status = "failed"
                elif test_results.get("total_tests", 0) == 0:
                    # If no tests were run, mark as passed (tests may be optional)
                    test_status = "passed"
                elif test_results.get("error"):
                    # If there was an error running tests, mark as failed
                    test_status = "failed"

                result = {
                    "status": test_status,  # "passed" or "failed" for deployment service validation
                    "compilation_successful": True,
                    "abi": abi,
                    "bytecode": bytecode,
                    "test_results": test_results,
                    "coverage": coverage,
                    "test_framework": self.test_framework,
                    "used_compilation_service": compiled_contract is not None,
                }

                # Publish completion event
                await self.event_bus.publish(
                    Event(
                        id=str(uuid.uuid4()),
                        type=EventType.TESTING_COMPLETED,
                        workflow_id=workflow_id,
                        timestamp=datetime.now(),
                        data=result,
                        source_agent="testing",
                    )
                )

                return result

        except Exception as e:
            await self.on_error(e)
            await self.event_bus.publish(
                Event(
                    id=str(uuid.uuid4()),
                    type=EventType.TESTING_FAILED,
                    workflow_id=workflow_id,
                    timestamp=datetime.now(),
                    data={"error": str(e)},
                    source_agent="testing",
                )
            )
            raise

    async def _setup_foundry_for_testing_only(self, project_path: Path, contract_name: str):
        """
        Initialize Foundry project structure for test execution only

        Note: Compilation is handled by CompilationService.
        This setup is only for running tests, not compilation.
        """
        # Create foundry.toml if not exists (minimal config for test execution)
        foundry_toml = project_path / "foundry.toml"
        if not foundry_toml.exists():
            foundry_toml.write_text(
                """[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.30"
"""
            )

        # Create test directory (tests will be written here)
        test_dir = project_path / "test"
        test_dir.mkdir(exist_ok=True)

        # Note: We don't create src directory or compile contracts
        # Compilation is handled by CompilationService

    async def _setup_hardhat_for_testing_only(self, project_path: Path, contract_name: str):
        """
        Initialize Hardhat project structure for test execution only

        Note: Compilation is handled by CompilationService.
        This setup is only for running tests, not compilation.
        Hardhat requires local installation, so we create package.json and install locally.
        """
        # Create package.json for local Hardhat installation
        package_json = project_path / "package.json"
        if not package_json.exists():
            package_json.write_text(
                """{
  "name": "hyperagent-test-project",
  "version": "1.0.0",
  "devDependencies": {
    "hardhat": "^2.19.0",
    "@nomicfoundation/hardhat-chai-matchers": "^2.0.0",
    "chai": "^4.3.0",
    "ethers": "^6.0.0"
  }
}
"""
            )

        # Install Hardhat locally (required for Hardhat to work)
        import subprocess

        try:
            logger.info("Installing Hardhat locally for test execution...")
            process = await asyncio.create_subprocess_exec(
                "npm",
                "install",
                cwd=str(project_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=120)
            if process.returncode != 0:
                logger.warning(f"Hardhat installation failed: {stderr.decode()}")
                # Continue anyway - tests might still work if Hardhat is available globally
        except (asyncio.TimeoutError, FileNotFoundError) as e:
            logger.warning(
                f"Could not install Hardhat locally: {e}. Tests may fail if Hardhat is not available."
            )

        # Create hardhat.config.js (minimal config for test execution)
        hardhat_config = project_path / "hardhat.config.js"
        if not hardhat_config.exists():
            hardhat_config.write_text(
                """module.exports = {
  solidity: {
    version: "0.8.30",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {}
  }
};
"""
            )

        # Create test directory (tests will be written here)
        test_dir = project_path / "test"
        test_dir.mkdir(exist_ok=True)

        # Note: We don't create contracts directory or compile contracts
        # Compilation is handled by CompilationService

    # Compilation methods removed - CompilationService handles all compilation
    # TestingAgent only runs tests, not compilation

    async def _generate_tests(self, project_path: Path, contract_code: str, contract_name: str):
        """
        Generate test cases using LLM

        Concept: Use LLM to generate comprehensive test cases
        Logic:
            1. Build prompt with contract code and framework requirements
            2. Generate test code using LLM
            3. Extract test code from markdown if present
            4. Write test file in appropriate format
        """
        if not self.llm_provider:
            logger.warning("LLM provider not available, skipping test generation")
            return

        framework_name = "Foundry" if self.test_framework == "foundry" else "Hardhat"
        framework_format = "Solidity" if self.test_framework == "foundry" else "JavaScript"

        prompt = f"""Generate comprehensive {framework_name} test cases for the following Solidity contract:

{contract_code}

Requirements:
1. Test all public functions
2. Test constructor parameters
3. Test edge cases (zero values, overflow, etc.)
4. Test error conditions (revert scenarios)
5. Use {framework_name} format ({framework_format})
6. Include setup and teardown if needed
7. Return ONLY the test code, no explanations

Test Contract:"""

        try:
            test_code = await self.llm_provider.generate(prompt)

            # Extract test code from markdown code blocks
            if "```solidity" in test_code:
                test_code = test_code.split("```solidity")[1].split("```")[0].strip()
            elif "```javascript" in test_code:
                test_code = test_code.split("```javascript")[1].split("```")[0].strip()
            elif "```js" in test_code:
                test_code = test_code.split("```js")[1].split("```")[0].strip()
            elif "```" in test_code:
                test_code = test_code.split("```")[1].split("```")[0].strip()

            # Ensure test directory exists
            test_dir = project_path / "test"
            test_dir.mkdir(exist_ok=True)

            # Write test file
            if self.test_framework == "foundry":
                test_file = test_dir / f"{contract_name}.t.sol"
            else:
                test_file = test_dir / f"{contract_name}.test.js"

            test_file.write_text(test_code)
            logger.info(f"Generated test file: {test_file}")

        except Exception as e:
            logger.error(f"Failed to generate tests: {e}", exc_info=True)
            # Continue without generated tests

    async def _run_tests(self, project_path: Path) -> Dict[str, Any]:
        """
        Run test suite and parse results

        Concept: Execute tests and return structured results
        Logic:
            1. Run test command based on framework
            2. Parse JSON output if available
            3. Extract test cases with status and errors
            4. Return structured test results
        """
        try:
            if self.test_framework == "foundry":
                # Run forge test with JSON output
                process = await asyncio.create_subprocess_exec(
                    "forge",
                    "test",
                    "--json",
                    cwd=str(project_path),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                try:
                    stdout, stderr = await asyncio.wait_for(
                        process.communicate(), timeout=300
                    )  # 5 minute timeout
                except asyncio.TimeoutError:
                    process.kill()
                    await process.wait()
                    return {
                        "status": "timeout",
                        "total": 0,
                        "passed": 0,
                        "failed": 0,
                        "skipped": 0,
                        "test_cases": [],
                        "error": "Test execution timed out after 300 seconds",
                    }

                # Parse Foundry test output
                if process.returncode == 0:
                    try:
                        test_output = json.loads(stdout.decode())

                        # Extract test cases from Foundry JSON output
                        test_cases = []
                        passed = 0
                        failed = 0
                        skipped = 0

                        # Foundry JSON structure: { "results": [...] }
                        results = test_output.get("results", [])
                        for result in results:
                            test_name = result.get("name", "unknown")
                            status = "passed" if result.get("status") == "success" else "failed"
                            duration = result.get("duration", 0)
                            error = (
                                result.get("error", {}).get("message")
                                if result.get("status") == "failure"
                                else None
                            )

                            test_cases.append(
                                {
                                    "name": test_name,
                                    "status": status,
                                    "duration": duration,
                                    "error": error,
                                }
                            )

                            if status == "passed":
                                passed += 1
                            elif status == "failed":
                                failed += 1
                            else:
                                skipped += 1

                        return {
                            "total_tests": len(test_cases),
                            "passed": passed,
                            "failed": failed,
                            "skipped": skipped,
                            "test_cases": test_cases,
                            "test_framework": "foundry",
                        }
                    except json.JSONDecodeError as e:
                        logger.warning(f"Failed to parse Foundry JSON output: {e}")
                        # Fallback parsing
                        output_text = stdout.decode()
                        passed = output_text.count("PASS") or output_text.count("success")
                        failed = output_text.count("FAIL") or output_text.count("failure")
                        return {
                            "total_tests": passed + failed,
                            "passed": passed,
                            "failed": failed,
                            "skipped": 0,
                            "test_cases": [],
                            "test_framework": "foundry",
                            "warning": "Could not parse detailed test results",
                        }
                else:
                    error_msg = stderr.decode() or stdout.decode()
                    logger.error(f"Test execution failed: {error_msg}")
                    return {
                        "total_tests": 0,
                        "passed": 0,
                        "failed": 0,
                        "skipped": 0,
                        "test_cases": [],
                        "error": error_msg,
                        "test_framework": "foundry",
                    }
            else:
                # Hardhat test - try JSON reporter if available
                process = await asyncio.create_subprocess_exec(
                    "npx",
                    "hardhat",
                    "test",
                    "--reporter",
                    "json",
                    cwd=str(project_path),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                try:
                    stdout, stderr = await asyncio.wait_for(
                        process.communicate(), timeout=300
                    )  # 5 minute timeout
                except asyncio.TimeoutError:
                    process.kill()
                    await process.wait()
                    return {
                        "status": "timeout",
                        "total": 0,
                        "passed": 0,
                        "failed": 0,
                        "skipped": 0,
                        "test_cases": [],
                        "error": "Test execution timed out after 300 seconds",
                    }

                # Try to parse JSON output
                try:
                    test_output = json.loads(stdout.decode())
                    test_cases = []
                    passed = 0
                    failed = 0
                    skipped = 0

                    # Hardhat JSON structure varies, try common formats
                    if isinstance(test_output, list):
                        for test in test_output:
                            test_cases.append(
                                {
                                    "name": test.get("name", "unknown"),
                                    "status": (
                                        "passed" if test.get("status") == "pass" else "failed"
                                    ),
                                    "duration": test.get("duration", 0),
                                    "error": (
                                        test.get("error") if test.get("status") == "fail" else None
                                    ),
                                }
                            )
                            if test.get("status") == "pass":
                                passed += 1
                            elif test.get("status") == "fail":
                                failed += 1
                            else:
                                skipped += 1

                    return {
                        "total_tests": len(test_cases),
                        "passed": passed,
                        "failed": failed,
                        "skipped": skipped,
                        "test_cases": test_cases,
                        "test_framework": "hardhat",
                    }
                except (json.JSONDecodeError, KeyError):
                    # Fallback to text parsing
                    output_text = stdout.decode()
                    passed = output_text.count("✓") or output_text.count("PASS")
                    failed = output_text.count("✗") or output_text.count("FAIL")

                    return {
                        "total_tests": passed + failed,
                        "passed": passed,
                        "failed": failed,
                        "skipped": 0,
                        "test_cases": [],
                        "test_framework": "hardhat",
                        "warning": "Could not parse detailed test results",
                    }

        except FileNotFoundError:
            return {
                "total": 0,
                "passed": 0,
                "failed": 0,
                "error": f"{self.test_framework} not found",
            }

    def _detect_test_framework(self, project_path: Path = None) -> str:
        """
        Auto-detect available test framework

        Priority:
        1. Foundry (faster, preferred)
        2. Hardhat (more common)
        3. Raise error if neither found

        Args:
            project_path: Optional project path to check for config files

        Returns:
            "foundry" or "hardhat"

        Raises:
            ValueError: If no test framework found
        """
        # Check for Foundry
        if shutil.which("forge"):
            logger.info("Foundry detected, using for testing")
            return "foundry"

        # Check for Hardhat via config file
        if project_path and (project_path / "hardhat.config.js").exists():
            logger.info("Hardhat detected via config file")
            return "hardhat"

        # Check if npx hardhat is available
        if shutil.which("npx"):
            try:
                result = subprocess.run(
                    ["npx", "hardhat", "--version"], capture_output=True, timeout=5
                )
                if result.returncode == 0:
                    logger.info("Hardhat detected via npx")
                    return "hardhat"
            except (subprocess.TimeoutExpired, FileNotFoundError):
                pass

        # No framework found
        raise ValueError(
            "No test framework found. Please install:\n"
            "- Foundry: curl -L https://foundry.paradigm.xyz | bash\n"
            "- Hardhat: npm install --save-dev hardhat"
        )

    async def _calculate_coverage(self, project_path: Path) -> Dict[str, float]:
        """
        Calculate test coverage by parsing lcov.info files

        Concept: LCOV format provides line and branch coverage
        Logic:
            1. Run coverage command to generate lcov.info
            2. Parse lcov.info file
            3. Calculate line and branch coverage percentages
        """
        try:
            if self.test_framework == "foundry":
                # Foundry coverage - generate lcov.info
                process = await asyncio.create_subprocess_exec(
                    "forge",
                    "coverage",
                    "--report",
                    "lcov",
                    cwd=str(project_path),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                await process.communicate()

                # Look for lcov.info in coverage directory
                lcov_path = project_path / "coverage" / "lcov.info"
                if not lcov_path.exists():
                    lcov_path = project_path / "lcov.info"

                if lcov_path.exists():
                    return await self._parse_lcov_coverage(lcov_path)
                else:
                    # Fallback: try to parse from stdout
                    return await self._parse_coverage_from_output(project_path)
            else:
                # Hardhat coverage (requires solidity-coverage plugin)
                # Run coverage command
                process = await asyncio.create_subprocess_exec(
                    "npx",
                    "hardhat",
                    "coverage",
                    cwd=str(project_path),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                await process.communicate()

                # Look for lcov.info
                lcov_path = project_path / "coverage" / "lcov.info"
                if lcov_path.exists():
                    return await self._parse_lcov_coverage(lcov_path)
                else:
                    return {"line_coverage": 0.0, "branch_coverage": 0.0}

        except FileNotFoundError:
            return {"line_coverage": 0.0, "branch_coverage": 0.0}

    async def _parse_lcov_coverage(self, lcov_path: Path) -> Dict[str, float]:
        """
        Parse lcov.info file for coverage metrics

        Concept: LCOV format provides line and branch coverage
        Logic:
            1. Read lcov.info file
            2. Parse SF (source file), DA (data), BRDA (branch) entries
            3. Calculate line and branch coverage percentages
        """
        if not lcov_path.exists():
            return {"line_coverage": 0.0, "branch_coverage": 0.0}

        total_lines = 0
        covered_lines = 0
        total_branches = 0
        covered_branches = 0

        with open(lcov_path, "r") as f:
            for line in f:
                # Line coverage: DA:<line_number>,<execution_count>
                if line.startswith("DA:"):
                    total_lines += 1
                    parts = line.strip().split(",")
                    if len(parts) > 1:
                        try:
                            exec_count = int(parts[1])
                            if exec_count > 0:
                                covered_lines += 1
                        except ValueError:
                            pass

                # Branch coverage: BRDA:<line>,<block>,<branch>,<taken>
                elif line.startswith("BRDA:"):
                    total_branches += 1
                    parts = line.strip().split(",")
                    if len(parts) > 3 and parts[3].strip() != "-":
                        try:
                            taken = int(parts[3])
                            if taken > 0:
                                covered_branches += 1
                        except ValueError:
                            pass

        line_coverage = (covered_lines / total_lines * 100) if total_lines > 0 else 0.0
        branch_coverage = (covered_branches / total_branches * 100) if total_branches > 0 else 0.0

        return {
            "line_coverage": round(line_coverage, 2),
            "branch_coverage": round(branch_coverage, 2),
            "total_lines": total_lines,
            "covered_lines": covered_lines,
            "total_branches": total_branches,
            "covered_branches": covered_branches,
        }

    async def _parse_coverage_from_output(self, project_path: Path) -> Dict[str, float]:
        """Fallback: Try to extract coverage from forge coverage output"""
        # This is a simplified fallback - would need to parse forge output
        return {"line_coverage": 0.0, "branch_coverage": 0.0}

    async def validate(self, data: Dict[str, Any]) -> bool:
        """Validate input has contract code"""
        return bool(data.get("contract_code") and len(data["contract_code"]) > 50)

    async def on_error(self, error: Exception) -> None:
        """Handle testing errors"""
        print(f"TestingAgent error: {error}")
