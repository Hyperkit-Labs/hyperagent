"""Secrets management utilities"""

import base64
import hashlib
import logging
import os
from typing import Optional

from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)


class SecretsManager:
    """
    Secrets Manager

    Concept: Secure storage and retrieval of sensitive data
    Logic: Encrypt secrets at rest, decrypt on demand
    Production: Use AWS Secrets Manager, HashiCorp Vault, etc.
    """

    def __init__(self, encryption_key: Optional[str] = None):
        """
        Initialize secrets manager

        Logic:
        1. Use provided key or generate from environment
        2. Create Fernet cipher for encryption
        """
        if encryption_key:
            key = self._derive_key(encryption_key)
        else:
            key = os.getenv("SECRETS_ENCRYPTION_KEY")
            if not key:
                # Fallback: generate from app secret (not recommended for production)
                key = self._derive_key(os.getenv("APP_SECRET", "default-secret"))

        self.cipher = Fernet(key)

    def _derive_key(self, secret: str) -> bytes:
        """Derive 32-byte key from secret string"""
        # Use SHA256 to derive consistent key
        key = hashlib.sha256(secret.encode()).digest()
        # Encode to base64 for Fernet
        return base64.urlsafe_b64encode(key)

    def encrypt(self, plaintext: str) -> str:
        """Encrypt sensitive data"""
        return self.cipher.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt sensitive data"""
        return self.cipher.decrypt(ciphertext.encode()).decode()

    @staticmethod
    def get_secret(secret_name: str, default: Optional[str] = None) -> str:
        """
        Get secret from environment or secrets manager

        Logic:
        1. Check environment variables first
        2. Check AWS Secrets Manager (if configured)
        3. Check HashiCorp Vault (if configured)
        4. Return default or raise error

        Production: Use cloud secrets manager
        Development: Use environment variables
        """
        # Try environment variable first
        value = os.getenv(secret_name)
        if value:
            return value

        # Check AWS Secrets Manager if configured
        aws_region = os.getenv("AWS_REGION")
        if aws_region:
            try:
                return SecretsManager._get_aws_secret(secret_name, aws_region)
            except Exception as e:
                logger.warning(f"Failed to get secret from AWS Secrets Manager: {e}")

        # Check HashiCorp Vault if configured
        vault_addr = os.getenv("VAULT_ADDR")
        if vault_addr:
            try:
                return SecretsManager._get_vault_secret(secret_name, vault_addr)
            except Exception as e:
                logger.warning(f"Failed to get secret from HashiCorp Vault: {e}")

        if default is not None:
            return default

        raise ValueError(f"Secret '{secret_name}' not found and no default provided")

    @staticmethod
    def validate_secrets(required_secrets: list) -> dict:
        """
        Validate all required secrets are present

        Returns:
            dict with secret_name -> bool (present/absent)
        """
        results = {}
        for secret_name in required_secrets:
            try:
                SecretsManager.get_secret(secret_name)
                results[secret_name] = True
            except ValueError:
                results[secret_name] = False

        return results

    @staticmethod
    def _get_aws_secret(secret_name: str, region: str) -> str:
        """
        Get secret from AWS Secrets Manager

        Requires: boto3 package and AWS credentials configured
        """
        try:
            import boto3
            from botocore.exceptions import ClientError

            client = boto3.client("secretsmanager", region_name=region)
            response = client.get_secret_value(SecretId=secret_name)
            return response["SecretString"]
        except ImportError:
            raise ValueError("boto3 not installed. Install with: pip install boto3")
        except ClientError as e:
            if e.response["Error"]["Code"] == "ResourceNotFoundException":
                raise ValueError(f"Secret '{secret_name}' not found in AWS Secrets Manager")
            raise ValueError(f"AWS Secrets Manager error: {e}")

    @staticmethod
    def _get_vault_secret(secret_name: str, vault_addr: str) -> str:
        """
        Get secret from HashiCorp Vault

        Requires: hvac package and Vault token configured
        """
        try:
            import hvac

            vault_token = os.getenv("VAULT_TOKEN")
            if not vault_token:
                raise ValueError("VAULT_TOKEN environment variable required")

            client = hvac.Client(url=vault_addr, token=vault_token)
            # Parse secret path (format: secret/data/path or secret/path)
            if "/" in secret_name:
                parts = secret_name.split("/", 1)
                mount_point = parts[0] if len(parts) > 1 else "secret"
                path = parts[1] if len(parts) > 1 else secret_name
            else:
                mount_point = "secret"
                path = secret_name

            # Try KV v2 first (secret/data/path)
            try:
                response = client.secrets.kv.v2.read_secret_version(
                    path=path, mount_point=mount_point
                )
                return response["data"]["data"].get("value") or str(response["data"]["data"])
            except Exception:
                # Fallback to KV v1 (secret/path)
                response = client.secrets.kv.v1.read_secret(path=path, mount_point=mount_point)
                return response["data"].get("value") or str(response["data"])
        except ImportError:
            raise ValueError("hvac not installed. Install with: pip install hvac")
        except Exception as e:
            raise ValueError(f"HashiCorp Vault error: {e}")
