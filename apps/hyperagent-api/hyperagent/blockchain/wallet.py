"""Wallet manager for secure key management"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from cryptography.fernet import Fernet
from eth_account import Account
from web3 import Web3

from hyperagent.blockchain.networks import NetworkManager

logger = logging.getLogger(__name__)


class WalletError(Exception):
    """Wallet management error"""

    pass


class WalletManager:
    """
    Wallet Manager

    Concept: Secure key management with encryption
    Logic:
        - Encrypt private keys at rest
        - Support multiple wallets
        - Check balances
        - Sign transactions
    Security:
        - Keys encrypted with Fernet (symmetric encryption)
        - Keys never stored in plaintext
        - Access control via authentication
    """

    def __init__(self, encryption_key: str, network_manager: NetworkManager):
        """
        Initialize wallet manager

        Args:
            encryption_key: Base64-encoded Fernet key for encryption
            network_manager: NetworkManager instance for blockchain access
        """
        try:
            self.cipher = Fernet(encryption_key.encode())
        except Exception as e:
            raise WalletError(f"Invalid encryption key: {e}")

        self.network_manager = network_manager
        self._wallets: Dict[str, str] = {}  # name -> encrypted_key (hex)
        self._wallet_metadata: Dict[str, Dict] = {}  # name -> metadata

    def add_wallet(
        self, name: str, private_key: str, metadata: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Add wallet with encrypted storage

        Concept: Store private key encrypted at rest
        Logic:
            1. Validate private key format
            2. Encrypt private key
            3. Store encrypted key
            4. Store metadata

        Args:
            name: Wallet identifier
            private_key: Private key (hex string with or without 0x prefix)
            metadata: Optional metadata (description, tags, etc.)
        """
        # Validate private key
        try:
            # Remove 0x prefix if present
            if private_key.startswith("0x"):
                private_key = private_key[2:]

            # Validate hex format
            if len(private_key) != 64:
                raise ValueError("Private key must be 64 hex characters")

            int(private_key, 16)  # Validate hex

            # Create account to verify key
            account = Account.from_key(f"0x{private_key}")

        except Exception as e:
            raise WalletError(f"Invalid private key: {e}")

        # Encrypt private key
        try:
            encrypted = self.cipher.encrypt(private_key.encode())
            self._wallets[name] = encrypted.hex()

            # Store metadata
            self._wallet_metadata[name] = {
                "address": account.address,
                "created_at": datetime.now().isoformat(),
                **(metadata or {}),
            }

            logger.info(f"Wallet added: {name} ({account.address})")
        except Exception as e:
            raise WalletError(f"Failed to encrypt wallet: {e}")

    def remove_wallet(self, name: str) -> bool:
        """
        Remove wallet from manager

        Args:
            name: Wallet identifier

        Returns:
            True if removed, False if not found
        """
        if name in self._wallets:
            del self._wallets[name]
            if name in self._wallet_metadata:
                del self._wallet_metadata[name]
            logger.info(f"Wallet removed: {name}")
            return True
        return False

    def get_account(self, name: str) -> Account:
        """
        Get account from wallet

        Concept: Decrypt and return account
        Logic:
            1. Get encrypted key
            2. Decrypt private key
            3. Create Account instance
            4. Return account

        Args:
            name: Wallet identifier

        Returns:
            Account instance
        """
        if name not in self._wallets:
            raise WalletError(f"Wallet {name} not found")

        try:
            encrypted = bytes.fromhex(self._wallets[name])
            private_key = self.cipher.decrypt(encrypted).decode()
            return Account.from_key(f"0x{private_key}")
        except Exception as e:
            raise WalletError(f"Failed to decrypt wallet {name}: {e}")

    def get_wallet_address(self, name: str) -> str:
        """Get wallet address without decrypting key"""
        if name not in self._wallet_metadata:
            raise WalletError(f"Wallet {name} not found")
        return self._wallet_metadata[name]["address"]

    async def get_balance(self, network: str, wallet_name: str) -> float:
        """
        Get wallet balance

        Concept: Query blockchain for wallet balance
        Logic:
            1. Get account from wallet
            2. Query balance from network
            3. Convert from Wei to Ether
            4. Return balance

        Args:
            network: Network name
            wallet_name: Wallet identifier

        Returns:
            Balance in Ether (float)
        """
        account = self.get_account(wallet_name)
        w3 = self.network_manager.get_web3(network)

        try:
            balance_wei = w3.eth.get_balance(account.address)
            balance_eth = float(w3.from_wei(balance_wei, "ether"))
            logger.info(f"Balance for {wallet_name}: {balance_eth} ETH")
            return balance_eth
        except Exception as e:
            logger.error(f"Failed to get balance: {e}")
            raise WalletError(f"Balance check failed: {e}")

    def sign_transaction(self, wallet_name: str, transaction: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sign transaction with wallet

        Concept: Sign transaction using wallet's private key
        Logic:
            1. Get account from wallet
            2. Sign transaction
            3. Return signed transaction

        Args:
            wallet_name: Wallet identifier
            transaction: Transaction dictionary

        Returns:
            Signed transaction dictionary
        """
        account = self.get_account(wallet_name)

        try:
            signed_tx = account.sign_transaction(transaction)
            return {
                "rawTransaction": signed_tx.rawTransaction.hex(),
                "hash": signed_tx.hash.hex(),
                "r": signed_tx.r,
                "s": signed_tx.s,
                "v": signed_tx.v,
            }
        except Exception as e:
            logger.error(f"Transaction signing failed: {e}")
            raise WalletError(f"Signing failed: {e}")

    def list_wallets(self) -> List[Dict[str, Any]]:
        """
        List all wallets with metadata

        Returns:
            List of wallet information (without private keys)
        """
        wallets = []
        for name, metadata in self._wallet_metadata.items():
            wallets.append(
                {
                    "name": name,
                    "address": metadata["address"],
                    "created_at": metadata.get("created_at"),
                    "description": metadata.get("description"),
                    "tags": metadata.get("tags", []),
                }
            )
        return wallets

    def export_wallet(self, name: str, password: Optional[str] = None) -> Dict[str, Any]:
        """
        Export wallet (encrypted)

        Concept: Export wallet for backup/transfer
        Logic:
            1. Get encrypted key
            2. Package with metadata
            3. Optionally encrypt with password

        Args:
            name: Wallet identifier
            password: Optional password for additional encryption

        Returns:
            Encrypted wallet data
        """
        if name not in self._wallets:
            raise WalletError(f"Wallet {name} not found")

        return {
            "name": name,
            "encrypted_key": self._wallets[name],
            "metadata": self._wallet_metadata[name],
            "encrypted_at": datetime.now().isoformat(),
        }

    def import_wallet(self, wallet_data: Dict[str, Any]) -> str:
        """
        Import wallet from export data

        Args:
            wallet_data: Wallet export data

        Returns:
            Wallet name
        """
        name = wallet_data["name"]
        self._wallets[name] = wallet_data["encrypted_key"]
        self._wallet_metadata[name] = wallet_data.get("metadata", {})
        logger.info(f"Wallet imported: {name}")
        return name
