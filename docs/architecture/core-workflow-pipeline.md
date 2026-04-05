# Core workflow pipeline

This page summarizes the end-to-end lifecycle HyperAgent is aiming to make reliable for Phase 1.

## Canonical path

The orchestrator compiles a LangGraph workflow that broadly follows this shape:

1. Estimate
2. Spec generation
3. Human approval when required
4. Design generation
5. Code generation
6. Security and policy checks
7. Test generation
8. SCRUBD validation
9. Audit
10. Guardian and deploy gating
11. Deploy and monitor hooks
12. Simulation
13. Security policy evaluation
14. Exploit simulation
15. UI scaffold and artifacts

Autofix loops can send failed outputs back through validation and audit stages.

## Main control-plane components

- Workflow graph: `services/orchestrator/workflow.py`
- API surface: `services/orchestrator/api/`
- Agent entrypoints: `services/agent-runtime/src/index.ts`

## Important production notes

- Not every stage is equally mature today
- Some stages are environment-dependent and optional unless explicitly enforced
- Production readiness should be validated against [capability truth table](../control-plane/capability-truth-table.md)

## Stage guides

- [Control plane: runs and steps](../control-plane/runs-and-steps.md)
- [Storage policy](../control-plane/storage-policy.md)
- [Deploy ownership](../runbooks/deploy-ownership.md)

## Related service topics

- [x402 payment system](x402-payment-system.md)
- [Deployment strategies](deployment-strategies.md)
