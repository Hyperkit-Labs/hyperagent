"""
HyperAgent Context Service
Long-term agent memory. Backend from MEMORY_BACKEND env (acontext | supabase | memory); set from registry at deploy.
Thin adapters: Acontext API, Supabase, or in-memory. One code path picks backend from config.
"""

import os
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="HyperAgent Context Service", version="0.1.0")

# Backend: MEMORY_BACKEND=acontext | supabase | memory (single source; inject from registry in deploy)
_supabase = None
_memory: list[dict] = []
_MEMORY_MAX_PER_USER = int(os.environ.get("CONTEXT_MAX_PER_USER", "200") or "200")

try:
    from acontext_adapter import is_configured as acontext_is_configured
except ImportError:
    acontext_is_configured = lambda: False


def _memory_backend() -> str:
    return (os.environ.get("MEMORY_BACKEND") or "supabase").strip().lower() or "supabase"


def _use_acontext() -> bool:
    return _memory_backend() == "acontext" and acontext_is_configured()


def _get_supabase():
    global _supabase
    if _supabase is not None:
        return _supabase
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if url and key:
        try:
            from supabase import create_client
            _supabase = create_client(url, key)
            return _supabase
        except Exception:
            pass
    return None


class StoreContextRequest(BaseModel):
    """user_id and wallet_user_id are the same (wallet_users.id) in wallet-native mode."""
    user_id: str | None = None
    wallet_user_id: str | None = None
    context_type: str = Field(..., description="conversation | learning | template | pattern")
    content: dict[str, Any]
    agent_name: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    embeddings: list[float] | None = None


class StoreContextResponse(BaseModel):
    id: str
    created_at: str


class SearchContextRequest(BaseModel):
    """user_id and wallet_user_id are the same (wallet_users.id) in wallet-native mode."""
    user_id: str | None = None
    wallet_user_id: str | None = None
    query: str | None = None
    context_type: str | None = None
    agent_name: str | None = None
    limit: int = Field(default=10, ge=1, le=100)


def _principal_id(req: StoreContextRequest | SearchContextRequest) -> str:
    """Resolve wallet_users.id from request. wallet_user_id preferred; user_id is alias."""
    wid = getattr(req, "wallet_user_id", None) or getattr(req, "user_id", None)
    if not wid:
        raise HTTPException(status_code=400, detail="wallet_user_id or user_id required")
    return wid


@app.post("/context", response_model=StoreContextResponse)
def store_context(req: StoreContextRequest) -> StoreContextResponse:
    if req.context_type not in ("conversation", "learning", "template", "pattern"):
        raise HTTPException(status_code=400, detail="context_type must be one of: conversation, learning, template, pattern")
    principal = _principal_id(req)
    if _use_acontext():
        try:
            from acontext_adapter import store_context as acontext_store  # noqa: PLC0415
            mid, created = acontext_store(
                principal,
                req.context_type,
                req.content,
                agent_name=req.agent_name,
                metadata=req.metadata,
            )
            return StoreContextResponse(id=mid, created_at=created)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Acontext store failed: {e!s}")
    sb = _get_supabase()
    if sb:
        row = {
            "wallet_user_id": principal,
            "context_type": req.context_type,
            "content": req.content,
            "agent_name": req.agent_name,
            "metadata": req.metadata,
        }
        if req.embeddings and len(req.embeddings) == 1536:
            row["embeddings"] = req.embeddings
        r = sb.table("agent_context").insert(row).execute()
        if not r.data or len(r.data) == 0:
            raise HTTPException(status_code=500, detail="Insert failed")
        rec = r.data[0]
        return StoreContextResponse(id=rec["id"], created_at=rec["created_at"])
    # In-memory fallback (bounded per user)
    _memory.append({
        "id": str(len(_memory)),
        "wallet_user_id": principal,
        "context_type": req.context_type,
        "content": req.content,
        "agent_name": req.agent_name,
        "metadata": req.metadata,
    })
    # Trim oldest entries for this user when exceeding limit
    user_items = [m for m in _memory if m.get("wallet_user_id") == principal]
    if len(user_items) > _MEMORY_MAX_PER_USER:
        to_remove = len(user_items) - _MEMORY_MAX_PER_USER
        for m in list(_memory):
            if to_remove <= 0:
                break
            if m.get("wallet_user_id") == principal:
                _memory.remove(m)
                to_remove -= 1
    rec = _memory[-1]
    return StoreContextResponse(id=rec["id"], created_at="")

@app.post("/context/search")
def search_context(req: SearchContextRequest) -> list[dict]:
    principal = _principal_id(req)
    if _use_acontext():
        try:
            from acontext_adapter import search_context as acontext_search  # noqa: PLC0415
            rows = acontext_search(
                principal,
                query=req.query,
                context_type=req.context_type,
                agent_name=req.agent_name,
                limit=req.limit,
            )
            return rows
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Acontext search failed: {e!s}")
    sb = _get_supabase()
    if sb:
        # Match wallet_user_id (SIWE) or user_id (legacy OAuth) for backward compat
        q = sb.table("agent_context").select("*").or_(f"wallet_user_id.eq.{principal},user_id.eq.{principal}").order("accessed_at", desc=True).limit(req.limit)
        if req.context_type:
            q = q.eq("context_type", req.context_type)
        if req.agent_name:
            q = q.eq("agent_name", req.agent_name)
        r = q.execute()
        return r.data or []
    # In-memory: filter by wallet_user_id and type
    out = [m for m in _memory if m.get("wallet_user_id") == principal]
    if req.context_type:
        out = [m for m in out if m.get("context_type") == req.context_type]
    return out[: req.limit]


@app.get("/health")
def health():
    return {"status": "ok"}
