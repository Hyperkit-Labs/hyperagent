# Develop Branch Refactoring Plan - Phase 1-3 Alignment

**Date:** 2026-02-06  
**Status:** 🚧 Planning Phase  
**Branch:** `develop`

---

## Overview

Refactor the entire `develop` branch to align with **Phase 1 Foundation (Q1 2026)** requirements covering **Sprints 1-3**.

## Current Status

✅ **Completed:**
- Switched to `develop` branch
- Copied entire `.cursor/*` directory (136 files)
- Copied entire `k8s/*` directory (18 files)
- Total: 155 files staged and ready

## Phase 1 Foundation - Sprint Breakdown

### Sprint 1 (Feb 5–17) - Core Foundation
**Epics:**
1. **Core Orchestration & Data Model**
   - Supabase schema for workspaces, projects, runs, artefacts
   - FastAPI API gateway skeleton (auth, multi-tenant routing, rate limiting)
   - LangGraph-based orchestrator service
   - Redis worker pool for agent execution

2. **Agent Implementations v0**
   - SpecAgent with RAG over Solidity/security docs
   - CodeGenAgent with composite model routing
   - AuditAgent wiring Slither/Mythril/MythX/Echidna
   - DeployAgent using Hardhat/Foundry and Thirdweb
   - MonitorAgent stub integrating Tenderly and OpenTelemetry

3. **Protocol Labs Verifiable Factory Preset**
   - IPFS/Filecoin storage-service for artefacts
   - EigenDA v0 integration for verifiable traces
   - VerifiableFactory preset configuration

4. **SKALE Agentic Commerce Preset with x402**
   - SKALE chain adapter in deploy-service
   - TS SDK with x402Client
   - SKALE Agentic Commerce preset and template

5. **Frontend Shell & Run View**
   - Next.js/React/Tailwind app shell with auth
   - Run Pipeline UI with stage status and artefact links

### Sprint 2 (Feb 18–Mar 2) - Chain Adapters & SDK
**Epics:**
1. **BNB Chain Adapter & Infra Preset**
   - BNB chain config and adapter
   - BNB OZ-based templates (ERC20, staking, simple DeFi)
   - BNB Infra Starter preset

2. **Avalanche Chain Adapter & Infra Preset**
   - Avalanche chain config and adapter
   - Avalanche game/infra templates
   - Avalanche Build Games preset

3. **SDK/CLI v0.1**
   - TS SDK core functions (createWorkspace, createProject, runPipeline, getRunStatus, listArtefacts)
   - hyperagent CLI (init/run/deploy) using SDK
   - Publish SDK to npm

4. **Observability & Security v1**
   - OpenTelemetry traces and metrics
   - MLflow for model routing experiments
   - Basic prompt-injection guardrails

### Sprint 3 (Mar 3–16) - Multi-Tenant & Production Ready
**Epics:**
1. **Multi-Tenant Workspaces & SaaS Basics**
   - Multi-tenant workspace model in Supabase (RLS, scoping)
   - Workspace-level quotas and limits
   - Auth0/JWT and per-workspace rate limiting

2. **Template Library & Preset Registry**
   - configs/presets.yaml registry
   - Orchestrator to load graphs/templates by presetId
   - New Project wizard surfacing all presets

3. **Monorepo Structure & Submodules**
   - Organize repo into apps/, services/, contracts/, packages/, external/
   - Configure git submodules (OZ, forge-std, erc4626-tests)

4. **CI/CD & Quality Gates**
   - PR CI workflow (lint, tests, contract checks, static analysis)
   - Release workflow (build Docker images, deploy to staging)
   - Canary deployments and basic SLOs

## Refactoring Strategy

### 1. Directory Structure Alignment

**Current Structure → Target Structure:**

```
Current:
├── hyperagent/          # Backend
├── frontend/           # Frontend
├── services/           # Microservices
├── templates/          # Contract templates
└── tests/              # Tests

Target (Sprint 3):
├── apps/
│   ├── api/            # FastAPI gateway
│   ├── frontend/       # Next.js app
│   └── cli/            # hyperagent CLI
├── services/
│   ├── orchestrator/   # LangGraph orchestrator
│   ├── spec-agent/     # SpecAgent service
│   ├── codegen-agent/  # CodeGenAgent service
│   ├── audit-agent/    # AuditAgent service
│   ├── deploy-agent/   # DeployAgent service
│   ├── monitor-agent/  # MonitorAgent service
│   ├── storage-rag/    # IPFS/Filecoin storage
│   └── x402-verifier/  # x402 payment verification
├── contracts/          # Smart contract templates
│   ├── presets/        # Preset configurations
│   └── templates/      # Contract templates
├── packages/
│   ├── sdk/            # TypeScript SDK
│   ├── shared/         # Shared utilities
│   └── types/          # TypeScript types
└── external/           # Git submodules
    ├── openzeppelin/
    ├── forge-std/
    └── erc4626-tests/
```

### 2. Technology Stack Alignment

**Backend:**
- ✅ FastAPI (API gateway)
- ✅ LangGraph (orchestration)
- ✅ Redis (worker pool, caching)
- ✅ Supabase/PostgreSQL (database)
- ✅ SQLAlchemy (ORM)

**Frontend:**
- ✅ Next.js 16 (App Router)
- ✅ React 18
- ✅ Tailwind CSS
- ✅ Thirdweb (wallet integration)

**Smart Contracts:**
- ✅ Solidity ^0.8.24
- ✅ Hardhat/Foundry
- ✅ OpenZeppelin libraries

**DevOps:**
- ✅ Docker & Docker Compose
- ✅ Kubernetes (k8s/) - Already added
- ✅ ArgoCD (GitOps) - Already added
- ✅ GitHub Actions (CI/CD)

**Observability:**
- ✅ OpenTelemetry
- ✅ Prometheus (configs already exist)
- ✅ MLflow

### 3. Implementation Phases

#### Phase 1: Foundation Setup (Week 1)
- [ ] Create new directory structure
- [ ] Set up monorepo with workspaces
- [ ] Configure git submodules
- [ ] Set up Supabase schema
- [ ] Initialize FastAPI gateway skeleton
- [ ] Set up Redis worker pool

#### Phase 2: Core Services (Week 2)
- [ ] Implement LangGraph orchestrator
- [ ] Implement SpecAgent with RAG
- [ ] Implement CodeGenAgent
- [ ] Implement AuditAgent
- [ ] Implement DeployAgent
- [ ] Implement MonitorAgent stub

#### Phase 3: Chain Adapters (Week 3)
- [ ] SKALE chain adapter
- [ ] BNB chain adapter
- [ ] Avalanche chain adapter
- [ ] Protocol Labs (IPFS/Filecoin) integration
- [ ] EigenDA integration

#### Phase 4: SDK & CLI (Week 4)
- [ ] TypeScript SDK core functions
- [ ] hyperagent CLI implementation
- [ ] SDK npm package setup
- [ ] CLI documentation

#### Phase 5: Frontend (Week 5)
- [ ] Next.js app shell with auth
- [ ] Run Pipeline UI
- [ ] New Project wizard
- [ ] Preset selection UI

#### Phase 6: Multi-Tenant & Production (Week 6)
- [ ] Multi-tenant workspace model
- [ ] Auth0/JWT integration
- [ ] Rate limiting per workspace
- [ ] Preset registry system
- [ ] CI/CD workflows
- [ ] Quality gates

## Files Ready for Refactoring

### Current Files on Develop Branch

**`.cursor/` Directory (136 files):**
- `.cursor/rules/` - Agent rules and guidelines
- `.cursor/skills/` - 22 skill directories
- `.cursor/llm/` - LLM documentation files

**`k8s/` Directory (18 files):**
- `k8s/base/` - Base Kubernetes manifests
- `k8s/overlays/` - Environment-specific overlays (dev, staging, production)
- `k8s/argocd/` - ArgoCD application definitions

## Next Steps

### Immediate Actions

1. **Commit Current Changes**
   ```bash
   git commit -m "feat: add .cursor and k8s directories to develop branch

   - Include entire .cursor/* directory (136 files)
   - Include entire k8s/* directory (18 files)
   - Prepare develop branch for Phase 1-3 refactoring"
   ```

2. **Create Refactoring Branch**
   ```bash
   git checkout -b refactor/phase1-sprint1
   ```

3. **Begin Directory Restructuring**
   - Create new monorepo structure
   - Move existing code to new locations
   - Update all import paths
   - Update configuration files

4. **Set Up Foundation Components**
   - Supabase schema
   - FastAPI gateway
   - Redis configuration
   - LangGraph orchestrator skeleton

## Success Criteria

- [ ] All Phase 1-3 epics mapped to code structure
- [ ] Directory structure aligns with Sprint 3 requirements
- [ ] All services properly organized
- [ ] Git submodules configured
- [ ] CI/CD workflows functional
- [ ] Multi-tenant architecture implemented
- [ ] All chain adapters functional
- [ ] SDK and CLI published
- [ ] Frontend fully functional
- [ ] Production-ready deployment

---

**Document Control:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-06 | @ArhonJay | Initial refactoring plan for Phase 1-3 |

