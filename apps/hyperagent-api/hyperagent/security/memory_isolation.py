"""Memory Isolation - Layer 2 of 7-Layer Security Defense"""

import hashlib
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from hyperagent.cache.redis_manager import RedisManager
from hyperagent.core.config import settings

logger = logging.getLogger(__name__)

MEMORY_TTL_SECONDS = 86400
GUARDIAN_MODEL_ENABLED = False


class MemoryIsolation:
    """Isolates user memories with ECDSA signing and TTL enforcement"""

    def __init__(self, redis_manager: Optional[RedisManager] = None):
        """
        Initialize Memory Isolation

        Args:
            redis_manager: Optional Redis manager for storage
        """
        self.redis_manager = redis_manager
        self._guardian_client = None

    def _get_guardian_client(self):
        """Lazy initialization of Guardian model client"""
        if not GUARDIAN_MODEL_ENABLED:
            return None

        if self._guardian_client is None:
            try:
                guardian_url = getattr(settings, "guardian_model_url", None)
                guardian_api_key = getattr(settings, "guardian_model_api_key", None)
                if not guardian_url or not guardian_api_key:
                    logger.warning("Guardian model not configured")
                    return None

                import httpx

                self._guardian_client = httpx.AsyncClient(
                    base_url=guardian_url,
                    headers={"Authorization": f"Bearer {guardian_api_key}"},
                )
            except Exception as e:
                logger.warning(f"Failed to initialize Guardian client: {e}")
                return None

        return self._guardian_client

    def _sign_memory(self, user_id: str, content: str) -> str:
        """Sign memory entry with ECDSA"""
        try:
            from cryptography.hazmat.primitives import hashes
            from cryptography.hazmat.primitives.asymmetric import ec
            from cryptography.hazmat.backends import default_backend

            private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
            message = f"{user_id}:{content}".encode()
            signature = private_key.sign(message, ec.ECDSA(hashes.SHA256()))

            return signature.hex()
        except Exception as e:
            logger.warning(f"ECDSA signing failed: {e}, using hash fallback")
            hash_obj = hashlib.sha256(f"{user_id}:{content}".encode())
            return hash_obj.hexdigest()

    async def store_memory(
        self, user_id: str, content: str, metadata: Optional[Dict] = None
    ) -> str:
        """
        Store isolated memory for user

        Args:
            user_id: User identifier
            content: Memory content
            metadata: Optional metadata

        Returns:
            Memory entry ID
        """
        if not self.redis_manager:
            logger.warning("Redis not available, memory isolation disabled")
            return ""

        memory_id = hashlib.sha256(f"{user_id}:{content}:{datetime.now()}".encode()).hexdigest()
        signature = self._sign_memory(user_id, content)

        memory_entry = {
            "user_id": user_id,
            "content": content,
            "signature": signature,
            "created_at": datetime.now().isoformat(),
            "expires_at": (datetime.now() + timedelta(seconds=MEMORY_TTL_SECONDS)).isoformat(),
            "metadata": metadata or {},
        }

        key = f"memory:{user_id}:{memory_id}"
        await self.redis_manager.set(key, memory_entry, ttl=MEMORY_TTL_SECONDS)

        if self._get_guardian_client():
            await self._check_anomaly(user_id, content)

        logger.info(f"Stored memory for user {user_id}: {memory_id}")
        return memory_id

    async def retrieve_memory(self, user_id: str, limit: int = 10) -> List[Dict]:
        """
        Retrieve user's isolated memories

        Args:
            user_id: User identifier
            limit: Maximum number of memories to retrieve

        Returns:
            List of memory dictionaries
        """
        if not self.redis_manager:
            return []

        try:
            pattern = f"memory:{user_id}:*"
            memories = []

            if hasattr(self.redis_manager, "client") and self.redis_manager.client:
                keys = await self.redis_manager.client.keys(pattern)
                for key in keys[:limit]:
                    memory = await self.redis_manager.get(key)
                    if memory:
                        expires_at = datetime.fromisoformat(memory.get("expires_at", ""))
                        if expires_at > datetime.now():
                            memories.append(memory)

            memories.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            return memories[:limit]

        except Exception as e:
            logger.error(f"Failed to retrieve memories: {e}")
            return []

    async def _check_anomaly(self, user_id: str, content: str):
        """Check for anomalies using Guardian model"""
        guardian = self._get_guardian_client()
        if not guardian:
            return

        try:
            response = await guardian.post(
                "/check",
                json={"user_id": user_id, "content": content},
                timeout=5.0,
            )
            if response.status_code == 200:
                result = response.json()
                if result.get("is_anomalous"):
                    logger.warning(
                        f"Anomaly detected for user {user_id}: {result.get('reason')}"
                    )
                    await self._quarantine_memory(user_id, content, result.get("reason"))
        except Exception as e:
            logger.warning(f"Guardian model check failed: {e}")

    async def _quarantine_memory(self, user_id: str, content: str, reason: str):
        """Quarantine suspicious memory"""
        quarantine_entry = {
            "user_id": user_id,
            "content": content,
            "reason": reason,
            "quarantined_at": datetime.now().isoformat(),
        }

        key = f"quarantine:{user_id}:{hashlib.sha256(content.encode()).hexdigest()}"
        if self.redis_manager:
            await self.redis_manager.set(key, quarantine_entry, ttl=MEMORY_TTL_SECONDS)

        logger.warning(f"Quarantined memory for user {user_id}: {reason}")

    async def clear_user_memories(self, user_id: str):
        """Clear all memories for a user"""
        if not self.redis_manager:
            return

        try:
            pattern = f"memory:{user_id}:*"
            if hasattr(self.redis_manager, "client") and self.redis_manager.client:
                keys = await self.redis_manager.client.keys(pattern)
                for key in keys:
                    await self.redis_manager.client.delete(key)
            logger.info(f"Cleared all memories for user {user_id}")
        except Exception as e:
            logger.error(f"Failed to clear memories: {e}")

