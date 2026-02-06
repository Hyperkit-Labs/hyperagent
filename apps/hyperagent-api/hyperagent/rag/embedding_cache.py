"""
Embedding Cache for Template Retrieval Optimization

Caches query embeddings to avoid regenerating them for similar queries.
"""

import hashlib
import json
import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from collections import OrderedDict

logger = logging.getLogger(__name__)


class EmbeddingCache:
    """
    LRU cache for query embeddings
    
    Features:
    - Caches embeddings for similar queries
    - LRU eviction policy
    - TTL-based expiration
    - Similarity-based lookup
    """
    
    def __init__(self, max_size: int = 100, ttl_hours: int = 24):
        """
        Initialize embedding cache
        
        Args:
            max_size: Maximum number of cached embeddings
            ttl_hours: Time-to-live in hours
        """
        self.max_size = max_size
        self.ttl = timedelta(hours=ttl_hours)
        self._cache: OrderedDict[str, Dict] = OrderedDict()
    
    def _get_cache_key(self, query: str) -> str:
        """Generate cache key from query"""
        # Normalize query (lowercase, strip whitespace)
        normalized = query.lower().strip()
        # Create hash for consistent key
        return hashlib.md5(normalized.encode()).hexdigest()
    
    def get(self, query: str) -> Optional[List[float]]:
        """
        Get cached embedding for query
        
        Args:
            query: User query
            
        Returns:
            Cached embedding or None
        """
        cache_key = self._get_cache_key(query)
        
        if cache_key in self._cache:
            entry = self._cache[cache_key]
            
            # Check TTL
            if datetime.now() - entry["timestamp"] < self.ttl:
                # Move to end (most recently used)
                self._cache.move_to_end(cache_key)
                logger.debug(f"Cache hit for query: {query[:50]}...")
                return entry["embedding"]
            else:
                # Expired, remove
                del self._cache[cache_key]
                logger.debug(f"Cache expired for query: {query[:50]}...")
        
        return None
    
    def set(self, query: str, embedding: List[float]) -> None:
        """
        Cache embedding for query
        
        Args:
            query: User query
            embedding: Generated embedding
        """
        cache_key = self._get_cache_key(query)
        
        # Remove if exists (will be added to end)
        if cache_key in self._cache:
            del self._cache[cache_key]
        
        # Add to cache
        self._cache[cache_key] = {
            "embedding": embedding,
            "timestamp": datetime.now(),
            "query": query[:100],  # Store truncated query for debugging
        }
        
        # Evict oldest if over max size
        if len(self._cache) > self.max_size:
            self._cache.popitem(last=False)  # Remove oldest (first item)
        
        logger.debug(f"Cached embedding for query: {query[:50]}...")
    
    def clear(self) -> None:
        """Clear all cached embeddings"""
        self._cache.clear()
        logger.info("Embedding cache cleared")
    
    def get_stats(self) -> Dict[str, any]:
        """Get cache statistics"""
        return {
            "size": len(self._cache),
            "max_size": self.max_size,
            "ttl_hours": self.ttl.total_seconds() / 3600,
        }


# Global cache instance
_global_cache: Optional[EmbeddingCache] = None


def get_embedding_cache() -> EmbeddingCache:
    """Get global embedding cache instance"""
    global _global_cache
    if _global_cache is None:
        _global_cache = EmbeddingCache(max_size=100, ttl_hours=24)
    return _global_cache

