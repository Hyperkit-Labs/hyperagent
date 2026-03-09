"""SCV-1-2000 sync: load Smart Contract Vulnerability Dataset from Hugging Face into RAG.
Run weekly via cron: 0 0 * * 0 (Sunday midnight).
Set SCV_SYNC_ENABLED=true to enable."""
from __future__ import annotations

import asyncio
import logging
import os

logger = logging.getLogger(__name__)

SCV_SYNC_ENABLED = os.environ.get("SCV_SYNC_ENABLED", "false").strip().lower() in ("1", "true", "yes")
SCV_DATASET = "darkknight25/Smart_Contract_Vulnerability_Dataset"
SCV_LIBRARY_VERSION = "scv-2025"


async def sync_scv_dataset() -> int:
    """Load SCV dataset from Hugging Face and index into vectordb via rag_client.
    Returns count of indexed patterns."""
    if not SCV_SYNC_ENABLED:
        logger.info("[scv_sync] SCV_SYNC_ENABLED=false, skipping")
        return 0

    try:
        from datasets import load_dataset
    except ImportError:
        logger.error("[scv_sync] datasets package required: pip install datasets")
        return 0

    import rag_client
    if not rag_client.is_configured():
        logger.warning("[scv_sync] VECTORDB_URL not configured, skipping")
        return 0

    count = 0
    try:
        ds = load_dataset(SCV_DATASET, split="train", trust_remote_code=True)
    except Exception as e:
        logger.error("[scv_sync] load_dataset failed: %s", e)
        return 0

    columns = ds.column_names if hasattr(ds, "column_names") else []
    for i, row in enumerate(ds):
        try:
            row_dict = row if isinstance(row, dict) else dict(zip(columns, row))
            spec_id = f"scv-{row_dict.get('id', i)}"
            category = str(row_dict.get("category", row_dict.get("label", row_dict.get("vulnerability_type", ""))))
            severity = str(row_dict.get("severity", "medium")).lower()
            code = str(row_dict.get("source_code", row_dict.get("code", row_dict.get("code_snippet", ""))))
            desc = str(row_dict.get("description", row_dict.get("vul", "")))
            text = f"{category} {severity} {desc} {code[:500]}".strip()

            spec = {
                "type": "scv_pattern",
                "category": category,
                "severity": severity,
                "description": desc[:500] if desc else "",
            }
            ok = await rag_client.index_spec(
                spec_id=spec_id,
                spec=spec,
                text=text,
                library_version=SCV_LIBRARY_VERSION,
                status="verified",
            )
            if ok:
                count += 1
            if (i + 1) % 100 == 0:
                logger.info("[scv_sync] indexed %d/%d", count, i + 1)
        except Exception as e:
            logger.warning("[scv_sync] row %d failed: %s", i, e)
            continue

    logger.info("[scv_sync] completed: %d patterns indexed", count)
    return count


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(sync_scv_dataset())
