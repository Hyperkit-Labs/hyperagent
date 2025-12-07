"""Batch/parallel deployment logic"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class BatchDeploymentHelper:
    """Helper for batch/parallel deployment operations"""

    async def deploy_sequential_batch(
        self,
        contracts: List[Dict[str, Any]],
        deploy_single_contract,  # Callback to deploy single contract
    ) -> Dict[str, Any]:
        """
        Deploy multiple contracts sequentially

        Args:
            contracts: List of contract deployment configs
            deploy_single_contract: Function to deploy a single contract

        Returns:
            Batch deployment results
        """
        start_time = datetime.now()
        deployments = []

        for contract_config in contracts:
            contract_name = contract_config.get("contract_name", "Unknown")
            try:
                result = await deploy_single_contract(contract_config)

                if result.get("status") == "success":
                    deployments.append(
                        {
                            "contract_name": contract_name,
                            "status": "success",
                            "contract_address": result.get("contract_address"),
                            "transaction_hash": result.get("transaction_hash"),
                            "block_number": result.get("block_number"),
                            "gas_used": result.get("gas_used"),
                            "error": None,
                        }
                    )
                else:
                    deployments.append(
                        {
                            "contract_name": contract_name,
                            "status": "failed",
                            "error": result.get("error", "Unknown error"),
                            "contract_address": None,
                            "transaction_hash": None,
                        }
                    )
            except Exception as e:
                logger.error(f"Sequential deployment failed for {contract_name}: {e}")
                deployments.append(
                    {
                        "contract_name": contract_name,
                        "status": "failed",
                        "error": str(e),
                        "contract_address": None,
                        "transaction_hash": None,
                    }
                )

        end_time = datetime.now()
        total_time = (end_time - start_time).total_seconds()
        success_count = len([d for d in deployments if d["status"] == "success"])

        return {
            "success": success_count > 0,
            "deployments": deployments,
            "total_time": total_time,
            "parallel_count": 0,  # Sequential, no parallel execution
            "success_count": success_count,
            "failed_count": len(deployments) - success_count,
            "batches_deployed": 1,
        }

    async def deploy_parallel_batch(
        self,
        contracts: List[Dict[str, Any]],
        deploy_single_contract,  # Callback to deploy single contract
        max_parallel: int = 10,
    ) -> Dict[str, Any]:
        """
        Deploy multiple contracts in parallel

        Args:
            contracts: List of contract deployment configs
            deploy_single_contract: Function to deploy a single contract
            max_parallel: Maximum number of parallel deployments

        Returns:
            Batch deployment results
        """
        start_time = datetime.now()
        semaphore = asyncio.Semaphore(max_parallel)

        async def deploy_with_semaphore(contract_config: Dict[str, Any]) -> Dict[str, Any]:
            async with semaphore:
                contract_name = contract_config.get("contract_name", "Unknown")
                try:
                    result = await deploy_single_contract(contract_config)
                    return {
                        "contract_name": contract_name,
                        "status": "success" if result.get("status") == "success" else "failed",
                        "contract_address": result.get("contract_address"),
                        "transaction_hash": result.get("transaction_hash"),
                        "block_number": result.get("block_number"),
                        "gas_used": result.get("gas_used"),
                        "error": result.get("error"),
                    }
                except Exception as e:
                    logger.error(f"Parallel deployment failed for {contract_name}: {e}")
                    return {
                        "contract_name": contract_name,
                        "status": "failed",
                        "error": str(e),
                        "contract_address": None,
                        "transaction_hash": None,
                    }

        # Deploy all contracts in parallel
        deployment_tasks = [deploy_with_semaphore(contract) for contract in contracts]
        deployments = await asyncio.gather(*deployment_tasks)

        end_time = datetime.now()
        total_time = (end_time - start_time).total_seconds()
        success_count = len([d for d in deployments if d["status"] == "success"])

        return {
            "success": success_count > 0,
            "deployments": deployments,
            "total_time": total_time,
            "parallel_count": min(max_parallel, len(contracts)),
            "success_count": success_count,
            "failed_count": len(deployments) - success_count,
            "batches_deployed": 1,
        }

