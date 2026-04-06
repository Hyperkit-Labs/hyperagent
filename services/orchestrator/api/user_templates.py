"""User-owned contract templates: canonical JSON package, Pinata pin, DB index + CID pointer."""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import UTC, datetime
from typing import Any, Literal

import db
from fastapi import APIRouter, HTTPException, Request
from ipfs_client import STORAGE_STATUS_PINNED, canonical_ipfs_gateway_url
from ipfs_client import is_configured as ipfs_is_configured
from ipfs_client import pin_json
from pydantic import BaseModel, Field, field_validator

from .common import get_caller_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/user-templates", tags=["user-templates"])
artifacts_router = APIRouter(prefix="/api/v1/artifacts", tags=["artifacts"])

MAX_PACKAGE_BYTES = 2 * 1024 * 1024
SCHEMA_VERSION = "1"


class TemplateFile(BaseModel):
    path: str = Field(..., min_length=1, max_length=512)
    content: str = Field(..., max_length=1_500_000)
    language: str | None = Field(None, max_length=64)


class TemplatePackageV1(BaseModel):
    """Canonical template payload for IPFS (immutable per version)."""

    schema_version: Literal["1"] = "1"
    name: str = Field(..., min_length=1, max_length=256)
    description: str = Field("", max_length=8000)
    category: str = Field("", max_length=128)
    chain_compatibility: list[str] = Field(default_factory=list)
    files: list[TemplateFile] = Field(default_factory=list)
    contract_code: str | None = Field(None, max_length=2_000_000)
    frontend_scaffold: dict[str, Any] = Field(default_factory=dict)
    tests: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
    version: int = Field(1, ge=1)
    createdAt: str = Field("", max_length=64)
    updatedAt: str = Field("", max_length=64)

    @field_validator("files")
    @classmethod
    def _files_limit(cls, v: list[TemplateFile]) -> list[TemplateFile]:
        if len(v) > 200:
            raise ValueError("too many files (max 200)")
        return v


def _canonical_json_bytes(obj: Any) -> bytes:
    return json.dumps(
        obj,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=str,
    ).encode("utf-8")


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _assert_template_owner(row: dict[str, Any], request: Request) -> None:
    caller = get_caller_id(request)
    if not caller:
        raise HTTPException(status_code=401, detail="authentication required")
    if str(row.get("wallet_user_id") or "") != caller:
        raise HTTPException(status_code=403, detail="not allowed")


class CreateTemplateBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=512)
    description: str = ""
    category: str = ""
    project_id: str | None = None


@router.get("")
def list_my_templates(request: Request, limit: int = 50) -> dict[str, Any]:
    caller = get_caller_id(request)
    if not caller:
        raise HTTPException(status_code=401, detail="authentication required")
    rows = db.list_user_templates_for_wallet(caller, limit=limit)
    return {"templates": rows, "total": len(rows)}


@router.post("")
async def create_user_template(
    body: CreateTemplateBody, request: Request
) -> dict[str, Any]:
    caller = get_caller_id(request)
    if not caller:
        raise HTTPException(status_code=401, detail="authentication required")
    if not db.is_configured():
        raise HTTPException(status_code=503, detail="database not configured")
    proj: str | None = None
    if body.project_id and str(body.project_id).strip():
        p = str(body.project_id).strip()
        if db.is_uuid(p):
            proj = p
    row = db.insert_user_template(
        wallet_user_id=caller,
        name=body.name,
        description=body.description or None,
        category=body.category or None,
        project_id=proj,
    )
    if not row:
        raise HTTPException(status_code=500, detail="failed to create template")
    return {"id": row["id"], "status": row.get("status", "draft")}


class PublishVersionBody(BaseModel):
    """Full template package JSON (see TemplatePackageV1)."""

    content: dict[str, Any]


@router.post("/{template_id}/versions")
async def publish_template_version(
    template_id: str,
    body: PublishVersionBody,
    request: Request,
) -> dict[str, Any]:
    tpl = db.get_user_template(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="template not found")
    _assert_template_owner(tpl, request)

    raw = body.content
    raw_bytes = _canonical_json_bytes(raw)
    if len(raw_bytes) > MAX_PACKAGE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"payload too large (max {MAX_PACKAGE_BYTES} bytes)",
        )

    try:
        pkg = TemplatePackageV1.model_validate(raw)
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"invalid template package: {e}"
        ) from e

    canonical = pkg.model_dump(mode="json")
    canonical_bytes = _canonical_json_bytes(canonical)
    content_hash = sha256_hex(canonical_bytes)

    if not ipfs_is_configured():
        raise HTTPException(
            status_code=503,
            detail="IPFS storage not configured (STORAGE_SERVICE_URL / IPFS)",
        )

    ver_n = db.get_next_template_version_number(template_id)
    pin_name = f"hyperagent/user-template/{template_id}/v{ver_n}.json"
    cid = await pin_json(canonical, pin_name)
    if not cid:
        raise HTTPException(status_code=502, detail="pin to IPFS failed")

    gateway_url = canonical_ipfs_gateway_url(cid)
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "name": pkg.name,
        "version_number": ver_n,
        "content_hash": content_hash,
        "file_count": len(pkg.files),
        "pinned_at": datetime.now(UTC).isoformat(),
    }

    ver_row = db.insert_user_template_version(
        template_id=template_id,
        version_number=ver_n,
        content_hash=content_hash,
        cid=cid,
        gateway_url=gateway_url,
        pin_status="pinned",
        manifest=manifest,
        size_bytes=len(canonical_bytes),
    )
    if not ver_row:
        raise HTTPException(status_code=500, detail="failed to save version")

    vid = str(ver_row["id"])
    db.insert_user_template_storage_record(
        template_version_id=vid,
        cid=cid,
        gateway_url=gateway_url,
        status=STORAGE_STATUS_PINNED,
        content_hash=content_hash,
    )
    db.update_user_template_after_version(template_id, vid, status="pinned")

    return {
        "version_id": vid,
        "template_id": template_id,
        "version_number": ver_n,
        "cid": cid,
        "ipfs_url": gateway_url,
        "content_hash": content_hash,
        "pin_status": "pinned",
    }


@router.get("/{template_id}")
def get_user_template_summary(template_id: str, request: Request) -> dict[str, Any]:
    tpl = db.get_user_template(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="template not found")
    _assert_template_owner(tpl, request)
    current: dict[str, Any] | None = None
    cv = tpl.get("current_version_id")
    if cv:
        vrow = db.get_user_template_version(str(cv))
        if vrow:
            current = {
                "id": vrow["id"],
                "version_number": vrow.get("version_number"),
                "cid": vrow.get("cid"),
                "pin_status": vrow.get("pin_status"),
                "content_hash": vrow.get("content_hash"),
                "gateway_url": vrow.get("gateway_url"),
            }
    return {
        "id": tpl["id"],
        "name": tpl.get("name"),
        "description": tpl.get("description"),
        "category": tpl.get("category"),
        "status": tpl.get("status"),
        "current_version": current,
        "updated_at": tpl.get("updated_at"),
    }


@router.get("/{template_id}/versions/{version_id}")
def get_version_detail(
    template_id: str, version_id: str, request: Request
) -> dict[str, Any]:
    tpl = db.get_user_template(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="template not found")
    _assert_template_owner(tpl, request)
    vrow = db.get_user_template_version(version_id)
    if not vrow or str(vrow.get("template_id")) != template_id:
        raise HTTPException(status_code=404, detail="version not found")
    return {
        "id": vrow["id"],
        "template_id": template_id,
        "version_number": vrow.get("version_number"),
        "cid": vrow.get("cid"),
        "content_hash": vrow.get("content_hash"),
        "pin_status": vrow.get("pin_status"),
        "gateway_url": vrow.get("gateway_url"),
        "manifest": vrow.get("manifest"),
        "size_bytes": vrow.get("size_bytes"),
        "created_at": vrow.get("created_at"),
    }


@router.get("/{template_id}/versions/{version_id}/artifact")
async def get_version_artifact_meta(
    template_id: str, version_id: str, request: Request
) -> dict[str, Any]:
    tpl = db.get_user_template(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="template not found")
    _assert_template_owner(tpl, request)
    vrow = db.get_user_template_version(version_id)
    if not vrow or str(vrow.get("template_id")) != template_id:
        raise HTTPException(status_code=404, detail="version not found")
    cid = vrow.get("cid")
    gw = vrow.get("gateway_url") or (canonical_ipfs_gateway_url(cid) if cid else None)
    return {
        "cid": cid,
        "gateway_url": gw,
        "content_hash": vrow.get("content_hash"),
        "pin_status": vrow.get("pin_status"),
    }


@artifacts_router.get("/{cid}")
def lookup_artifact_by_cid(cid: str, request: Request) -> dict[str, Any]:
    """Resolve CID to template version metadata if caller owns the parent template."""
    caller = get_caller_id(request)
    if not caller:
        raise HTTPException(status_code=401, detail="authentication required")
    vrow = db.get_user_template_version_by_cid(cid)
    if not vrow:
        raise HTTPException(status_code=404, detail="unknown cid")
    tid = str(vrow.get("template_id") or "")
    tpl = db.get_user_template(tid)
    if not tpl or str(tpl.get("wallet_user_id")) != caller:
        raise HTTPException(status_code=403, detail="not allowed")
    return {
        "cid": cid,
        "template_id": tid,
        "version_id": vrow.get("id"),
        "version_number": vrow.get("version_number"),
        "content_hash": vrow.get("content_hash"),
        "pin_status": vrow.get("pin_status"),
        "gateway_url": vrow.get("gateway_url"),
    }


class FetchBody(BaseModel):
    validate_hash: str | None = None


@artifacts_router.post("/{cid}/fetch")
async def fetch_artifact_json(
    cid: str, body: FetchBody, request: Request
) -> dict[str, Any]:
    """Download JSON from gateway and optionally verify sha256(content) == validate_hash."""
    caller = get_caller_id(request)
    if not caller:
        raise HTTPException(status_code=401, detail="authentication required")
    vrow = db.get_user_template_version_by_cid(cid)
    if not vrow:
        raise HTTPException(status_code=404, detail="unknown cid")
    tpl = db.get_user_template(str(vrow.get("template_id") or ""))
    if not tpl or str(tpl.get("wallet_user_id")) != caller:
        raise HTTPException(status_code=403, detail="not allowed")
    url = vrow.get("gateway_url") or canonical_ipfs_gateway_url(cid)
    try:
        import httpx

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            r = await client.get(url)
            r.raise_for_status()
            raw = r.content
    except Exception as e:
        logger.warning("[user_templates] fetch cid=%s failed: %s", cid[:16], e)
        raise HTTPException(status_code=502, detail="gateway fetch failed") from e

    expect = body.validate_hash or vrow.get("content_hash")
    if expect:
        got = sha256_hex(raw)
        if got.lower() != str(expect).lower():
            raise HTTPException(status_code=409, detail="content hash mismatch")

    try:
        data = json.loads(raw.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=502, detail="response is not valid JSON")

    return {"cid": cid, "content": data}
