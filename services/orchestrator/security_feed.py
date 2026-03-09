"""Security Feed: cron-compatible zero-day resilience.
Fetches recent exploit advisories from DeFiLlama (public API) and
injects them into the DesignAgent system prompt.

Run via: python security_feed.py (standalone) or import and call update_feed() from a scheduler."""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

import httpx

import rag_client

logger = logging.getLogger(__name__)

FEED_SOURCES: list[dict[str, str]] = [
    {"name": "defillama", "url": os.environ.get("DEFILLAMA_FEED_URL", "https://api.llama.fi/hacks")},
]

FEED_TIMEOUT = float(os.environ.get("SECURITY_FEED_TIMEOUT", "10"))
MAX_RECENT_EXPLOITS = int(os.environ.get("SECURITY_FEED_MAX_EXPLOITS", "5"))


async def fetch_recent_exploits() -> list[dict[str, Any]]:
    """Fetch recent exploit advisories from configured security feeds.
    Returns a list of exploit summaries with title, description, severity, and source."""
    exploits: list[dict[str, Any]] = []

    for source in FEED_SOURCES:
        url = source["url"].strip()
        if not url:
            continue
        try:
            async with httpx.AsyncClient(timeout=FEED_TIMEOUT) as client:
                r = await client.get(url)
                r.raise_for_status()
                data = r.json()
                items = data if isinstance(data, list) else data.get("exploits", data.get("items", []))
                ts_key = "date"
                if items and isinstance(items[0].get(ts_key), (int, float)):
                    items = sorted(items, key=lambda x: x.get(ts_key, 0), reverse=True)
                for item in items[:MAX_RECENT_EXPLOITS]:
                    title = item.get("title", item.get("name", ""))
                    desc = item.get("description", item.get("summary", ""))
                    if not desc and item.get("technique"):
                        desc = f"{item.get('technique', '')} | {item.get('classification', '')}".strip(" |")
                    url_val = item.get("url", item.get("source", ""))
                    date_val = item.get("date", datetime.now(timezone.utc).isoformat())
                    if isinstance(date_val, (int, float)):
                        date_val = datetime.fromtimestamp(date_val, tz=timezone.utc).isoformat()
                    exploits.append({
                        "source": source["name"],
                        "title": title,
                        "description": desc,
                        "severity": item.get("severity", "high"),
                        "date": date_val,
                        "url": url_val,
                    })
        except Exception as e:
            logger.warning("[security_feed] %s fetch failed: %s", source["name"], e)
            continue

    return exploits[:MAX_RECENT_EXPLOITS]


def format_threats_prompt(exploits: list[dict[str, Any]]) -> str:
    """Format exploits into a system prompt section for the DesignAgent."""
    if not exploits:
        return ""
    lines = ["Current Threats to Avoid (from recent on-chain exploits):"]
    for i, ex in enumerate(exploits, 1):
        lines.append(f"{i}. [{ex.get('severity', 'high').upper()}] {ex.get('title', 'Unknown')} ({ex.get('source', '')})")
        desc = ex.get("description", "")
        if desc:
            lines.append(f"   {desc[:200]}")
    return "\n".join(lines)


async def update_feed() -> dict[str, Any]:
    """Main cron entry point: fetch exploits and index them as linting rules in RAG.
    Returns summary of what was indexed."""
    exploits = await fetch_recent_exploits()
    indexed = 0

    for ex in exploits:
        ok = await rag_client.index_spec(
            spec_id=f"security-feed-{ex.get('source', 'unknown')}-{ex.get('title', '')[:30]}",
            spec={"type": "security_advisory", **ex},
            text=f"Security advisory: {ex.get('title', '')} - {ex.get('description', '')[:200]}",
            library_version="security-feed",
            status="verified",
        )
        if ok:
            indexed += 1

    logger.info("[security_feed] fetched=%d indexed=%d", len(exploits), indexed)
    return {
        "fetched": len(exploits),
        "indexed": indexed,
        "threats_prompt": format_threats_prompt(exploits),
    }


if __name__ == "__main__":
    import asyncio
    result = asyncio.run(update_feed())
    print(f"Security feed update: {result['fetched']} fetched, {result['indexed']} indexed")
    if result["threats_prompt"]:
        print("\n" + result["threats_prompt"])
