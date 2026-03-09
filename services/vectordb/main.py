"""
HyperAgent VectorDB Service
Qdrant collections (specs, templates); index and RAG query. Port 8010.
Set QDRANT_URL and OPENAI_API_KEY for full flow. When not set, endpoints no-op or return empty.
"""
from __future__ import annotations

import json
import os
import uuid

from fastapi import FastAPI
from pydantic import BaseModel, Field

from embed import embed
from qdrant_client import is_configured, upsert, query, COLLECTION_SPECS, COLLECTION_TEMPLATES

app = FastAPI(title="HyperAgent VectorDB", version="0.1.0")


class IndexSpecBody(BaseModel):
    spec_id: str | None = None
    spec: dict = Field(default_factory=dict)
    text: str | None = None
    metadata: dict | None = None


class IndexTemplateBody(BaseModel):
    template_id: str | None = None
    template: dict = Field(default_factory=dict)
    text: str | None = None


class QueryBody(BaseModel):
    query: str = Field(..., min_length=1)
    collection: str = Field("specs", pattern="^(specs|templates)$")
    limit: int = Field(10, ge=1, le=50)
    metadata_filter: dict | None = None


@app.post("/index/spec")
def index_spec(body: IndexSpecBody) -> dict:
    """Index a spec: embed text (or JSON string of spec) and upsert to Qdrant collection 'specs'."""
    text = body.text or json.dumps(body.spec)[:8192]
    vector = embed(text)
    if not vector or len(vector) != 1536:
        return {"ok": False, "reason": "embedding not available (set OPENAI_API_KEY and QDRANT_URL)"}
    id = body.spec_id or str(uuid.uuid4())
    payload: dict = {"spec_id": id, "text_preview": text[:200]}
    meta = dict(body.metadata or {})
    if body.spec and "type" in body.spec:
        meta["type"] = body.spec["type"]
    else:
        meta.setdefault("type", "spec")
    payload.update(meta)
    ok = upsert(COLLECTION_SPECS, id, vector, payload)
    return {"ok": ok, "id": id}


@app.post("/index/template")
def index_template(body: IndexTemplateBody) -> dict:
    """Index a template: embed text (or JSON string of template) and upsert to Qdrant collection 'templates'."""
    text = body.text or json.dumps(body.template)[:8192]
    vector = embed(text)
    if not vector or len(vector) != 1536:
        return {"ok": False, "reason": "embedding not available (set OPENAI_API_KEY and QDRANT_URL)"}
    id = body.template_id or str(uuid.uuid4())
    ok = upsert(COLLECTION_TEMPLATES, id, vector, {"template_id": id, "text_preview": text[:200]})
    return {"ok": ok, "id": id}


@app.post("/query")
def rag_query(body: QueryBody) -> dict:
    """RAG: embed query and search collection; return list of {id, score, payload}."""
    vector = embed(body.query)
    if not vector:
        return {"results": [], "reason": "embedding not available"}
    results = query(body.collection, vector, limit=body.limit, metadata_filter=body.metadata_filter)
    return {"results": results}


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "qdrant_configured": is_configured()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8010")))
