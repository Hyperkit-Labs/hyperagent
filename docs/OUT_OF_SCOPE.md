# Out of Scope (Phase 1 / MVP)

Items explicitly deferred for now. Not blockers for real users or production.

## Agents & Features

- **MonitorAgent** – Post-deployment monitoring; deferred until deploy flow is stable.
- **ERC8004 registries** – Agent identity and reputation; roadmap.
- **EigenDA anchoring** – Blob anchoring; roadmap.
- **MythX / Echidna** – Additional audit tools; Phase 1 uses Slither + Pashov; MythX/Echidna in later phases.
- **Multi-chain deploy** – Beyond MVP chain; chain adapters are modular but new chains added only after MVP path is stable.

## Infrastructure

- **Full E2E deploy flow** – Playwright E2E for deploy on testnet requires full stack + wallet; manual verification for now.
- **OpenTelemetry** – Optional; enable via `OPENTELEMETRY_ENABLED` when instrumentation is configured.
- **Circuit breaker** – Implemented for key external calls; full coverage is incremental.

## References

- `CLAUDE.md` – MVP scope and multi-chain roadmap
- `docs/control-plane-runs-steps.md` – Pipeline steps
- `docs/byok-and-run-flow.md` – BYOK flow
