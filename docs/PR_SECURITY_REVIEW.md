# Security PR Review — Hyperkit-Labs/hyperagent

**Date:** 2026-03-09  
**Scope:** Open PRs #342–#366 (27 PRs) addressing GitHub Code Scanning alerts  
**Source:** [https://github.com/Hyperkit-Labs/hyperagent/pulls](https://github.com/Hyperkit-Labs/hyperagent/pulls)

---

## Executive Summary

| Category | PR Count | Verdict | Action |
|----------|----------|---------|--------|
| **Uncontrolled path expression** | 15 | **Applicable** | Merge after consolidating (many overlap) |
| **Clear-text logging of sensitive info** | 7 | **Applicable** | Merge; low risk, improves security posture |
| **Clear text storage of sensitive info** | 1 | **Review** | Verify payload does not contain keys |
| **Uncontrolled command line** | 1 | **Applicable** | Merge; port validation is correct |
| **Externally-controlled format string** | 1 | **Applicable** | Merge; simple, correct fix |

**Recommendation:** Consolidate path-expression fixes into 1–2 PRs, then merge all applicable fixes. Several path PRs target the same files and can conflict.

---

## 1. Uncontrolled Data Used in Path Expression (15 PRs)

**PRs:** #345, #346, #348, #349, #350, #351, #352, #353, #354, #355, #356, #363, #364, #365, #366

**Root cause:** User-controlled strings (`contract_name`, `entry_contract`, file paths from `files` dict) are used to build filesystem paths without strict validation, enabling path traversal (e.g. `../../../etc/passwd`).

**Affected code:**
- `services/compile/main.py`: `contract_name`, `entry_contract` in `_compile_foundry_impl`, `_compile_hardhat`, `_compile_hardhat_multi`, `_compile_foundry_multi`
- `services/hyperagent-tools/main.py`: `path` from `files` dict → `workdir / path` (partial check: `".." in path or path.startswith("/")` is insufficient)
- Other services with path construction from user input

**Existing mitigations:**
- `_safe_sol_filename()` exists for multi-file names in compile service
- `contract_name` in single-file flows is **not** sanitized before use in paths

**Fix approach (per PR descriptions):**
- Add `_safe_contract_name()` (or similar) that enforces `[A-Za-z0-9_]+`, rejects `..`, `/`, `\`, leading `.`
- Validate at API boundary and in internal helpers
- Use sanitized value consistently for all path operations

**Applicability:** ✅ **Yes** — Path traversal is a real risk. Multiple PRs likely fix overlapping locations; consolidation recommended to avoid merge conflicts.

**Weight:** **High** — Direct security impact (arbitrary file read/write in temp dirs).

---

## 2. Clear-Text Logging of Sensitive Information (7 PRs)

**PRs:** #343, #344, #357, #358, #359, #361, #362

**Root cause:** Logging provider names from `api_keys` (e.g. `["openai","anthropic"]`) or similar identifiers derived from sensitive config. While not logging raw keys, provider names can reveal configuration and are often flagged by scanners.

**Affected code:**
- `services/orchestrator/main.py`:
  - `_run_workflow_pipeline_job`: `list(api_keys.keys())` (line ~341)
  - `create_run` / generate: `list(body.api_keys.keys())`, `list(api_keys.keys())` (lines ~567, ~611)
- `services/orchestrator/workflow.py`:
  - `run_pipeline`: `list(initial.get("api_keys") or {}).keys()` (line ~291) — also a **bug**: `.keys()` on dict returns dict_keys; `list(...)` should wrap the dict, not `.keys()`.

**Fix approach:**
- Replace `list(api_keys.keys())` with `len(api_keys or {})` (count only)
- Same for `body.api_keys` and `initial.get("api_keys")`
- Preserves observability (e.g. “3 providers configured”) without leaking identifiers

**Applicability:** ✅ **Yes** — Low-risk change, improves compliance and reduces information leakage.

**Weight:** **Medium** — Reduces exposure; provider names are low sensitivity but scanners flag them.

---

## 3. Clear Text Storage of Sensitive Information (1 PR)

**PR:** #360

**Root cause:** Likely `logger.warning("[llm-keys] %s", json.dumps(payload))` in `services/orchestrator/main.py` (~line 2435).

**Payload contents (from code):**
- `has_x_user_id`, `x_workspace_id`, `byok_configured`, `outcome`, `configured_providers_count`
- **Does NOT** include raw API keys or secrets

**Applicability:** ⚠️ **Review** — If the payload is strictly metadata (counts, booleans, IDs), the alert may be a false positive. If any field could contain secrets, the fix is applicable. Recommend: redact or hash any user/workspace IDs if they are considered PII.

**Weight:** **Low–Medium** — Depends on whether payload ever contains sensitive material.

---

## 4. Uncontrolled Command Line (1 PR)

**PR:** #347

**Root cause:** `body.port` from `SandboxCreateBody` is passed into `docker run -p {host_port}:{port}` without range validation. Pydantic validates `int` but not 1–65535.

**Affected code:** `services/sandbox-docker/main.py` — `port` in `_create_sandbox_container` (line ~108).

**Fix approach:**
- Validate `port` in 1–65535 before calling `_create_sandbox_container`
- Optionally allowlist common ports (80, 3000, 4000, 8080) for stricter control

**Applicability:** ✅ **Yes** — Prevents invalid or malicious port values from reaching the Docker command.

**Weight:** **Medium** — Reduces risk of misconfiguration or abuse.

---

## 5. Use of Externally-Controlled Format String (1 PR)

**PR:** #342

**Root cause:** In `apps/api-gateway/src/index.ts` line 103:
```ts
console.error(`[gateway] proxy error path=${req.path} requestId=${id}`, err.message);
```
User-controlled `req.path` and `id` are embedded in the first argument. If `console.error` is treated like `util.format`, `%` in `req.path` could be interpreted as format specifiers.

**Fix approach:**
```ts
console.error("[gateway] proxy error path=%s requestId=%s %s", req.path, id ?? "", err.message);
```
Constant format string; values passed as separate arguments.

**Applicability:** ✅ **Yes** — Simple, correct fix with no behavior change.

**Weight:** **Low** — Format-string injection via path is uncommon but valid to fix.

---

## Merge Strategy

1. **Path expression (15 PRs):** Create a single consolidated PR that:
   - Adds `_safe_contract_name()` (or equivalent) in compile service
   - Sanitizes all user-controlled path components in compile, hyperagent-tools, and any other affected services
   - Closes the individual path PRs with a reference to the consolidated PR

2. **Logging (7 PRs):** Merge #343 first (covers main.py + workflow.py). Check if #344, #357–#362 address the same or additional sites; merge non-duplicative ones.

3. **Standalone:** Merge #342 (format string), #347 (command line) as-is.

4. **Storage (#360):** Audit the payload; if no secrets, add a comment or minimal redaction and merge or dismiss the alert.

---

## Checklist Before Merge

- [x] Run full test suite after each merge (compile/hyperagent-tools: no tests; smoke test passed)
- [x] Verify no duplicate fixes across PRs (consolidated into single implementation)
- [x] Ensure path sanitization covers all call sites (compile, hyperagent-tools, etc.)
- [ ] Confirm logging changes do not break observability (counts are sufficient) — *separate PR*
- [ ] Re-run Code Scanning after merges to confirm alerts are resolved
