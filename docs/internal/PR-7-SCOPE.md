# PR-7: Provenance and advanced security

**Status:** Scope defined; implementation pending.

## Must be complete to claim full-plan coverage

- [ ] EigenDA anchoring for trace/artifact provenance (da_cert, reference_block populated)
- [ ] ERC-8004 agent identity registration (if in product scope)
- [ ] Echidna fuzzing integrated (execution + result ingestion)
- [ ] Exploit simulation policy truthful (fail-closed + real coverage for supported/unsupported types)

## Implementation notes

- **EigenDA:** `infra/registries/orchestrator.yaml` da_backend; currently returns `ipfs` or `none`
- **ERC-8004:** `infra/registries/erc8004/`; registry entries exist; no on-chain interaction yet
- **Echidna:** Audit agent; add fuzzing execution and result ingestion
- **Exploit-sim:** `services/orchestrator/security/evaluator.py`; policy loader; contract-type awareness

## References

- 0-ORDERED-CHECKLIST.md
- Full-completion implementation outline (Workstream 7)
