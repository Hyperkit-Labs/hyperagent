"""Infrastructure routes for domains and other workspace-owned infra resources."""

from __future__ import annotations

import re
from typing import Any

import db
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from .common import get_caller_id

router = APIRouter(prefix="/api/v1/infra", tags=["infra"])

_DOMAIN_LABEL = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")


def _normalize_domain(value: str) -> str:
    return value.strip().lower().rstrip(".")


def _validate_domain(value: str) -> str:
    domain = _normalize_domain(value)
    if not domain:
        raise HTTPException(status_code=400, detail="domain is required")
    if len(domain) > 253:
        raise HTTPException(
            status_code=400,
            detail="domain must be 253 characters or fewer",
        )
    if "://" in domain or "/" in domain or "@" in domain:
        raise HTTPException(
            status_code=400,
            detail="domain must be a hostname such as example.com",
        )
    labels = domain.split(".")
    if len(labels) < 2:
        raise HTTPException(
            status_code=400,
            detail="domain must be fully qualified",
        )
    for label in labels:
        if not _DOMAIN_LABEL.fullmatch(label):
            raise HTTPException(
                status_code=400,
                detail=f"invalid domain label: {label}",
            )
    return domain


class AddDomainBody(BaseModel):
    domain: str = Field(..., min_length=1, max_length=253)
    project_id: str | None = None


@router.get("/domains")
def list_domains(request: Request, limit: int = 100) -> list[dict[str, Any]]:
    caller = get_caller_id(request)
    if not caller:
        raise HTTPException(status_code=401, detail="authentication required")
    if not db.is_configured():
        raise HTTPException(status_code=503, detail="database not configured")
    return db.list_custom_domains_for_wallet(caller, limit=limit)


@router.post("/domains")
def add_domain(body: AddDomainBody, request: Request) -> dict[str, Any]:
    caller = get_caller_id(request)
    if not caller:
        raise HTTPException(status_code=401, detail="authentication required")
    if not db.is_configured():
        raise HTTPException(status_code=503, detail="database not configured")

    domain = _validate_domain(body.domain)
    existing = db.get_custom_domain_for_wallet(caller, domain)
    if existing:
        raise HTTPException(status_code=409, detail="domain already exists")

    created = db.insert_custom_domain(
        wallet_user_id=caller,
        domain=domain,
        project_id=body.project_id,
    )
    if not created:
        raise HTTPException(status_code=500, detail="failed to create domain")
    return created
