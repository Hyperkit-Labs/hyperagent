# Progressive delivery (optional)

Canary and blue/green rollouts are **not** required for the baseline Kustomize + Argo CD path. Use **Argo Rollouts** when you need automated canary analysis, traffic splitting, and promotion gates.

## Prerequisites

- Argo Rollouts controller installed in the cluster (`kubectl create namespace argo-rollouts` and apply upstream manifests or Helm chart).
- Metrics provider for `AnalysisRun` (Prometheus, Datadog, etc.) if you use automated promotion.

## Relationship to this repo

- Base workloads in `infra/k8s/base/` use standard Kubernetes `Deployment` resources.
- To adopt Rollouts, replace `Deployment` with `Rollout` for a given service and add `Service`/`VirtualService` as needed for your ingress layer.
- Keep **one** packaging path: still render with Kustomize; Rollout CRDs are just additional resources in the same overlay.

## Example

See `example-orchestrator-rollout.yaml` for a minimal `Rollout` plus `AnalysisTemplate` sketch. Tune replicas, steps, and queries to match your SLOs and metrics.

## Alternatives

- Flagger (Flagger + ingress/service mesh)
- Native Kubernetes Deployment with manual Argo CD sync waves (no automatic traffic shift)

Choose one progressive-delivery tool per cluster to avoid overlapping controllers.
