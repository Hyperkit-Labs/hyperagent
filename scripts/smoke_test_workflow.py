#!/usr/bin/env python3
"""
Smoke test for complete workflow: generate > audit > test > compile > deploy

This script tests the entire workflow pipeline to verify:
1. Generation produces contract code
2. Compilation succeeds
3. Audit runs and produces results
4. Testing runs and produces results with proper status
5. Deployment validation can access test results
"""

import asyncio
import sys
import uuid
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from hyperagent.core.orchestrator import WorkflowCoordinator
from hyperagent.architecture.soa import ServiceRegistry
from hyperagent.core.services.generation_service import GenerationService
from hyperagent.core.services.compilation_service import CompilationService
from hyperagent.core.services.audit_service import AuditService
from hyperagent.core.services.testing_service import TestingService
from hyperagent.core.services.deployment_service import DeploymentService
from hyperagent.agents.testing import TestingAgent
from hyperagent.security.audit import SecurityAuditor
from hyperagent.events.event_bus import EventBus
from hyperagent.llm.provider import LLMProvider
from hyperagent.rag.template_retriever import TemplateRetriever


async def smoke_test_workflow():
    """Run smoke test of complete workflow"""
    
    print("=" * 80)
    print("SMOKE TEST: Complete Workflow Pipeline")
    print("=" * 80)
    print()
    
    # Initialize components
    print("1. Initializing components...")
    event_bus = EventBus()
    service_registry = ServiceRegistry()
    llm_provider = LLMProvider()
    template_retriever = TemplateRetriever()
    security_auditor = SecurityAuditor()
    testing_agent = TestingAgent(event_bus, llm_provider)
    
    # Register services
    service_registry.register("generation", GenerationService(llm_provider, template_retriever))
    service_registry.register("compilation", CompilationService())
    service_registry.register("audit", AuditService(security_auditor))
    service_registry.register("testing", TestingService(testing_agent))
    service_registry.register("deployment", DeploymentService())
    
    # Create coordinator
    coordinator = WorkflowCoordinator(service_registry, event_bus)
    
    print("   ✓ Components initialized")
    print()
    
    # Test workflow parameters
    workflow_id = str(uuid.uuid4())
    nlp_input = "Create a simple ERC20 token contract with name 'TestToken' and symbol 'TEST'"
    network = "mantle_testnet"
    wallet_address = "0x1234567890123456789012345678901234567890"  # Dummy address for testing
    
    print("2. Workflow Parameters:")
    print(f"   Workflow ID: {workflow_id}")
    print(f"   NLP Input: {nlp_input}")
    print(f"   Network: {network}")
    print(f"   Wallet: {wallet_address}")
    print()
    
    # Execute workflow
    print("3. Executing workflow pipeline...")
    print("   Stages: generation > compilation > audit > testing > deployment")
    print()
    
    try:
        result = await coordinator.execute_workflow(
            workflow_id=workflow_id,
            nlp_input=nlp_input,
            network=network,
            wallet_address=wallet_address,
            use_gasless=False,
            selected_tasks=["generation", "compilation", "audit", "testing", "deployment"]
        )
        
        print("4. Workflow Execution Results:")
        print("   Status:", result.get("status"))
        print()
        
        # Check each stage
        print("5. Stage Verification:")
        
        # Generation
        contract_code = result.get("contract_code")
        if contract_code:
            print("   ✓ Generation: Contract code generated")
            print(f"     Code length: {len(contract_code)} characters")
        else:
            print("   ✗ Generation: FAILED - No contract code")
            return False
        
        # Compilation
        compiled_contract = result.get("compiled_contract")
        if compiled_contract and compiled_contract.get("bytecode"):
            print("   ✓ Compilation: Contract compiled successfully")
            print(f"     Bytecode length: {len(compiled_contract.get('bytecode', ''))} characters")
            print(f"     ABI functions: {len(compiled_contract.get('abi', []))}")
        else:
            print("   ✗ Compilation: FAILED - No compiled contract")
            return False
        
        # Audit
        audit_result = result.get("audit_result")
        if audit_result:
            print("   ✓ Audit: Audit completed")
            print(f"     Status: {audit_result.get('status')}")
            print(f"     Risk Score: {audit_result.get('overall_risk_score', 'N/A')}")
            print(f"     Vulnerabilities: {len(audit_result.get('vulnerabilities', []))}")
        else:
            print("   ✗ Audit: FAILED - No audit results")
            return False
        
        # Testing - CRITICAL CHECK
        test_result = result.get("test_result")
        test_result_from_context = result.get("workflow_context", {}).get("test_result")
        
        print("   Testing Stage Check:")
        print(f"     test_result in result: {test_result is not None}")
        print(f"     test_result in workflow_context: {test_result_from_context is not None}")
        
        if test_result:
            print("   ✓ Testing: Test results found")
            print(f"     Status: {test_result.get('status')}")
            print(f"     Test Results: {test_result.get('test_results', {})}")
            print(f"     Total Tests: {test_result.get('test_results', {}).get('total_tests', 0)}")
            print(f"     Passed: {test_result.get('test_results', {}).get('passed', 0)}")
            print(f"     Failed: {test_result.get('test_results', {}).get('failed', 0)}")
            
            # Verify status is "passed" or "failed" (not "success")
            status = test_result.get("status")
            if status not in ["passed", "failed"]:
                print(f"     ⚠ WARNING: Test status is '{status}', expected 'passed' or 'failed'")
        elif test_result_from_context:
            print("   ✓ Testing: Test results found in workflow_context")
            print(f"     Status: {test_result_from_context.get('status')}")
        else:
            print("   ✗ Testing: FAILED - No test results found")
            print("     Checking alternative keys...")
            print(f"     testing_result: {result.get('testing_result')}")
            print(f"     test_results: {result.get('test_results')}")
            return False
        
        # Deployment validation check
        print()
        print("6. Deployment Validation Check:")
        deployment_result = result.get("deployment_result")
        if deployment_result:
            print("   ✓ Deployment: Deployment attempted")
            print(f"     Status: {deployment_result.get('status')}")
        else:
            print("   ⚠ Deployment: Not executed (expected if validation blocks)")
            print("   This is OK - deployment requires user signature")
        
        # Verify deployment service can access test results
        print()
        print("7. Deployment Service Access Check:")
        workflow_context = result.get("workflow_context", {})
        test_result_for_deployment = workflow_context.get("test_result")
        
        if test_result_for_deployment:
            print("   ✓ Deployment service can access test_result from workflow_context")
            print(f"     Test status: {test_result_for_deployment.get('status')}")
        else:
            print("   ✗ Deployment service CANNOT access test_result from workflow_context")
            print("     This will cause deployment validation to fail!")
            return False
        
        print()
        print("=" * 80)
        print("SMOKE TEST: PASSED ✓")
        print("=" * 80)
        return True
        
    except Exception as e:
        print()
        print("=" * 80)
        print("SMOKE TEST: FAILED ✗")
        print("=" * 80)
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(smoke_test_workflow())
    sys.exit(0 if success else 1)

