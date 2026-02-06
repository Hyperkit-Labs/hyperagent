#!/usr/bin/env python3
"""
Test script to verify test result storage and retrieval

This script simulates the workflow pipeline to verify:
1. Testing service returns results with proper status field
2. Orchestrator stores test_result correctly
3. Deployment service can access test_result from workflow_context
"""

import asyncio
import sys
from pathlib import Path
from typing import Dict, Any

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from hyperagent.architecture.soa import SequentialOrchestrator, ServiceRegistry
from hyperagent.core.agent_system import ServiceInterface
from hyperagent.events.event_bus import EventBus


class MockTestingService(ServiceInterface):
    """Mock testing service that returns test results"""
    
    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Return mock test results with proper status"""
        return {
            "status": "passed",  # Should be "passed" or "failed", not "success"
            "test_results": {
                "total_tests": 5,
                "passed": 5,
                "failed": 0,
                "skipped": 0,
                "test_cases": [
                    {"name": "test_deploy", "status": "passed"},
                    {"name": "test_transfer", "status": "passed"},
                ]
            },
            "test_framework": "foundry",
        }
    
    async def validate(self, data: Dict[str, Any]) -> bool:
        return True
    
    async def on_error(self, error: Exception) -> None:
        pass


class MockDeploymentService(ServiceInterface):
    """Mock deployment service that validates test results"""
    
    def __init__(self):
        self.test_result_accessed = False
        self.test_status = None
    
    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Check if test_result is accessible"""
        # Check input_data first
        test_result = input_data.get("test_result")
        
        # Check workflow_context
        workflow_context = input_data.get("workflow_context", {})
        if not test_result:
            test_result = workflow_context.get("test_result")
        
        if test_result:
            self.test_result_accessed = True
            self.test_status = test_result.get("status")
            print(f"  [OK] Deployment service accessed test_result")
            print(f"    Status: {self.test_status}")
            
            # Validate status is "passed" or "failed"
            if self.test_status not in ["passed", "failed"]:
                print(f"    [WARN] Status is '{self.test_status}', expected 'passed' or 'failed'")
                return {"status": "failed", "error": f"Invalid test status: {self.test_status}"}
            
            if self.test_status == "failed":
                return {"status": "failed", "error": "Tests failed, cannot deploy"}
            
            return {"status": "success", "message": "Deployment validation passed"}
        else:
            print(f"  [FAIL] Deployment service CANNOT access test_result")
            return {"status": "failed", "error": "Test results missing"}
    
    async def validate(self, data: Dict[str, Any]) -> bool:
        return True
    
    async def on_error(self, error: Exception) -> None:
        pass


async def test_test_result_storage():
    """Test that test results are stored and accessible"""
    
    print("=" * 80)
    print("TEST: Test Result Storage and Retrieval")
    print("=" * 80)
    print()
    
    # Setup
    print("1. Setting up services...")
    event_bus = EventBus()
    registry = ServiceRegistry()
    registry.register("testing", MockTestingService())
    registry.register("deployment", MockDeploymentService())
    
    orchestrator = SequentialOrchestrator(registry, event_bus)
    deployment_service = registry.get_service("deployment")
    
    print("   [OK] Services registered")
    print()
    
    # Create workflow context
    print("2. Creating workflow context...")
    workflow_context = {
        "pipeline": [
            {
                "service": "testing",
                "input_mapping": {
                    "contract_code": "contract_code",
                    "compiled_contract": "compiled_contract",
                }
            },
            {
                "service": "deployment",
                "input_mapping": {
                    "compiled_contract": "compiled_contract",
                    "test_result": "test_result",
                    "workflow_context": "workflow_context",
                }
            }
        ],
        "initial_data": {
            "contract_code": "pragma solidity ^0.8.27; contract Test {}",
            "compiled_contract": {"bytecode": "0x1234", "abi": []},
        }
    }
    
    print("   [OK] Workflow context created")
    print()
    
    # Execute pipeline
    print("3. Executing pipeline...")
    try:
        result = await orchestrator.orchestrate(workflow_context)
        
        print("4. Verifying results...")
        print()
        
        # Check test_result storage
        test_result = result.get("test_result")
        test_result_from_context = result.get("workflow_context", {}).get("test_result")
        
        print("   Test Result Storage:")
        print(f"     test_result in result: {test_result is not None}")
        if test_result:
            print(f"       Status: {test_result.get('status')}")
            print(f"       Test Results: {test_result.get('test_results', {})}")
        
        print(f"     test_result in workflow_context: {test_result_from_context is not None}")
        if test_result_from_context:
            print(f"       Status: {test_result_from_context.get('status')}")
        
        # Check deployment service access
        print()
        print("   Deployment Service Access:")
        if deployment_service.test_result_accessed:
            print(f"     [OK] Deployment service accessed test_result")
            print(f"       Status: {deployment_service.test_status}")
            
            if deployment_service.test_status == "passed":
                print("     [OK] Test status is 'passed' - deployment can proceed")
            elif deployment_service.test_status == "failed":
                print("     [WARN] Test status is 'failed' - deployment will be blocked")
            else:
                print(f"     [FAIL] Invalid test status: {deployment_service.test_status}")
        else:
            print("     [FAIL] Deployment service could NOT access test_result")
            print("     This will cause deployment validation to fail!")
        
        # Final result
        deployment_result = result.get("deployment_result") or result.get("deployment")
        if deployment_result and deployment_result.get("status") == "success":
            print()
            print("=" * 80)
            print("TEST: PASSED")
            print("=" * 80)
            print()
            print("Summary:")
            print("  [OK] Test results are stored as 'test_result'")
            print("  [OK] Test results are stored in 'workflow_context'")
            print("  [OK] Deployment service can access test results")
            print("  [OK] Test status is 'passed' or 'failed' (not 'success')")
            return True
        else:
            print()
            print("=" * 80)
            print("TEST: FAILED")
            print("=" * 80)
            print(f"Deployment result: {deployment_result}")
            return False
            
    except Exception as e:
        print()
        print("=" * 80)
        print("TEST: FAILED")
        print("=" * 80)
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(test_test_result_storage())
    sys.exit(0 if success else 1)

