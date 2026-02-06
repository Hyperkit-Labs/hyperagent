# Phase 4 & Phase 5 Issue Creation Scripts

## Overview

Scripts for creating GitHub issues for Phase 4 (Agent Economy & Governance) and Phase 5 (Verifiable Intelligence) roadmaps.

## Scripts

### create_phase4_issues.py

Creates GitHub issues for Phase 4 (H1 2027) focusing on:
- ERC-8004 Agent Registry integration
- Agent Marketplace & Job Routing
- x402 Payment integration
- Agent-to-Agent (A2A) connectors
- Governance & Token Mechanics

**Usage:**
```bash
cd scripts/github
python create_phase4_issues.py --csv ../data/phase4_issues.csv
python create_phase4_issues.py --csv ../data/phase4_issues.csv --dry-run
```

### create_phase5_issues.py

Creates GitHub issues for Phase 5 (H2 2027) focusing on:
- Verifiable Build & Audit (ZK proofs)
- Verifiable Simulation & Deployment
- Cross-Chain AVS for Verification
- Verifiable Mode toggle and UX
- Cryptographic proof generation

**Usage:**
```bash
cd scripts/github
python create_phase5_issues.py --csv ../data/phase5_issues.csv
python create_phase5_issues.py --csv ../data/phase5_issues.csv --dry-run
```

## Features

Both scripts:
- Reuse the Phase 1 automation infrastructure
- Use the same environment variables and setup
- Generate issues with the Planning Layers template
- Support CSV and YAML input formats
- Include architecture diagrams and code examples
- Assign owners based on CODEOWNERS
- Link to GitHub Project 9

## Setup

Same as Phase 1 - no additional setup required:
1. Set environment variables (GITHUB_TOKEN, GITHUB_OWNER, etc.)
2. Ensure Project 9 and custom fields are configured
3. Prepare CSV/YAML files with Phase 4 or Phase 5 issues

## CSV Format

Same format as Phase 1:
```csv
title,labels,milestone,sprint
"Epic: ERC-8004 Agent Registry","type:epic,area:agents,phase:agent-economy","Phase 4 – Sprint 1 (Q1 2027)","Sprint 1"
"Implement ERC-8004 Identity Registry","type:feature,area:agents,phase:agent-economy","Phase 4 – Sprint 1 (Q1 2027)","Sprint 1"
```

## Phase-Specific Areas

### Phase 4 Areas
- `area:agents` - Agent registry and marketplace
- `area:governance` - Governance and token mechanics
- `area:payments` - x402 payment integration
- `area:marketplace` - Job marketplace and routing

### Phase 5 Areas
- `area:verification` - Verifiable mode and proofs
- `area:zk` - Zero-knowledge proof generation
- `area:avs` - Cross-chain AVS integration
- `area:security` - Cryptographic verification

## Documentation

- Setup: [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md)
- Issue Template: [PLANNING_LAYERS_TEMPLATE.md](PLANNING_LAYERS_TEMPLATE.md)
- Architecture Diagrams: [ARCHITECTURE_DIAGRAMS_UPDATE.md](ARCHITECTURE_DIAGRAMS_UPDATE.md)

