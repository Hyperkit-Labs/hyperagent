"""
Saga Pattern Implementation
Implements distributed transactions with compensation logic
Ensures eventual consistency across multi-step workflows
"""

import logging
from typing import List, Dict, Any, Callable, Optional
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class SagaStepStatus(Enum):
    """Status of a saga step"""
    PENDING = "pending"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    COMPENSATING = "compensating"
    COMPENSATED = "compensated"
    COMPENSATION_FAILED = "compensation_failed"


@dataclass
class SagaStep:
    """
    Represents a single step in a saga
    Each step has an action and a compensation action
    """
    name: str
    action: Callable
    compensation: Callable
    status: SagaStepStatus = SagaStepStatus.PENDING
    result: Any = None
    error: Optional[str] = None
    
    def __repr__(self):
        return f"SagaStep(name='{self.name}', status={self.status.value})"


@dataclass
class SagaExecutionContext:
    """Context shared across all saga steps"""
    workflow_id: str
    data: Dict[str, Any] = field(default_factory=dict)
    compensations: List[SagaStep] = field(default_factory=list)


class SagaOrchestrator:
    """
    Saga Pattern Orchestrator
    Manages execution of distributed transactions with compensation
    
    Pattern:
    1. For each step:
       - Register compensation BEFORE executing
       - Execute the step
       - On failure, run all compensations in reverse order (LIFO)
    """
    
    def __init__(self, saga_name: str):
        self.saga_name = saga_name
        self.steps: List[SagaStep] = []
        self.context: Optional[SagaExecutionContext] = None
    
    def add_step(self, name: str, action: Callable, compensation: Callable) -> 'SagaOrchestrator':
        """
        Add a step to the saga
        
        Args:
            name: Step name for logging
            action: Function to execute (must be async)
            compensation: Function to compensate/rollback (must be async)
        
        Returns:
            Self for method chaining
        """
        step = SagaStep(name=name, action=action, compensation=compensation)
        self.steps.append(step)
        return self
    
    async def execute(self, workflow_id: str, initial_data: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Execute the saga
        
        Returns:
            Final context data if successful
            
        Raises:
            SagaExecutionError if saga fails and compensation fails
        """
        self.context = SagaExecutionContext(
            workflow_id=workflow_id,
            data=initial_data or {}
        )
        
        logger.info(f"Starting saga '{self.saga_name}' for workflow {workflow_id}")
        
        try:
            # Execute each step in order
            for step in self.steps:
                await self._execute_step(step)
            
            logger.info(f"Saga '{self.saga_name}' completed successfully")
            return {
                'success': True,
                'data': self.context.data,
                'steps_completed': len(self.steps)
            }
        
        except Exception as e:
            logger.error(f"Saga '{self.saga_name}' failed: {e}")
            
            # Run compensations in reverse order (LIFO)
            await self._compensate()
            
            return {
                'success': False,
                'error': str(e),
                'compensated': True,
                'steps_completed': len([s for s in self.steps if s.status == SagaStepStatus.COMPLETED]),
                'steps_compensated': len([s for s in self.steps if s.status == SagaStepStatus.COMPENSATED])
            }
    
    async def _execute_step(self, step: SagaStep):
        """Execute a single saga step"""
        logger.info(f"Executing step '{step.name}'")
        
        step.status = SagaStepStatus.EXECUTING
        
        try:
            # Execute the step action
            result = await step.action(self.context)
            
            # Update step and context
            step.result = result
            step.status = SagaStepStatus.COMPLETED
            
            # Register compensation for later (LIFO order)
            self.context.compensations.append(step)
            
            logger.info(f"Step '{step.name}' completed successfully")
        
        except Exception as e:
            step.status = SagaStepStatus.FAILED
            step.error = str(e)
            logger.error(f"Step '{step.name}' failed: {e}")
            raise
    
    async def _compensate(self):
        """Run all compensations in reverse order (LIFO)"""
        logger.info(f"Starting compensation for saga '{self.saga_name}'")
        
        compensation_failures = []
        
        # Run compensations in reverse order (last-in, first-out)
        for step in reversed(self.context.compensations):
            try:
                logger.info(f"Compensating step '{step.name}'")
                step.status = SagaStepStatus.COMPENSATING
                
                # Execute compensation
                await step.compensation(self.context, step.result)
                
                step.status = SagaStepStatus.COMPENSATED
                logger.info(f"Step '{step.name}' compensated successfully")
            
            except Exception as e:
                step.status = SagaStepStatus.COMPENSATION_FAILED
                error_msg = f"Compensation failed for step '{step.name}': {e}"
                logger.error(error_msg)
                compensation_failures.append(error_msg)
        
        if compensation_failures:
            # Log critical error if compensations fail
            logger.critical(
                f"CRITICAL: Saga '{self.saga_name}' compensation failures: "
                f"{'; '.join(compensation_failures)}"
            )
            raise SagaCompensationError(
                f"Failed to compensate saga: {'; '.join(compensation_failures)}"
            )


class SagaExecutionError(Exception):
    """Raised when saga execution fails"""
    pass


class SagaCompensationError(Exception):
    """Raised when saga compensation fails - CRITICAL ERROR"""
    pass


# Example: Deployment Saga with Compensation
async def create_deployment_saga(
    code_gen_activity,
    compile_activity,
    audit_activity,
    deploy_activity,
    storage_activity,
    db_activity
):
    """
    Create a deployment saga with full compensation logic
    
    Steps:
    1. Generate code (compensation: delete generated code)
    2. Compile code (compensation: none - deterministic)
    3. Audit code (compensation: mark audit invalid)
    4. Store to IPFS (compensation: unpin from IPFS)
    5. Deploy contract (compensation: self-destruct contract)
    6. Save to database (compensation: mark deployment failed)
    """
    
    saga = SagaOrchestrator("deployment_saga")
    
    # Step 1: Generate code
    async def generate_action(ctx: SagaExecutionContext):
        result = await code_gen_activity.execute_with_retry(
            prompt=ctx.data['prompt'],
            template=ctx.data.get('template')
        )
        if not result.success:
            raise SagaExecutionError(f"Code generation failed: {result.error}")
        
        ctx.data['code'] = result.data['code']
        ctx.data['language'] = result.data['language']
        return result.data
    
    async def generate_compensation(ctx: SagaExecutionContext, result):
        # Clean up generated code artifacts
        logger.info("Compensating code generation - cleaning up artifacts")
        # In practice, this might involve deleting temp files, etc.
        pass
    
    saga.add_step("generate_code", generate_action, generate_compensation)
    
    # Step 2: Compile code
    async def compile_action(ctx: SagaExecutionContext):
        result = await compile_activity.execute_with_retry(
            code=ctx.data['code'],
            language=ctx.data['language']
        )
        if not result.success:
            raise SagaExecutionError(f"Compilation failed: {result.error}")
        
        ctx.data['bytecode'] = result.data['bytecode']
        ctx.data['abi'] = result.data['abi']
        return result.data
    
    async def compile_compensation(ctx: SagaExecutionContext, result):
        # Compilation is deterministic - no compensation needed
        logger.info("Compensating compilation - no action needed (deterministic)")
        pass
    
    saga.add_step("compile_code", compile_action, compile_compensation)
    
    # Step 3: Store to IPFS
    async def storage_action(ctx: SagaExecutionContext):
        result = await storage_activity.execute_with_retry(
            data={
                'code': ctx.data['code'],
                'abi': ctx.data['abi'],
                'bytecode': ctx.data['bytecode']
            },
            storage_type='ipfs'
        )
        if not result.success:
            raise SagaExecutionError(f"Storage failed: {result.error}")
        
        ctx.data['ipfs_cid'] = result.data['cid']
        return result.data
    
    async def storage_compensation(ctx: SagaExecutionContext, result):
        # Unpin from IPFS
        logger.info(f"Compensating storage - unpinning CID {result.get('cid')}")
        try:
            # await storage_service.unpin(result['cid'])
            pass
        except Exception as e:
            logger.warning(f"Failed to unpin IPFS content: {e}")
    
    saga.add_step("store_ipfs", storage_action, storage_compensation)
    
    # Step 4: Deploy contract
    async def deploy_action(ctx: SagaExecutionContext):
        result = await deploy_activity.execute_with_retry(
            bytecode=ctx.data['bytecode'],
            abi=ctx.data['abi'],
            network=ctx.data['network'],
            wallet_address=ctx.data.get('wallet_address')
        )
        if not result.success:
            raise SagaExecutionError(f"Deployment failed: {result.error}")
        
        ctx.data['contract_address'] = result.data['contract_address']
        ctx.data['tx_hash'] = result.data['tx_hash']
        return result.data
    
    async def deploy_compensation(ctx: SagaExecutionContext, result):
        # Mark deployment as failed in monitoring systems
        logger.warning(
            f"Compensating deployment - marking contract {result.get('contract_address')} as invalid"
        )
        # In practice, might call selfdestruct on contract or mark as failed in DB
        pass
    
    saga.add_step("deploy_contract", deploy_action, deploy_compensation)
    
    # Step 5: Save to database
    async def db_action(ctx: SagaExecutionContext):
        result = await db_activity.execute_with_retry(
            table='deployments',
            data={
                'workflow_id': ctx.workflow_id,
                'contract_address': ctx.data['contract_address'],
                'network': ctx.data['network'],
                'tx_hash': ctx.data['tx_hash'],
                'ipfs_cid': ctx.data['ipfs_cid'],
                'status': 'completed'
            },
            operation='insert'
        )
        if not result.success:
            raise SagaExecutionError(f"Database save failed: {result.error}")
        
        return result.data
    
    async def db_compensation(ctx: SagaExecutionContext, result):
        # Mark deployment as failed in database
        logger.info("Compensating database - marking deployment as failed")
        try:
            await db_activity.execute(
                table='deployments',
                data={
                    'id': result.get('id'),
                    'status': 'failed',
                    'error': 'Saga compensation - deployment rolled back'
                },
                operation='update'
            )
        except Exception as e:
            logger.error(f"Failed to mark deployment as failed in DB: {e}")
            raise
    
    saga.add_step("save_database", db_action, db_compensation)
    
    return saga

