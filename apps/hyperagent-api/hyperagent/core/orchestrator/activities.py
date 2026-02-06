"""
Workflow Activities
Implements external interactions following workflow orchestration patterns
Activities = External calls (APIs, databases, network)
Workflows = Orchestration logic (decision-making, coordination)
"""

import asyncio
from typing import Dict, Any, Optional
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class ActivityResult:
    """Result from an activity execution"""
    success: bool
    data: Any
    error: Optional[str] = None
    retry_count: int = 0


class ActivityExecutionError(Exception):
    """Raised when an activity fails after all retries"""
    def __init__(self, message: str, retryable: bool = True):
        self.retryable = retryable
        super().__init__(message)


class BaseActivity:
    """
    Base class for all activities
    Activities must be idempotent - safe to retry multiple times
    """
    
    def __init__(self, max_retries: int = 3, retry_backoff: float = 2.0):
        self.max_retries = max_retries
        self.retry_backoff = retry_backoff
    
    async def execute_with_retry(self, *args, **kwargs) -> ActivityResult:
        """
        Execute activity with retry logic
        Implements exponential backoff for transient failures
        """
        retry_count = 0
        last_error = None
        
        while retry_count <= self.max_retries:
            try:
                result = await self.execute(*args, **kwargs)
                return ActivityResult(success=True, data=result, retry_count=retry_count)
            
            except ActivityExecutionError as e:
                last_error = e
                if not e.retryable:
                    # Non-retryable error, fail immediately
                    logger.error(f"Non-retryable error in {self.__class__.__name__}: {e}")
                    return ActivityResult(
                        success=False,
                        data=None,
                        error=str(e),
                        retry_count=retry_count
                    )
                
                # Retryable error, apply backoff
                retry_count += 1
                if retry_count <= self.max_retries:
                    wait_time = self.retry_backoff ** retry_count
                    logger.warning(
                        f"Activity {self.__class__.__name__} failed (attempt {retry_count}/{self.max_retries}). "
                        f"Retrying in {wait_time}s... Error: {e}"
                    )
                    await asyncio.sleep(wait_time)
            
            except Exception as e:
                # Unexpected error, treat as retryable
                last_error = e
                retry_count += 1
                if retry_count <= self.max_retries:
                    wait_time = self.retry_backoff ** retry_count
                    logger.warning(
                        f"Activity {self.__class__.__name__} failed unexpectedly (attempt {retry_count}/{self.max_retries}). "
                        f"Retrying in {wait_time}s... Error: {e}"
                    )
                    await asyncio.sleep(wait_time)
        
        # Max retries exceeded
        error_msg = f"Activity {self.__class__.__name__} failed after {self.max_retries} retries: {last_error}"
        logger.error(error_msg)
        return ActivityResult(
            success=False,
            data=None,
            error=error_msg,
            retry_count=retry_count
        )
    
    async def execute(self, *args, **kwargs) -> Any:
        """
        Execute the activity - must be implemented by subclasses
        This method should be idempotent
        """
        raise NotImplementedError("Subclasses must implement execute()")


class CodeGenerationActivity(BaseActivity):
    """Activity: Generate smart contract code using LLM"""
    
    def __init__(self, llm_service):
        super().__init__(max_retries=3)
        self.llm_service = llm_service
    
    async def execute(self, prompt: str, template: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate code - idempotent operation
        Same prompt + template = same code output
        """
        try:
            result = await self.llm_service.generate_contract(
                prompt=prompt,
                template=template
            )
            
            if not result or not result.get('code'):
                raise ActivityExecutionError(
                    "LLM returned empty code",
                    retryable=True
                )
            
            return {
                'code': result['code'],
                'language': result.get('language', 'solidity'),
                'metadata': result.get('metadata', {})
            }
        
        except Exception as e:
            raise ActivityExecutionError(f"Code generation failed: {e}", retryable=True)


class CompilationActivity(BaseActivity):
    """Activity: Compile smart contract code"""
    
    def __init__(self, compiler_service):
        super().__init__(max_retries=2)
        self.compiler_service = compiler_service
    
    async def execute(self, code: str, language: str = 'solidity') -> Dict[str, Any]:
        """
        Compile code - deterministic operation
        Same code = same bytecode/ABI
        """
        try:
            result = await self.compiler_service.compile(
                code=code,
                language=language
            )
            
            if not result.get('bytecode'):
                raise ActivityExecutionError(
                    "Compilation failed - no bytecode produced",
                    retryable=False  # Compilation errors are not retryable
                )
            
            return {
                'bytecode': result['bytecode'],
                'abi': result['abi'],
                'warnings': result.get('warnings', [])
            }
        
        except Exception as e:
            # Syntax errors are not retryable
            raise ActivityExecutionError(
                f"Compilation failed: {e}",
                retryable=False
            )


class SecurityAuditActivity(BaseActivity):
    """Activity: Run security audit on contract"""
    
    def __init__(self, audit_service):
        super().__init__(max_retries=2)
        self.audit_service = audit_service
    
    async def execute(self, code: str, bytecode: Optional[str] = None) -> Dict[str, Any]:
        """
        Run security audit - deterministic for same input
        """
        try:
            findings = await self.audit_service.audit(
                code=code,
                bytecode=bytecode
            )
            
            critical_count = sum(1 for f in findings if f.get('severity') == 'critical')
            high_count = sum(1 for f in findings if f.get('severity') == 'high')
            
            return {
                'findings': findings,
                'critical_count': critical_count,
                'high_count': high_count,
                'passed': critical_count == 0 and high_count == 0
            }
        
        except Exception as e:
            raise ActivityExecutionError(f"Security audit failed: {e}", retryable=True)


class DeploymentActivity(BaseActivity):
    """Activity: Deploy contract to blockchain"""
    
    def __init__(self, deployment_service):
        super().__init__(max_retries=3)
        self.deployment_service = deployment_service
    
    async def execute(
        self,
        bytecode: str,
        abi: list,
        network: str,
        wallet_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Deploy contract - uses idempotency key to prevent duplicate deployments
        """
        try:
            # Generate idempotency key from bytecode + network
            import hashlib
            idempotency_key = hashlib.sha256(
                f"{bytecode}{network}{wallet_address}".encode()
            ).hexdigest()
            
            result = await self.deployment_service.deploy(
                bytecode=bytecode,
                abi=abi,
                network=network,
                wallet_address=wallet_address,
                idempotency_key=idempotency_key
            )
            
            if not result.get('contract_address'):
                raise ActivityExecutionError(
                    "Deployment failed - no contract address returned",
                    retryable=True
                )
            
            return {
                'contract_address': result['contract_address'],
                'tx_hash': result['tx_hash'],
                'gas_used': result.get('gas_used'),
                'block_number': result.get('block_number')
            }
        
        except Exception as e:
            # Network errors are retryable, validation errors are not
            retryable = 'network' in str(e).lower() or 'timeout' in str(e).lower()
            raise ActivityExecutionError(f"Deployment failed: {e}", retryable=retryable)


class StorageActivity(BaseActivity):
    """Activity: Store data to IPFS/database"""
    
    def __init__(self, storage_service):
        super().__init__(max_retries=3)
        self.storage_service = storage_service
    
    async def execute(self, data: Dict[str, Any], storage_type: str = 'ipfs') -> Dict[str, Any]:
        """
        Store data - idempotent with content-addressed storage
        """
        try:
            result = await self.storage_service.store(
                data=data,
                storage_type=storage_type
            )
            
            if not result.get('cid') and not result.get('url'):
                raise ActivityExecutionError(
                    "Storage failed - no CID/URL returned",
                    retryable=True
                )
            
            return {
                'cid': result.get('cid'),
                'url': result.get('url'),
                'storage_type': storage_type
            }
        
        except Exception as e:
            raise ActivityExecutionError(f"Storage failed: {e}", retryable=True)


class DatabaseWriteActivity(BaseActivity):
    """Activity: Write to database"""
    
    def __init__(self, db_session):
        super().__init__(max_retries=2)
        self.db = db_session
    
    async def execute(self, table: str, data: Dict[str, Any], operation: str = 'insert') -> Dict[str, Any]:
        """
        Database write - uses upsert for idempotency
        """
        try:
            # Always use upsert (insert or update) for idempotency
            if operation == 'insert':
                # Use ON CONFLICT DO UPDATE for PostgreSQL
                result = await self.db.execute_upsert(table, data)
            else:
                result = await self.db.update(table, data)
            
            return {'success': True, 'id': result.get('id')}
        
        except Exception as e:
            # Constraint violations are not retryable
            retryable = 'constraint' not in str(e).lower()
            raise ActivityExecutionError(f"Database write failed: {e}", retryable=retryable)

