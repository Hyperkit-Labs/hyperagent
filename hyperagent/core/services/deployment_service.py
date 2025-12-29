"""Deployment service implementation"""

import asyncio
import logging
from typing import Any, Dict, List, Optional

from eth_account import Account
from web3 import Web3

from hyperagent.blockchain.alith_client import AlithClient
from hyperagent.blockchain.eigenda_client import EigenDAClient
from hyperagent.blockchain.mantle_sdk import MantleSDKClient
from hyperagent.blockchain.networks import NetworkManager
from hyperagent.core.agent_system import ServiceInterface
from hyperagent.core.config import settings
from hyperagent.core.exceptions import DeploymentError, NetworkError, ValidationError, WalletError
from hyperagent.core.services.deployment.base import BaseDeploymentHelper
from hyperagent.core.services.deployment.batch_deployment import BatchDeploymentHelper
from hyperagent.core.services.deployment.gasless_deployment import GaslessDeploymentHelper
from hyperagent.core.services.deployment.standard_deployment import StandardDeploymentHelper
from hyperagent.core.services.deployment.x402_deployment import X402DeploymentHelper

logger = logging.getLogger(__name__)

GAS_BUFFER_MULTIPLIER = 1.2
DEFAULT_GAS_ESTIMATE = 3000000


class DeploymentService(ServiceInterface):
    """On-chain smart contract deployment service"""

    def __init__(
        self,
        network_manager: Optional[NetworkManager] = None,
        alith_client: Optional[AlithClient] = None,
        eigenda_client: Optional[EigenDAClient] = None,
        use_alith_autonomous: bool = False,
        use_pef: bool = False,
    ):
        """
        Initialize deployment service

        Args:
            network_manager: Network manager for Web3 operations
            alith_client: Alith client for optional autonomous deployment
            eigenda_client: EigenDA client for Mantle deployments
            use_alith_autonomous: If True, use Alith tool calling for autonomous deployment
            use_pef: If True, use Hyperion PEF for parallel batch deployments
        """
        self.network_manager = network_manager or NetworkManager()
        self.alith_client = alith_client
        self.eigenda_client = eigenda_client
        self.use_alith_autonomous = use_alith_autonomous
        self.use_pef = use_pef

        # Initialize deployment helpers
        self.base_helper = BaseDeploymentHelper(self.network_manager)
        self.x402_helper = X402DeploymentHelper(self.network_manager)
        self.gasless_helper = GaslessDeploymentHelper(self.network_manager)
        self.standard_helper = StandardDeploymentHelper(self.network_manager)
        self.batch_helper = BatchDeploymentHelper()

    async def process(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Deploy contract to blockchain"""
        compiled = input_data.get("compiled_contract")
        network = input_data.get("network")
        signed_transaction = input_data.get("signed_transaction")
        wallet_address = input_data.get("wallet_address")
        use_gasless = input_data.get("use_gasless", False)

        if not wallet_address:
            raise WalletError(
                "wallet_address is required for all deployments. "
                "Please provide the user's wallet address. "
                "No PRIVATE_KEY is needed - deployments are user-controlled.",
                details={"field": "wallet_address", "required": True},
            )

        from hyperagent.utils.helpers import normalize_wallet_address, validate_wallet_address

        is_valid, error_msg = validate_wallet_address(wallet_address)
        if not is_valid:
            raise WalletError(
                f"Invalid wallet address: {error_msg}",
                details={"field": "wallet_address", "value": wallet_address},
            )

        wallet_address = normalize_wallet_address(wallet_address)

        logger.info(
            f"Deployment service received - network: {network}, "
            f"wallet_address: {wallet_address}, use_gasless: {use_gasless}, "
            f"signed_transaction: {bool(signed_transaction)}"
        )

        from hyperagent.blockchain.network_features import NetworkFeatureManager

        is_x402_network = NetworkFeatureManager.is_x402_network(
            network, settings.x402_enabled, settings.x402_enabled_networks
        )

        logger.info(f"Network check - network: {network}, is_x402_network: {is_x402_network}")

        if signed_transaction and wallet_address:
            logger.info(f"Using user wallet deployment: {wallet_address} on {network}")
            result = await self.x402_helper.deploy_with_signed_transaction(
                signed_transaction, network, wallet_address
            )
            if "status" not in result:
                result["status"] = "success"
            return result

        if use_gasless and wallet_address and settings.thirdweb_server_wallet_address:
            facilitator_address = settings.thirdweb_server_wallet_address

            # Check if this is an x402 network (Avalanche)
            enabled_networks = (
                [n.strip() for n in settings.x402_enabled_networks.split(",") if n.strip()]
                if settings.x402_enabled_networks
                else []
            )

            is_x402_network = network in enabled_networks and settings.x402_enabled

            if is_x402_network:
                logger.info(
                    f"x402 network ({network}) detected. Facilitator is ERC-4337 Smart Account (not EOA). "
                    f"Gasless deployment via Smart Account requires Thirdweb SDK (TypeScript service). "
                    f"Using user-signed transaction deployment for {wallet_address}. "
                    f"User will sign the deployment transaction in their wallet - no PRIVATE_KEY needed."
                )
            else:
                facilitator_private_key = (
                    settings.thirdweb_server_wallet_private_key
                    if settings.thirdweb_server_wallet_private_key
                    else None
                )

                if not facilitator_private_key:
                    logger.warning(
                        f"Gasless deployment requested but THIRDWEB_SERVER_WALLET_PRIVATE_KEY not configured. "
                        f"Falling back to user-signed transaction deployment for {wallet_address} on {network}. "
                        f"To enable gasless deployment on non-x402 networks, set THIRDWEB_SERVER_WALLET_PRIVATE_KEY in your environment."
                    )
                else:
                    private_key = facilitator_private_key

                    logger.info(
                        f"Using Thirdweb facilitator (EOA) for gasless deployment on {network}. "
                        f"User wallet: {wallet_address}, Facilitator: {facilitator_address}"
                    )

                    if settings.enable_deployment_validation:
                        try:
                            validation_result = await self.validate_deployment_requirements(
                                network, private_key, wallet_address=facilitator_address
                            )
                            logger.info(
                                f"Facilitator wallet validation passed: {validation_result}"
                            )
                        except ValueError as e:
                            logger.error(f"Facilitator wallet validation failed: {e}")
                            from hyperagent.blockchain.network_features import NetworkFeatureManager

                            network_config = NetworkFeatureManager.get_network_config(network)
                            currency = network_config.get("currency", "ETH")
                            raise ValueError(
                                f"Deployment validation failed: {e}. "
                                f"Please fund the Thirdweb facilitator wallet ({facilitator_address}) "
                                f"with {currency} for gas payments."
                            )

                    source_code = input_data.get("source_code")
                    constructor_args = input_data.get("constructor_args", [])
                    return await self.gasless_helper.deploy_gasless_via_facilitator(
                        compiled,
                        network,
                        constructor_args,
                        wallet_address,
                        self._deploy_manual_with_retry,
                    )

        enabled_networks = (
            [n.strip() for n in settings.x402_enabled_networks.split(",") if n.strip()]
            if settings.x402_enabled_networks
            else []
        )
        is_x402_network = network in enabled_networks and settings.x402_enabled

        if is_x402_network and not signed_transaction:
            logger.info(
                f"Deployment skipped for x402 network ({network}). "
                f"User must sign transaction via frontend. "
                f"Workflow will complete without deployment. "
                f"Use /x402/deployments/prepare and /x402/workflows/complete-deployment endpoints."
            )
            return {
                "status": "skipped",
                "message": "Deployment requires user wallet signature. Please use frontend to sign and deploy.",
                "contract_address": None,
                "tx_hash": None,
                "deployment_skipped": True,
                "requires_user_signature": True,
                "network": network,
                "wallet_address": wallet_address,
            }

        if is_x402_network:
            error_message = (
                f"Deployment on x402 network ({network}) requires user wallet signature. "
                f"x402 networks use ERC-4337 Smart Accounts (not EOA), so gasless deployment via facilitator "
                f"requires Thirdweb SDK integration (not available in Python backend). "
                f"Please sign the deployment transaction in your wallet. "
                f"The frontend should prepare and sign the transaction before sending to the backend. "
                f"No PRIVATE_KEY is required - deployments are user-controlled."
            )
        else:
            error_message = (
                f"Deployment requires user wallet signature. "
                f"Please sign the deployment transaction in your wallet. "
                f"The frontend should prepare and sign the transaction before sending to the backend. "
                f"No PRIVATE_KEY is required - deployments are user-controlled. "
                f"Alternatively, set use_gasless=true to use facilitator (if configured for non-x402 networks)."
            )

        raise WalletError(
            error_message,
            details={
                "has_signed_transaction": bool(signed_transaction),
                "has_wallet_address": bool(wallet_address),
                "use_gasless": use_gasless,
                "facilitator_configured": bool(settings.thirdweb_server_wallet_address),
                "is_x402_network": is_x402_network,
                "network": network,
            },
        )

    async def prepare_deployment_transaction(
        self,
        compiled: Dict[str, Any],
        network: str,
        wallet_address: str,
        constructor_args: Optional[List[Any]] = None,
    ) -> Dict[str, Any]:
        """Prepare unsigned deployment transaction for user to sign"""
        from web3 import Web3

        GAS_BUFFER_MULTIPLIER = 1.2
        MAX_PRIORITY_FEE_GWEI = 2
        FEE_HISTORY_BLOCKS = 1

        w3 = self.network_manager.get_web3(network)

        contract = w3.eth.contract(
            abi=compiled.get("abi", []), bytecode=compiled.get("bytecode", "0x")
        )

        constructor_inputs = []
        for item in compiled.get("abi", []):
            if item.get("type") == "constructor":
                constructor_inputs = item.get("inputs", [])
                break

        needs_args = len(constructor_inputs) > 0
        if needs_args:
            if not constructor_args or len(constructor_args) != len(constructor_inputs):
                raise ValueError(
                    f"Constructor requires {len(constructor_inputs)} arguments, "
                    f"got {len(constructor_args) if constructor_args else 0}"
                )
            constructor = contract.constructor(*constructor_args)
        else:
            constructor = contract.constructor()

        try:
            gas_estimate = constructor.estimate_gas({"from": wallet_address})
        except Exception as e:
            raise ValueError(f"Gas estimation failed: {e}")

        network_config = self.network_manager.get_network_config(network)
        chain_id = network_config.get("chain_id")

        try:
            fee_data = w3.eth.fee_history(FEE_HISTORY_BLOCKS, "latest")
            base_fee = fee_data["baseFeePerGas"][0]
            max_priority_fee = w3.to_wei(MAX_PRIORITY_FEE_GWEI, "gwei")
            gas_price = base_fee + max_priority_fee
        except Exception:
            gas_price = w3.eth.gas_price

        nonce = w3.eth.get_transaction_count(wallet_address)

        tx = constructor.build_transaction(
            {
                "from": wallet_address,
                "nonce": nonce,
                "gas": int(gas_estimate * GAS_BUFFER_MULTIPLIER),
                "gasPrice": gas_price,
                "chainId": chain_id,
            }
        )

        logger.info(
            f"Prepared deployment transaction for {wallet_address} on {network}: "
            f"nonce={nonce}, gas={tx['gas']}, chainId={chain_id}"
        )

        return {
            "transaction": tx,
            "network": network,
            "wallet_address": wallet_address,
            "chain_id": chain_id,
            "gas_estimate": str(gas_estimate),
            "gas_price": str(gas_price),
        }

    async def _deploy_with_signed_transaction(
        self, signed_transaction: str, network: str, wallet_address: str
    ) -> Dict[str, Any]:
        """
        Deploy contract using signed transaction from user's wallet - delegates to x402 helper

        Note: This method is kept for backward compatibility but delegates to X402DeploymentHelper
        """
        result = await self.x402_helper.deploy_with_signed_transaction(
            signed_transaction, network, wallet_address
        )
        if "tx_hash" not in result and "transaction_hash" in result:
            result["tx_hash"] = result["transaction_hash"]
        return result

    async def _deploy_gasless_via_facilitator(
        self,
        compiled: Dict[str, Any],
        network: str,
        constructor_args: List[Any],
        wallet_address: str,
    ) -> Dict[str, Any]:
        """
        Deploy contract using gasless facilitator (EOA only - NOT for x402 networks)

        Delegates to GaslessDeploymentHelper
        """
        # Validate facilitator wallet balance (it pays for gas)
        facilitator_private_key = (
            settings.thirdweb_server_wallet_private_key
            if settings.thirdweb_server_wallet_private_key
            else None
        )

        if facilitator_private_key and settings.enable_deployment_validation:
            facilitator_address = settings.thirdweb_server_wallet_address
            try:
                validation_result = await self.validate_deployment_requirements(
                    network, facilitator_private_key, wallet_address=facilitator_address
                )
                logger.info(f"Facilitator wallet validation passed: {validation_result}")
            except ValueError as e:
                logger.error(f"Facilitator wallet validation failed: {e}")
                currency = "AVAX" if network in ["avalanche_fuji", "avalanche_mainnet"] else "ETH"
                raise ValueError(
                    f"Deployment validation failed: {e}. "
                    f"Please fund the Thirdweb facilitator wallet ({facilitator_address}) "
                    f"with {currency} for gas payments."
                )

        return await self.gasless_helper.deploy_gasless_via_facilitator(
            compiled, network, constructor_args, wallet_address, self._deploy_manual_with_retry
        )

    async def validate(self, data: Dict[str, Any]) -> bool:
        """Validate deployment input"""
        return bool(data.get("compiled_contract") and data.get("network"))

    async def _deploy_via_alith(
        self, compiled: Dict[str, Any], network: str, private_key: str
    ) -> Dict[str, Any]:
        """Deploy contract using Alith autonomous agent with tool calling"""
        BYTECODE_PREVIEW_LENGTH = 100

        try:
            from hyperagent.blockchain.alith_tools import AlithToolHandler, get_deployment_tools

            tool_handler = AlithToolHandler(
                network_manager=self.network_manager,
                eigenda_client=self.eigenda_client,
                private_key=private_key,
            )

            tools = get_deployment_tools()

            agent_name = "autonomous_deployer"
            if agent_name not in self.alith_client.list_agents():
                await self.alith_client.initialize_agent(
                    name=agent_name,
                    preamble="You are an autonomous smart contract deployment agent. Use the deploy_contract tool to deploy contracts to the blockchain.",
                )

            bytecode = compiled.get("bytecode", "")
            abi = compiled.get("abi", [])

            prompt = f"Deploy this contract to {network}. Bytecode: {bytecode[:BYTECODE_PREVIEW_LENGTH]}..."

            result = await self.alith_client.execute_agent_with_tools(
                agent_name=agent_name,
                prompt=prompt,
                tools=tools,
                context={"bytecode": bytecode, "abi": abi, "network": network},
                tool_handler=tool_handler,
            )

            if result.get("success") and result.get("tool_results"):
                for tool_result in result["tool_results"]:
                    if tool_result.get("tool") == "deploy_contract":
                        deploy_result = tool_result.get("result", {})
                        if deploy_result.get("success"):
                            return {
                                "status": "success",
                                "contract_address": deploy_result.get("contract_address"),
                                "transaction_hash": deploy_result.get("transaction_hash"),
                                "block_number": deploy_result.get("block_number"),
                                "gas_used": deploy_result.get("gas_used"),
                                "eigenda_commitment": deploy_result.get("eigenda_commitment"),
                                "deployment_method": "alith_autonomous",
                            }
                        else:
                            raise ValueError(
                                f"Alith deployment failed: {deploy_result.get('error')}"
                            )

            logger.warning(
                "Alith agent did not execute deploy_contract tool, falling back to manual deployment"
            )
            return await self._deploy_manual(compiled, network, private_key)

        except Exception as e:
            logger.error(
                f"Alith autonomous deployment failed: {e}, falling back to manual", exc_info=True
            )
            return await self._deploy_manual(compiled, network, private_key)

    async def validate_deployment_requirements(
        self, network: str, private_key: str, wallet_address: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Validate deployment requirements before attempting deployment

        Checks:
        1. RPC endpoint is reachable
        2. Wallet has sufficient balance
        3. Network chain ID matches
        4. Gas price is reasonable

        Args:
            network: Target network name
            private_key: Private key for deployment
            wallet_address: Optional wallet address to validate (for facilitator wallet)

        Returns:
            Validation result dictionary

        Raises:
            ValueError: If validation fails
        """
        w3 = self.network_manager.get_web3(network)

        # Use provided wallet address (e.g., facilitator wallet) or derive from private key
        if wallet_address:
            # Validate facilitator wallet address directly
            try:
                # Validate address format
                if not w3.is_address(wallet_address):
                    raise ValueError(f"Invalid wallet address: {wallet_address}")
                address_to_check = w3.to_checksum_address(wallet_address)
            except Exception as e:
                raise ValueError(f"Invalid wallet address format: {e}")
        else:
            # Derive address from private key
            account = Account.from_key(private_key)
            address_to_check = account.address

        # Check RPC connectivity
        try:
            latest_block = w3.eth.get_block("latest")
        except Exception as e:
            raise ValueError(f"RPC endpoint unreachable for {network}: {e}")

        # Check wallet balance
        balance = w3.eth.get_balance(address_to_check)
        if balance == 0:
            wallet_name = "facilitator wallet" if wallet_address else "wallet"
            raise ValueError(
                f"{wallet_name.capitalize()} {address_to_check} has zero balance. "
                f"Please fund the {wallet_name} before deployment."
            )

        # Check minimum balance
        min_balance_wei = w3.to_wei(settings.min_wallet_balance_eth, "ether")
        if balance < min_balance_wei:
            balance_eth = float(w3.from_wei(balance, "ether"))
            wallet_name = "facilitator wallet" if wallet_address else "wallet"
            currency = "AVAX" if network in ["avalanche_fuji", "avalanche_mainnet"] else "ETH"
            logger.warning(
                f"{wallet_name.capitalize()} balance low: {balance_eth} {currency}. "
                f"Minimum recommended: {settings.min_wallet_balance_eth} {currency}"
            )

        # Verify chain ID
        network_config = self.network_manager.get_network_config(network)
        expected_chain_id = network_config.get("chain_id")
        actual_chain_id = w3.eth.chain_id

        if expected_chain_id and actual_chain_id != expected_chain_id:
            logger.warning(
                f"Chain ID mismatch: expected {expected_chain_id}, got {actual_chain_id}"
            )

        return {
            "rpc_connected": True,
            "wallet_address": address_to_check,
            "balance_wei": balance,
            "balance_eth": float(w3.from_wei(balance, "ether")),
            "chain_id": actual_chain_id,
            "latest_block": latest_block["number"],
            "validation_passed": True,
        }

    async def _deploy_manual_with_retry(
        self,
        compiled: Dict[str, Any],
        network: str,
        private_key: str,
        source_code: Optional[str] = None,
        constructor_args: Optional[List[Any]] = None,
        max_retries: int = 3,
    ) -> Dict[str, Any]:
        """
        Deploy with automatic retry on network failures

        Args:
            compiled: Compiled contract data
            network: Target network
            private_key: Private key
            source_code: Optional source code
            constructor_args: Optional constructor arguments
            max_retries: Maximum retry attempts

        Returns:
            Deployment result
        """
        last_exception = None

        for attempt in range(max_retries):
            try:
                return await self._deploy_manual(
                    compiled, network, private_key, source_code, constructor_args
                )
            except (ConnectionError, TimeoutError, ValueError) as e:
                last_exception = e
                if attempt < max_retries - 1:
                    wait_time = 2**attempt  # Exponential backoff: 1s, 2s, 4s
                    logger.warning(
                        f"Deployment failed (attempt {attempt + 1}/{max_retries}): {e}. "
                        f"Retrying in {wait_time}s..."
                    )
                    import asyncio

                    await asyncio.sleep(wait_time)
                else:
                    logger.error(f"Deployment failed after {max_retries} attempts: {e}")
                    raise

        raise last_exception or ValueError("Deployment failed")

    async def _deploy_manual(
        self,
        compiled: Dict[str, Any],
        network: str,
        private_key: str,
        source_code: Optional[str] = None,
        constructor_args: Optional[List[Any]] = None,
    ) -> Dict[str, Any]:
        """Manual deployment using Web3.py or Mantle SDK"""
        deployment_result = await self.standard_helper.deploy_manual(
            compiled, network, private_key, source_code, constructor_args
        )
        import asyncio

        from eth_account import Account

        from hyperagent.blockchain.network_features import NetworkFeature, NetworkFeatureManager

        if (
            NetworkFeatureManager.supports_feature(network, NetworkFeature.EIGENDA)
            and self.eigenda_client
        ):
            # Store EigenDA metadata in background (non-blocking)
            account = Account.from_key(private_key)
            tx_hash_hex = deployment_result.get("transaction_hash")

            # Get receipt for EigenDA storage
            w3 = self.network_manager.get_web3(network)
            tx_hash = (
                w3.to_bytes(hexstr=tx_hash_hex) if isinstance(tx_hash_hex, str) else tx_hash_hex
            )
            receipt = w3.eth.get_transaction_receipt(tx_hash)

            # Initialize EigenDA fields
            deployment_result["eigenda_commitment"] = None
            deployment_result["eigenda_metadata_stored"] = False

            # Schedule EigenDA storage in background
            try:
                asyncio.create_task(
                    self._store_eigenda_metadata_async(
                        network=network,
                        source_code=source_code,
                        compiled=compiled,
                        receipt=receipt,
                        tx_hash=tx_hash,
                        account_address=account.address,
                        deployment_result=deployment_result,
                    )
                )
                logger.debug("EigenDA metadata storage scheduled in background")
            except RuntimeError as e:
                logger.warning(
                    f"Could not schedule EigenDA background storage: {e}. Deployment still successful."
                )
        else:
            logger.debug(f"EigenDA not available for {network}, skipping data availability storage")

        return deployment_result

    async def _store_eigenda_metadata_async(
        self,
        network: str,
        source_code: Optional[str],
        compiled: Dict[str, Any],
        receipt: Dict[str, Any],
        tx_hash: Any,
        account_address: str,
        deployment_result: Dict[str, Any],
    ):
        """
        Store EigenDA metadata asynchronously (non-blocking)

        This allows the deployment to return immediately while EigenDA storage
        happens in the background. The result is updated when storage completes.
        """
        try:
            eigenda_commitment = None
            eigenda_metadata_stored = False

            if source_code:
                eigenda_commitment = await self.eigenda_client.store_contract_metadata(
                    contract_address=receipt["contractAddress"],
                    abi=compiled.get("abi", []),
                    source_code=source_code,
                    deployment_info={
                        "transaction_hash": tx_hash.hex(),
                        "block_number": receipt["blockNumber"],
                        "gas_used": receipt["gasUsed"],
                        "network": network,
                        "deployer_address": account_address,
                    },
                )
                eigenda_metadata_stored = True
            else:
                bytecode = compiled.get("bytecode", "")
                if isinstance(bytecode, str):
                    bytecode = bytecode.replace("0x", "")
                    bytecode_bytes = bytes.fromhex(bytecode)
                else:
                    bytecode_bytes = bytecode if bytecode else b""

                if bytecode_bytes:
                    eigenda_result = await self.eigenda_client.submit_blob(bytecode_bytes)
                    eigenda_commitment = eigenda_result.get("commitment")

            deployment_result["eigenda_commitment"] = eigenda_commitment
            deployment_result["eigenda_metadata_stored"] = eigenda_metadata_stored
            logger.info(
                f"EigenDA metadata stored for contract {receipt['contractAddress']}: {eigenda_commitment}"
            )
        except Exception as e:
            logger.warning(f"EigenDA metadata storage failed (non-blocking): {e}")

    async def deploy_batch(
        self,
        contracts: List[Dict[str, Any]],
        network: str,
        use_pef: Optional[bool] = None,
        max_parallel: int = 10,
        private_key: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Deploy multiple contracts in parallel using PEF

        Concept: Use Hyperion PEF for parallel batch deployment
        Logic:
            1. Initialize PEF manager if use_pef=True and network is Hyperion
            2. Analyze dependencies
            3. Deploy independent contracts in parallel
            4. Return batch results

        Args:
            contracts: List of contract dictionaries with compiled_contract
            network: Target network
            use_pef: Override instance use_pef setting (defaults to self.use_pef)
            max_parallel: Maximum parallel deployments per batch
            private_key: Private key for deployment

        Returns:
            Batch deployment results with success/failure status for each contract
        """
        use_pef_flag = use_pef if use_pef is not None else self.use_pef

        # Check if PEF is available (with graceful fallback)
        from hyperagent.blockchain.network_features import NetworkFeature, NetworkFeatureManager

        if use_pef_flag:
            if NetworkFeatureManager.supports_feature(network, NetworkFeature.PEF):
                from hyperagent.blockchain.hyperion_pef import HyperionPEFManager

                pef_manager = HyperionPEFManager(self.network_manager)
                return await pef_manager.deploy_batch(
                    contracts=contracts,
                    network=network,
                    max_parallel=max_parallel,
                    private_key=private_key or settings.private_key,
                )
            else:
                logger.warning(
                    f"PEF requested but not available for {network}. "
                    f"Falling back to sequential batch deployment."
                )
                return await self._deploy_sequential_batch(contracts, network, private_key)
        else:
            return await self._deploy_sequential_batch(contracts, network, private_key)

    async def _deploy_sequential_batch(
        self, contracts: List[Dict[str, Any]], network: str, private_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """Deploy contracts sequentially (fallback when PEF not available)"""
        async def deploy_single(contract_config: Dict[str, Any]) -> Dict[str, Any]:
            """Helper to deploy a single contract"""
            result = await self.process(
                {
                    "compiled_contract": contract_config.get("compiled_contract"),
                    "network": network,
                    "private_key": private_key,
                    "constructor_args": contract_config.get("constructor_args", []),
                }
            )
            if "status" not in result:
                result["status"] = "success" if result.get("contract_address") else "failed"
            return result

        return await self.batch_helper.deploy_sequential_batch(contracts, deploy_single)

    async def on_error(self, error: Exception) -> None:
        """Handle service-specific errors"""
        logger.error(f"Deployment service error: {error}", exc_info=error)

    async def estimate_gas(
        self,
        bytecode: str,
        network: str,
        constructor_args: Optional[list] = None
    ) -> int:
        """
        Estimate gas for contract deployment
        
        Args:
            bytecode: Contract bytecode
            network: Target network
            constructor_args: Constructor arguments if any
            
        Returns:
            Estimated gas limit
        """
        try:
            w3 = self.network_manager.get_web3(network)
            
            # Prepare deployment transaction
            if not bytecode.startswith('0x'):
                bytecode = f'0x{bytecode}'
            
            # Estimate gas
            gas_estimate = w3.eth.estimate_gas({
                'data': bytecode
            })
            
            # Add buffer for safety
            buffered_gas = int(gas_estimate * GAS_BUFFER_MULTIPLIER)
            
            logger.info(
                f"Gas estimate for deployment on {network}: "
                f"{gas_estimate} (buffered: {buffered_gas})"
            )
            
            return buffered_gas
            
        except Exception as e:
            logger.warning(
                f"Failed to estimate gas: {str(e)}. Using default: {DEFAULT_GAS_ESTIMATE}"
            )
            return DEFAULT_GAS_ESTIMATE

    async def get_contract_address_from_tx(
        self,
        tx_hash: str,
        network: str,
        max_retries: int = 10,
        retry_delay: int = 2
    ) -> Optional[str]:
        """
        Get contract address from deployment transaction receipt
        
        Args:
            tx_hash: Transaction hash
            network: Network where transaction was sent
            max_retries: Maximum number of retries to get receipt
            retry_delay: Delay between retries in seconds
            
        Returns:
            Contract address or None if not found
        """
        try:
            w3 = self.network_manager.get_web3(network)
            
            # Ensure tx_hash has 0x prefix
            if not tx_hash.startswith('0x'):
                tx_hash = f'0x{tx_hash}'
            
            # Try to get receipt with retries
            for attempt in range(max_retries):
                try:
                    receipt = w3.eth.get_transaction_receipt(tx_hash)
                    
                    if receipt and receipt.get('contractAddress'):
                        contract_address = receipt['contractAddress']
                        logger.info(
                            f"Contract deployed at {contract_address} "
                            f"(tx: {tx_hash}, network: {network})"
                        )
                        return contract_address
                    
                    if receipt and receipt.get('status') == 0:
                        logger.error(f"Transaction {tx_hash} failed on {network}")
                        raise DeploymentError(
                            f"Transaction {tx_hash} failed. "
                            f"Check the transaction on block explorer for details."
                        )
                        
                except Exception as e:
                    if attempt < max_retries - 1:
                        logger.debug(
                            f"Attempt {attempt + 1}/{max_retries}: "
                            f"Transaction not mined yet, waiting {retry_delay}s..."
                        )
                        await asyncio.sleep(retry_delay)
                    else:
                        raise
            
            logger.warning(
                f"Transaction {tx_hash} not found after {max_retries} attempts"
            )
            return None
            
        except Exception as e:
            logger.error(
                f"Failed to get contract address from tx {tx_hash}: {str(e)}",
                exc_info=True
            )
            raise DeploymentError(f"Failed to get contract address: {str(e)}")
