"""Correlate findings across tools: same-issue matching, corroboration.
Pashov blocks only when corroborated by deterministic tools."""

from __future__ import annotations

from typing import Any

DETERMINISTIC_TOOLS = frozenset({"slither", "mythril", "echidna", "tenderly", "scrubd"})


def _normalize_for_match(s: Any) -> str:
    return str(s or "").strip().lower().replace("-", "").replace("_", "")


def _same_issue_match(
    a: dict[str, Any],
    b: dict[str, Any],
    match_on: list[str],
) -> bool:
    """True if findings a and b refer to the same issue per match_on fields."""
    for key in match_on:
        ak = _normalize_for_match(a.get(key))
        bk = _normalize_for_match(b.get(key))
        if ak and bk and (ak in bk or bk in ak):
            return True
        if ak and bk and ak == bk:
            return True
    return False


def correlate_findings(
    findings: list[dict[str, Any]],
    match_on: list[str] | None = None,
    corroborated_threshold: int = 2,
    ai_requires_deterministic: bool = True,
) -> list[dict[str, Any]]:
    """Deduplicate and correlate findings. Mark corroboratedBy for Pashov when
    a deterministic tool reports the same issue."""
    if match_on is None:
        match_on = ["file", "contract", "function", "swc_id", "swcId", "normalized_title", "title"]

    out: list[dict[str, Any]] = []
    for f in findings:
        f = dict(f)
        tool = (f.get("tool") or "").lower()
        corroborated: list[str] = list(f.get("corroboratedBy") or [])

        for other in findings:
            if other is f:
                continue
            otool = (other.get("tool") or "").lower()
            if tool == "pashov" and otool in DETERMINISTIC_TOOLS:
                if _same_issue_match(f, other, match_on):
                    if otool not in corroborated:
                        corroborated.append(otool)
            elif tool != "pashov" and otool == "pashov":
                if _same_issue_match(f, other, match_on):
                    other_corr = list(other.get("corroboratedBy") or [])
                    if tool not in other_corr:
                        other_corr.append(tool)
                    for o in out:
                        if o.get("id") == other.get("id"):
                            o["corroboratedBy"] = other_corr
                            break

        f["corroboratedBy"] = corroborated
        if tool == "pashov" and ai_requires_deterministic:
            f["blocking"] = len(corroborated) >= 1 and f.get("blocking", False)
        out.append(f)

    return out
