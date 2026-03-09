"""
Embedding: OpenAI when OPENAI_API_KEY set. Vector size 1536.
"""
from __future__ import annotations

import os

def embed(text: str) -> list[float] | None:
    """Return 1536-dim embedding for text, or None if not configured."""
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        return None
    try:
        from openai import OpenAI
        client = OpenAI(api_key=key)
        r = client.embeddings.create(
            model=os.environ.get("EMBED_MODEL", "text-embedding-3-small"),
            input=text[:8192],
        )
        return r.data[0].embedding
    except Exception:
        return None
