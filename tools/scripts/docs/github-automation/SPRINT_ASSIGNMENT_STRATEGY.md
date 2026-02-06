# Sprint Assignment Strategy (Phase 1 - Sprints 1-3)

This document outlines how issues are assigned to owners across Sprint 1, 2, and 3 to balance workload and leverage each owner's expertise.

## Sprint Distribution

### Sprint 1 (24 issues)
**Focus**: Foundation and core infrastructure

**@Tristan-T-Dev (Frontend Developer)** - ~3 issues
- Frontend shell & run view
- UI: New Project flow for Protocol Labs Verifiable Factory
- Frontend features

**@JustineDevs (CPOO/Product Lead)** - ~7 issues
- Orchestration & Data Model (Epic + features)
- Product-focused features

**@ArhonJay (CTO/Project Architect)** - ~14 issues
- Agent Implementations (Epic + all agent features)
- Protocol Labs Verifiable Factory preset
- SKALE Agentic Commerce preset
- Technical infrastructure

### Sprint 2 (17 issues)
**Focus**: Chain adapters, SDK, and observability

**@Tristan-T-Dev (Frontend Developer)** - ~2 issues
- Frontend features
- UI/UX improvements

**@JustineDevs (CPOO/Product Lead)** - ~6 issues
- Product/UX improvements
- Multi-tenant workspace setup

**@ArhonJay (CTO/Project Architect)** - ~9 issues
- BNB chain adapter & preset
- Avalanche chain adapter & preset
- SDK/CLI v0.1
- Observability & security v1

### Sprint 3 (16 issues)
**Focus**: Multi-tenant, template library, monorepo, CI/CD

**@Tristan-T-Dev (Frontend Developer)** - ~3 issues
- Template Library & Preset Registry (UI)
- New Project wizard surfacing all presets
- Frontend features

**@JustineDevs (CPOO/Product Lead)** - ~5 issues
- Multi-tenant workspaces & SaaS basics
- Template Library & Preset Registry (Epic)
- Product features

**@ArhonJay (CTO/Project Architect)** - ~8 issues
- Monorepo structure & submodules
- CI/CD & quality gates (Epic + implementation)
- Infrastructure improvements

## Assignment Rules by Sprint

### Sprint 1 Assignment Logic
- **Tristan-T-Dev**: Frontend
- **JustineDevs**: Orchestration, Epics
- **ArhonJay**: Agents, Chain-Adapter, Storage-RAG, Technical features
- **Default**: JustineDevs for unassigned areas

### Sprint 2 Assignment Logic
- **Tristan-T-Dev**: Frontend
- **JustineDevs**: Orchestration (multi-tenant prep)
- **ArhonJay**: Chain-Adapter, SDK-CLI, Observability, Security, Infra
- **Balanced**: More even distribution

### Sprint 3 Assignment Logic
- **Tristan-T-Dev**: Frontend, Template Registry (UI)
- **JustineDevs**: Multi-tenant, Template Registry (Epic)
- **ArhonJay**: Infra (CI/CD focus), Monorepo, Technical registry
- **Default**: Based on primary area focus

## Area-Based Assignment (All Sprints)

### Always @Tristan-T-Dev
- `frontend` - UI/UX, Frontend development, React/Next.js

### Always @JustineDevs
- `orchestration` - Product operations, workflow management
- `epic` - All epics (primary owner)

### Always @ArhonJay
- `agents` - Technical agent implementation
- `chain-adapter` - Smart contracts, deployment
- `contracts` - Solidity contract development
- `infra` - Infrastructure, DevOps, CI/CD
- `storage-rag` - Technical data systems
- `security` - Security architecture
- `observability` - Technical monitoring
- `sdk-cli` - Technical SDK development

## Cross-Review Strategy

All issues are cross-reviewed:
- Issues assigned to **@Tristan-T-Dev** → Reviewed by **@JustineDevs** (product lead)
- Issues assigned to **@JustineDevs** → Reviewed by **@ArhonJay**
- Issues assigned to **@ArhonJay** → Reviewed by **@JustineDevs**

This ensures:
- Technical validation for product features
- Product perspective on technical implementations
- Knowledge sharing across the team
- Quality assurance

## Workload Balance

| Sprint | Tristan-T-Dev | JustineDevs | ArhonJay | Total |
|--------|---------------|-------------|----------|-------|
| Sprint 1 | ~3 issues | ~7 issues | ~14 issues | 24 |
| Sprint 2 | ~2 issues | ~6 issues | ~9 issues | 17 |
| Sprint 3 | ~3 issues | ~5 issues | ~8 issues | 16 |
| **Total** | **~8 issues** | **~18 issues** | **~31 issues** | **57** |

## Customization

To modify assignment rules, edit the `_assign_owner()` method in `scripts/github/create_phase1_issues.py`:

```python
def _assign_owner(self, area: Optional[str], issue_type: str, sprint: Optional[str] = None) -> str:
    # Modify sprint-specific logic here
    # Adjust area assignments
    # Change default assignments
```

## Notes

- Epics are always assigned to @JustineDevs as primary owner
- Sprint-specific overrides allow for strategic workload distribution
- Area-based rules ensure expertise alignment
- Cross-review maintains quality and knowledge sharing

