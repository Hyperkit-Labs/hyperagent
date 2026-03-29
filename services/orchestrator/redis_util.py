"""TCP Redis URL for redis-py / LangGraph: REDIS_URL primary; legacy UPSTASH_REDIS_URL. Optional credential merge."""

from __future__ import annotations

import os
from urllib.parse import quote, urlparse, urlunparse


def _raw_tcp_url(url: str | None = None) -> str:
    if url is not None:
        return url.strip()
    return (os.environ.get("REDIS_URL") or os.environ.get("UPSTASH_REDIS_URL") or "").strip()


def effective_redis_url(url: str | None = None) -> str:
    """
    Return URL suitable for redis.from_url / RedisSaver.

    If the URL already contains credentials (userinfo before @), it is returned unchanged.
    Otherwise REDIS_PASSWORD / UPSTASH_REDIS_PASSWORD (and optional *_USERNAME) are injected.
    """
    raw = _raw_tcp_url(url)
    if not raw or raw.startswith("#"):
        return raw
    password = (os.environ.get("REDIS_PASSWORD") or os.environ.get("UPSTASH_REDIS_PASSWORD") or "").strip()
    username = (os.environ.get("REDIS_USERNAME") or os.environ.get("UPSTASH_REDIS_USERNAME") or "").strip()
    if not password and not username:
        return raw
    try:
        parsed = urlparse(raw)
    except Exception:
        return raw
    if parsed.username is not None or parsed.password is not None:
        return raw
    host = parsed.hostname or "localhost"
    port = f":{parsed.port}" if parsed.port else ""
    if username:
        userinfo = f"{quote(username, safe='')}:{quote(password, safe='')}"
    else:
        userinfo = f":{quote(password, safe='')}"
    netloc = f"{userinfo}@{host}{port}"
    return urlunparse((parsed.scheme, netloc, parsed.path or "", parsed.params, parsed.query, parsed.fragment))
