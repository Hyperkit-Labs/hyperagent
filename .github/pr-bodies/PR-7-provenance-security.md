# Pull Request

---

## Title / Naming convention

**services: provenance and advanced security — EigenDA, ERC-8004, Echidna, exploit-sim policy**

---

## Context / Description

**What** does this PR change, and **why**?

- Implements real EigenDA anchoring for trace/artifact provenance (audit: EigenDA referenced in docs/schema but zero implementation; registries return only `ipfs` or `none`).
- Implements ERC-8004 agent identity registration if in product scope (audit: registry entries exist but no on-chain interaction).
- Replaces Echidna "run separately" stub with integrated fuzzing execution and result ingestion (audit: Echidna listed as missing).
- Keeps exploit simulation policy truthful: fail-closed defaults plus real coverage for supported/unsupported contract types (audit: misleading pass/fail flagged).

---

## Related issues / tickets

- **Related** Full-completion implementation outline (Workstream 7: Provenance and advanced security)
- **Related** 0-ORDERED-CHECKLIST.md
- **Related** infra/registries/orchestrator.yaml, infra/registries/erc8004/

---

## Type of change

- [x] **Feature** (provenance, advanced security)

---

## How to test

1. Run pipeline with EigenDA configured; verify da_cert/reference_block populated
2. Verify ERC-8004 registration flow if in scope
3. Run audit with Echidna; verify fuzzing results ingested
4. Run exploit simulation on supported/unsupported contract types; verify truthful partial coverage

**Special setup / config:** EIGENDA_*, ERC-8004 registry, Echidna binary, Tenderly

---

## Author checklist (before requesting review)

- [ ] Code follows the project's style guidelines
- [ ] Unit tests added or updated
- [ ] Documentation updated
- [ ] Changes tested locally
- [ ] No secrets or `.env` in the diff
- [ ] CI passes

---

## Additional notes

- **Scope:** No missing EigenDA/ERC-8004/Echidna scope if they remain promised per audit strict pass rule.
- **Exploit-sim:** Unsupported contract types must show partial coverage honestly; required types fail closed.
