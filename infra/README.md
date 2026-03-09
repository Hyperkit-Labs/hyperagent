# Infrastructure

This directory contains Infrastructure as Code (IaC) and deployment configurations.

## Structure

- **terraform/**: Terraform configurations for cloud resources, databases, queues, and runners
- **k8s/**: Kubernetes manifests (base + Kustomize overlays for development and production). ArgoCD applications point at `k8s/overlays/development` or `k8s/overlays/production`.
- **argocd/**: ArgoCD Application manifests (hyperagent-api)
- **github/**: GitHub Actions workflows and reusable actions
- **docker/**: Docker Compose files and Dockerfiles for local/CI and Contabo production

## Deployment

- **Contabo/Coolify:** Use `docker-compose.coolify.yml` (repo root) for Coolify; see `external/docs/Fixes/coolify-contabo-migration.md`. Local: `infra/docker/docker-compose.yml`.
- **Kubernetes:** Build and push container images, create secrets in the target namespace, then sync via ArgoCD. See `docs/production-deployment.md`.
- **Local:** From repo root, `make up` (Docker Compose), `make run-web` (Studio). See `docs/docker-scenarios.md` and `.cursor/skills/docker-compose-scenarios`.

