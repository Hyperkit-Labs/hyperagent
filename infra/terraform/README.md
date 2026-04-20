# Terraform

IaC layout for AWS/GCP: KMS (BYOK DEK wrapping), secret stores, Redis, and Kubernetes.

## Layout

- `modules/kms` — customer-managed KMS key for `LLM_KEY_KMS_KEY_ARN`
- `modules/secrets` — Secrets Manager / Secret Manager wiring (paired with External Secrets Operator)
- `modules/redis` — placeholder for ElastiCache or Upstash documentation outputs
- `modules/k8s-cluster` — placeholder EKS/GKE bootstrap (VPC, IRSA / Workload Identity)
- `environments/staging` — composes modules for staging
- `environments/production` — composes modules for production

Modules ship minimal `variables.tf` / `outputs.tf` / `main.tf` stubs. Extend with your cloud provider resources before `terraform apply`.

See `docs/detailed/Monorepo.md` and `infra/k8s/overlays/production/EXTERNAL_SECRETS.sample.txt` for secret sync.
