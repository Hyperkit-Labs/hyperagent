"""Firecrawl RAG integration for live documentation scraping"""

import hashlib
import logging
from typing import Any, Dict, List, Optional

from hyperagent.cache.redis_manager import RedisManager
from hyperagent.core.config import settings
from hyperagent.llm.provider import LLMProvider
from hyperagent.rag.vector_store import VectorStore

logger = logging.getLogger(__name__)

FIRECRAWL_CONTEXT_CACHE_TTL_SECONDS = 21600
MAX_CONTEXT_CHARS = 8000

PROTOCOL_DOCS = {
    # Core DeFi protocols
    "uniswap": [
        "https://docs.uniswap.org/contracts/v3/overview",
        "https://docs.uniswap.org/contracts/v4/overview",
    ],
    "aave": [
        "https://docs.aave.com/developers",
        "https://docs.aave.com/developers/v/2.0",
    ],
    "curve": [
        "https://curve.readthedocs.io/",
        "https://curve.readthedocs.io/dao/overview.html",
    ],
    "yearn": [
        "https://docs.yearn.finance/",
        "https://docs.yearn.finance/developers",
    ],
    "makerdao": [
        "https://docs.makerdao.com/",
        "https://github.com/makerdao/dss",
    ],
    "compound": [
        "https://compound.finance/docs",
        "https://compound.finance/docs/v3",
    ],
    # DEX & AMM protocols
    "balancer": [
        "https://docs.balancer.fi/",
        "https://docs.balancer.fi/concepts/pools/",
    ],
    "sushiswap": [
        "https://docs.sushi.com/",
        "https://docs.sushi.com/docs/Products/",
    ],
    "pancakeswap": [
        "https://docs.pancakeswap.finance/",
        "https://docs.pancakeswap.finance/developers/",
    ],
    # Aggregators
    "1inch": [
        "https://docs.1inch.io/",
        "https://docs.1inch.io/docs/aggregation-protocol/introduction",
    ],
    "cowswap": [
        "https://docs.cow.fi/",
        "https://docs.cow.fi/cow-protocol",
    ],
    # Lending & Borrowing
    "convex": [
        "https://docs.convexfinance.com/",
    ],
    "frax": [
        "https://docs.frax.finance/",
        "https://docs.frax.finance/frax-v3/overview",
    ],
    "morpho": [
        "https://docs.morpho.org/",
    ],
    "euler": [
        "https://docs.euler.finance/",
    ],
    # Derivatives & Options
    "synthetix": [
        "https://docs.synthetix.io/",
    ],
    "gmx": [
        "https://docs.gmx.io/",
    ],
    "perpetual": [
        "https://docs.perp.com/",
    ],
    # Staking & Liquid Staking
    "lido": [
        "https://docs.lido.fi/",
    ],
    "rocketpool": [
        "https://docs.rocketpool.net/",
    ],
    # Yield Optimization
    "pendle": [
        "https://docs.pendle.finance/",
    ],
    # Cross-chain & Bridges
    "stargate": [
        "https://stargateprotocol.gitbook.io/",
    ],
    "across": [
        "https://docs.across.to/",
    ],
}


class FirecrawlRAG:
    """Fetches live documentation from protocols and provides context for code generation"""

    def __init__(
        self,
        redis_manager: Optional[RedisManager] = None,
        vector_store: Optional[VectorStore] = None,
        llm_provider: Optional[LLMProvider] = None,
    ):
        """
        Initialize Firecrawl RAG

        Args:
            redis_manager: Optional Redis manager for caching
            vector_store: Optional vector store for semantic search
            llm_provider: Optional LLM provider for embeddings
        """
        self.redis_manager = redis_manager
        self.vector_store = vector_store
        self.llm_provider = llm_provider
        self._firecrawl_client = None

    def _get_firecrawl_client(self):
        """Lazy initialization of Firecrawl client"""
        if self._firecrawl_client is None:
            try:
                from firecrawl import FirecrawlApp

                api_key = getattr(settings, "firecrawl_api_key", None)
                if not api_key:
                    logger.warning(
                        "Firecrawl API key not configured. Set FIRECRAWL_API_KEY. Using fallback."
                    )
                    return None
                self._firecrawl_client = FirecrawlApp(api_key=api_key)
            except ImportError:
                logger.warning(
                    "firecrawl package not installed. Install with: pip install firecrawl-py"
                )
                return None
        return self._firecrawl_client

    def _determine_relevant_protocols(self, prompt: str) -> List[str]:
        """Determine which protocol docs to fetch based on prompt"""
        prompt_lower = prompt.lower()
        relevant = []

        # DEX & AMM
        if any(term in prompt_lower for term in ["uniswap", "swap", "amm", "dex", "liquidity pool"]):
            relevant.append("uniswap")
        if any(term in prompt_lower for term in ["balancer", "weighted pool"]):
            relevant.append("balancer")
        if any(term in prompt_lower for term in ["sushiswap", "sushi"]):
            relevant.append("sushiswap")
        if any(term in prompt_lower for term in ["pancakeswap", "pancake"]):
            relevant.append("pancakeswap")

        # Lending & Borrowing
        if any(term in prompt_lower for term in ["aave", "lending", "borrow", "collateral"]):
            relevant.append("aave")
        if any(term in prompt_lower for term in ["compound", "ctoken", "supply"]):
            relevant.append("compound")
        if any(term in prompt_lower for term in ["morpho", "peer"]):
            relevant.append("morpho")
        if any(term in prompt_lower for term in ["euler", "reactive"]):
            relevant.append("euler")

        # Stable & Curve
        if any(term in prompt_lower for term in ["curve", "stable", "stablecoin", "metapool"]):
            relevant.append("curve")
        if any(term in prompt_lower for term in ["convex", "boost", "crv"]):
            relevant.append("convex")
        if any(term in prompt_lower for term in ["frax", "fxs"]):
            relevant.append("frax")

        # Yield & Vaults
        if any(term in prompt_lower for term in ["yearn", "vault", "yield", "strategy"]):
            relevant.append("yearn")
        if any(term in prompt_lower for term in ["pendle", "pt", "yt", "fixed yield"]):
            relevant.append("pendle")

        # Stablecoins & CDP
        if any(term in prompt_lower for term in ["maker", "dai", "cdp", "vault"]):
            relevant.append("makerdao")

        # Aggregators
        if any(term in prompt_lower for term in ["1inch", "aggregat", "route", "split"]):
            relevant.append("1inch")
        if any(term in prompt_lower for term in ["cowswap", "cow", "intent"]):
            relevant.append("cowswap")

        # Derivatives & Perps
        if any(term in prompt_lower for term in ["synthetix", "synth", "perp", "perpetual"]):
            relevant.append("synthetix")
        if any(term in prompt_lower for term in ["gmx", "perpetual", "leverage"]):
            relevant.append("gmx")
        if any(term in prompt_lower for term in ["perpetual protocol", "vamm"]):
            relevant.append("perpetual")

        # Staking
        if any(term in prompt_lower for term in ["lido", "steth", "liquid staking"]):
            relevant.append("lido")
        if any(term in prompt_lower for term in ["rocketpool", "reth"]):
            relevant.append("rocketpool")

        # Cross-chain
        if any(term in prompt_lower for term in ["stargate", "layerzero", "omnichain"]):
            relevant.append("stargate")
        if any(term in prompt_lower for term in ["across", "bridge"]):
            relevant.append("across")

        # Default to core protocols if none detected
        if not relevant:
            relevant = ["uniswap", "aave", "curve"]

        return relevant[:5]

    def _generate_cache_key(self, prompt: str) -> str:
        """Generate cache key for context"""
        hash_obj = hashlib.sha256(prompt.encode())
        return f"firecrawl_context:{hash_obj.hexdigest()}"

    def _chunk_context_intelligently(self, content: str, max_chars: int = MAX_CONTEXT_CHARS) -> str:
        """
        Smart context chunking on section boundaries

        Splits content on markdown sections and prioritizes:
        1. Keep complete sections
        2. Prefer recent/relevant sections
        3. Avoid cutting mid-sentence
        """
        if len(content) <= max_chars:
            return content

        sections = content.split("##")
        chunks = []
        current_size = 0

        for idx, section in enumerate(sections):
            section_size = len(section)

            if current_size + section_size > max_chars:
                if chunks:
                    break
                trimmed = section[:max_chars]
                last_period = trimmed.rfind(".")
                if last_period > max_chars * 0.8:
                    return trimmed[: last_period + 1]
                return trimmed

            chunks.append(section)
            current_size += section_size

        result = "##".join(chunks)
        logger.debug(f"Chunked context: {len(content)} chars → {len(result)} chars")
        return result

    async def fetch_context(self, prompt: str) -> str:
        """
        Fetch relevant documentation context for prompt

        Args:
            prompt: User's natural language request

        Returns:
            Markdown-formatted context string
        """
        cache_key = self._generate_cache_key(prompt)

        if self.redis_manager:
            cached_context = await self.redis_manager.get(cache_key)
            if cached_context:
                logger.info("Firecrawl context cache hit")
                return cached_context

        client = self._get_firecrawl_client()
        if not client:
            logger.warning("Firecrawl not available, returning empty context")
            return ""

        relevant_protocols = self._determine_relevant_protocols(prompt)
        all_content = []

        for protocol in relevant_protocols:
            urls = PROTOCOL_DOCS.get(protocol, [])
            for url in urls[:2]:
                try:
                    result = await self._scrape_url(client, url)
                    if result and result.get("markdown"):
                        all_content.append(f"## {protocol.upper()} Documentation\n\n{result['markdown']}")
                except Exception as e:
                    logger.warning(f"Failed to scrape {url}: {e}")

        default_docs = [
            "https://eips.ethereum.org/EIPS/eip-4337",
            "https://docs.openzeppelin.com/contracts",
        ]

        for url in default_docs:
            try:
                result = await self._scrape_url(client, url)
                if result and result.get("markdown"):
                    all_content.append(result["markdown"])
            except Exception as e:
                logger.warning(f"Failed to scrape {url}: {e}")

        context = self._chunk_context_intelligently("\n\n".join(all_content))

        if self.redis_manager:
            await self.redis_manager.set(cache_key, context, ttl=FIRECRAWL_CONTEXT_CACHE_TTL_SECONDS)
            logger.info(f"Firecrawl context cached with key: {cache_key}")

        return context

    async def _scrape_url(self, client, url: str) -> Optional[Dict[str, Any]]:
        """Scrape URL using Firecrawl"""
        try:
            import asyncio

            loop = asyncio.get_event_loop()
            result = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: client.scrape_url(
                        url,
                        params={
                            "formats": ["markdown"],
                            "includeTags": ["main", "article", "section"],
                        },
                    ),
                ),
                timeout=30.0,
            )
            return result
        except asyncio.TimeoutError:
            logger.warning(f"Firecrawl timeout for {url}")
            return None
        except Exception as e:
            logger.warning(f"Firecrawl scrape failed for {url}: {e}")
            return None

    async def search_semantic(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Semantic search for relevant documentation patterns

        Args:
            query: Search query
            top_k: Number of results to return

        Returns:
            List of relevant document chunks
        """
        if self.vector_store:
            return await self.vector_store.retrieve_similar(query, limit=top_k)
        return []

    async def generate_context(self, prompt: str) -> str:
        """
        Generate comprehensive RAG context for prompt

        Combines Firecrawl scraping with semantic search

        Args:
            prompt: User's natural language request

        Returns:
            Combined context string
        """
        firecrawl_context = await self.fetch_context(prompt)

        semantic_results = await self.search_semantic(prompt, top_k=3)

        context_parts = []

        if firecrawl_context:
            context_parts.append("## Latest Documentation\n\n" + firecrawl_context)

        if semantic_results:
            context_parts.append("## Similar Patterns\n\n")
            for result in semantic_results:
                context_parts.append(
                    f"### {result.get('name', 'Template')}\n{result.get('description', '')}\n"
                )

        return "\n\n".join(context_parts)
    
    def estimate_context_tokens(self, templates: List[str]) -> int:
        """
        Estimate tokens for RAG context (system prompt + templates)
        
        Uses rough estimate: 4 characters = 1 token
        This matches common tokenizer behavior for English text and code
        
        Args:
            templates: List of template strings or context chunks
        
        Returns:
            Estimated number of tokens
        """
        total_chars = sum(len(t) for t in templates)
        estimated_tokens = total_chars // 4
        
        logger.info(f"RAG context: {len(templates)} templates, ~{estimated_tokens} tokens")
        return estimated_tokens
    
    async def generate_context_with_metadata(self, prompt: str) -> Dict[str, Any]:
        """
        Generate RAG context with metadata including token estimates
        
        Args:
            prompt: User's natural language request
        
        Returns:
            Dictionary with context string and metadata
        """
        context = await self.generate_context(prompt)
        
        templates = [context]
        estimated_tokens = self.estimate_context_tokens(templates)
        
        return {
            "context": context,
            "estimated_tokens": estimated_tokens,
            "templates_count": 1,
            "character_count": len(context)
        }


