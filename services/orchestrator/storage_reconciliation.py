"""Periodic reconciliation for IPFS storage_records: re-verify gateway retrieval, advance status."""

from __future__ import annotations

import json
import logging
import os
from datetime import UTC, datetime
from typing import Any

import db
import observability
from filecoin_client import (
    STORAGE_STATUS_DEAL_PENDING,
    deal_status_summary_from_payload,
    fetch_lighthouse_deal_status_sync,
    should_mark_filecoin_archived,
)
from ipfs_client import (
    STORAGE_STATUS_ARCHIVED,
    STORAGE_STATUS_FAILED,
    STORAGE_STATUS_PINNED,
    canonical_ipfs_gateway_url,
    _verify_gateway_retrieval_sync,
    _verify_strict,
)

logger = logging.getLogger(__name__)


def _reconcile_filecoin_deal_rows(limit: int) -> dict[str, int]:
    """Poll Lighthouse deal_status for filecoin rows still deal_pending."""
    out = {"examined": 0, "updated": 0}
    rows = db.list_storage_records_for_filecoin_deal_poll(limit=limit)
    for row in rows:
        out["examined"] += 1
        rid = row.get("id")
        cid = (row.get("cid") or "").strip()
        if not rid or not cid:
            continue
        try:
            snap = fetch_lighthouse_deal_status_sync(cid)
        except Exception as e:
            logger.debug("[storage_reconcile] filecoin deal_status fetch failed: %s", e)
            continue
        merged = db.merge_metadata_dict(
            row.get("metadata"),
            {
                "deal_status_poll_at": datetime.now(UTC).isoformat(),
                "deal_status_snapshot": snap,
                "deal_status_summary": deal_status_summary_from_payload(snap),
            },
        )
        new_status = (
            STORAGE_STATUS_ARCHIVED
            if should_mark_filecoin_archived(snap)
            else STORAGE_STATUS_DEAL_PENDING
        )
        if db.patch_storage_record(
            str(rid), {"status": new_status, "metadata": merged}
        ):
            out["updated"] += 1
            observability.inc_storage_filecoin_deal_poll_updated()
    return out


def run_storage_reconciliation_pass(limit: int = 50) -> dict[str, Any]:
    """
    Re-HEAD gateway URLs for rows stuck in pinned/failed; set reconciled or failed.
    Poll Lighthouse for Filecoin deal rows. Intended for STORAGE_RECONCILE_INTERVAL_SEC.
    """
    rows = db.list_storage_records_for_reconciliation(limit=limit)
    stats = {"examined": 0, "reconciled": 0, "still_pinned": 0, "marked_failed": 0}
    for row in rows:
        stats["examined"] += 1
        rid = row.get("id")
        cid = (row.get("cid") or "").strip()
        if not rid or not cid:
            continue
        gateway_url = (
            row.get("gateway_url") or ""
        ).strip() or canonical_ipfs_gateway_url(cid)
        ok = _verify_gateway_retrieval_sync(gateway_url)
        attempts = 0
        meta = row.get("metadata")
        if isinstance(meta, dict):
            attempts = int(meta.get("verify_attempts") or 0)
        elif isinstance(meta, str):
            try:
                attempts = int(json.loads(meta).get("verify_attempts") or 0)
            except Exception:
                attempts = 0
        attempts += 1
        patch_meta = {
            "verify_attempts": attempts,
            "last_reconcile_at": datetime.now(UTC).isoformat(),
        }

        if ok:
            merged = db.merge_metadata_dict(row.get("metadata"), patch_meta)
            merged["reconcile_source"] = "gateway_head"
            if db.patch_storage_record(
                str(rid),
                {"status": STORAGE_STATUS_RECONCILED, "metadata": merged},
            ):
                stats["reconciled"] += 1
        else:
            merged = db.merge_metadata_dict(row.get("metadata"), patch_meta)
            merged["reconcile_source"] = "gateway_head"
            if _verify_strict() and attempts >= int(
                os.environ.get("STORAGE_RECONCILE_MAX_ATTEMPTS", "5")
            ):
                if db.patch_storage_record(
                    str(rid),
                    {"status": STORAGE_STATUS_FAILED, "metadata": merged},
                ):
                    stats["marked_failed"] += 1
            else:
                merged["last_verify_error"] = "gateway_head_failed"
                if db.patch_storage_record(
                    str(rid),
                    {"status": STORAGE_STATUS_PINNED, "metadata": merged},
                ):
                    stats["still_pinned"] += 1

    if stats["examined"]:
        logger.info("[storage_reconcile] ipfs gateway pass complete: %s", stats)
    observability.add_storage_reconcile_stats(
        stats["examined"],
        stats["reconciled"],
        stats["still_pinned"],
        stats["marked_failed"],
    )

    fc_limit = max(1, min(limit // 2, 25))
    fc_stats = _reconcile_filecoin_deal_rows(fc_limit)
    if fc_stats["examined"]:
        logger.info("[storage_reconcile] filecoin deal poll: %s", fc_stats)

    stats["filecoin_examined"] = fc_stats["examined"]
    stats["filecoin_updated"] = fc_stats["updated"]
    return stats
