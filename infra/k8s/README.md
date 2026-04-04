# Kubernetes manifests (Kustomize)

This repository standardizes on **Kustomize** for Kubernetes configuration. Manifests live under `infra/k8s/` (`base` plus `overlays/*`).

**Helm is not used** for HyperAgent Phase 1. If Helm charts are introduced later, document an explicit ADR and migrate in one direction; do not maintain parallel Helm and Kustomize for the same workload without a plan.

## Overlays

| Overlay        | Namespace              | Purpose                          |
|----------------|------------------------|----------------------------------|
| `development`| `hyperagent-development` | Dev / Argo CD default path       |
| `staging`    | `hyperagent-staging`     | Pre-production validation        |
| `production` | `hyperagent-production`  | Production replicas and labels   |

## Validate locally

```bash
kubectl kustomize infra/k8s/overlays/development
kubectl kustomize infra/k8s/overlays/staging
kubectl kustomize infra/k8s/overlays/production
```

## GitOps

Argo CD `Application` and `ApplicationSet` examples live under `infra/gitops/argocd/`. Progressive delivery (canaries) is optional; see `infra/gitops/argo-rollouts/`.
