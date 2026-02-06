# GitOps Setup Guide

**Version:** 1.0.0  
**Last Updated:** 2026-02-06  
**Owner:** @ArhonJay (CTO), @JustineDevs (CPO)

---

## Overview

This guide covers setting up GitOps for HyperAgent using ArgoCD, following the GitFlow branching strategy and OpenGitOps principles.

## Prerequisites

- Kubernetes cluster (v1.24+)
- kubectl configured
- ArgoCD CLI installed
- GitHub repository access
- Admin access to Kubernetes cluster

## Directory Structure

```
k8s/
├── base/                    # Base Kubernetes manifests
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   ├── ingress.yaml
│   └── kustomization.yaml
├── overlays/                # Environment-specific patches
│   ├── dev/
│   ├── staging/
│   └── production/
└── argocd/                  # ArgoCD application definitions
    ├── applications/
    │   ├── hyperagent-staging.yaml
    │   └── hyperagent-production.yaml
    └── project.yaml
```

## Step 1: Install ArgoCD

```bash
# Create namespace
kubectl create namespace argocd

# Install ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD to be ready
kubectl wait --for=condition=available --timeout=300s deployment/argocd-server -n argocd

# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d && echo

# Port-forward to access UI
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

Access ArgoCD UI at: https://localhost:8080
- Username: `admin`
- Password: (from command above)

## Step 2: Create ArgoCD Project

```bash
# Apply project configuration
kubectl apply -f k8s/argocd/project.yaml

# Verify project created
kubectl get appproject hyperagent -n argocd
```

## Step 3: Create ArgoCD Applications

### Staging Application (Auto-Sync from develop)

```bash
# Apply staging application
kubectl apply -f k8s/argocd/applications/hyperagent-staging.yaml

# Verify application created
kubectl get application hyperagent-staging -n argocd

# Check sync status
argocd app get hyperagent-staging
```

### Production Application (Manual Sync from main tags)

```bash
# Apply production application
kubectl apply -f k8s/argocd/applications/hyperagent-production.yaml

# Verify application created
kubectl get application hyperagent-production -n argocd

# Initial sync (manual)
argocd app sync hyperagent-production
```

## Step 4: Configure Repository Access

ArgoCD needs access to the GitHub repository. Configure using one of:

### Option A: SSH Key (Recommended)

```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "argocd@hyperagent" -f argocd-ssh-key

# Add public key to GitHub (Settings > SSH and GPG keys)
cat argocd-ssh-key.pub

# Create Kubernetes secret
kubectl create secret generic argocd-repo-credentials \
  --from-file=sshPrivateKey=argocd-ssh-key \
  -n argocd

# Update ArgoCD repository configuration
argocd repo add git@github.com:hyperkit-labs/Hyperkit_agent.git \
  --ssh-private-key-path argocd-ssh-key \
  --name hyperagent
```

### Option B: GitHub Token

```bash
# Create secret with GitHub token
kubectl create secret generic argocd-github-token \
  --from-literal=token=YOUR_GITHUB_TOKEN \
  -n argocd

# Add repository
argocd repo add https://github.com/hyperkit-labs/Hyperkit_agent.git \
  --username YOUR_GITHUB_USERNAME \
  --password YOUR_GITHUB_TOKEN
```

## Step 5: Verify GitOps Workflow

### Test Staging Auto-Sync

```bash
# Make a change to develop branch
git checkout develop
# Edit k8s/overlays/staging/kustomization.yaml

# Commit and push
git add k8s/
git commit -m "chore(k8s): update staging config"
git push origin develop

# Watch ArgoCD sync (should happen automatically)
argocd app get hyperagent-staging --watch
```

### Test Production Manual Sync

```bash
# Create a release tag
git checkout main
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0

# Update production application to track new tag
kubectl patch application hyperagent-production -n argocd \
  --type merge \
  -p '{"spec":{"source":{"targetRevision":"v0.1.0"}}}'

# Manual sync
argocd app sync hyperagent-production
```

## Step 6: Configure Notifications (Optional)

### Slack Integration

```bash
# Install ArgoCD Notifications
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj-labs/argocd-notifications/v1.3.0/catalog/install.yaml

# Configure Slack webhook
kubectl patch cm argocd-notifications-cm -n argocd --type merge -p '{
  "data": {
    "service.slack": "webhook:https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
  }
}'

# Add notification triggers to applications
kubectl patch application hyperagent-staging -n argocd --type merge -p '{
  "metadata": {
    "annotations": {
      "notifications.argoproj.io/subscribe.on-sync-succeeded.slack": "hyperagent-alerts",
      "notifications.argoproj.io/subscribe.on-sync-failed.slack": "hyperagent-alerts"
    }
  }
}'
```

## Troubleshooting

### Application Stuck in Syncing

```bash
# Check application status
argocd app get hyperagent-staging

# Check sync operation details
argocd app history hyperagent-staging

# Force refresh
argocd app get hyperagent-staging --refresh

# Hard refresh (if needed)
argocd app sync hyperagent-staging --force
```

### Repository Access Issues

```bash
# Test repository access
argocd repo get https://github.com/hyperkit-labs/Hyperkit_agent.git

# Check repository credentials
kubectl get secret -n argocd | grep repo

# Re-authenticate
argocd repo add https://github.com/hyperkit-labs/Hyperkit_agent.git \
  --username YOUR_USERNAME \
  --password YOUR_TOKEN
```

### Sync Policy Issues

```bash
# Check sync policy
argocd app get hyperagent-staging -o yaml | grep syncPolicy

# Update sync policy
kubectl patch application hyperagent-staging -n argocd --type merge -p '{
  "spec": {
    "syncPolicy": {
      "automated": {
        "prune": true,
        "selfHeal": true
      }
    }
  }
}'
```

## Best Practices

1. **Always use tags for production** - Never point production to a branch
2. **Enable self-heal** - Automatically revert manual changes
3. **Use Kustomize overlays** - Keep base manifests DRY
4. **Monitor sync status** - Set up alerts for sync failures
5. **Review before sync** - Use manual sync for production
6. **Version control everything** - All manifests in Git

## References

- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [Kustomize Documentation](https://kustomize.io/)
- [GitOps Principles](./BRANCHING_STRATEGY.md#gitops-integration)
- `.cursor/skills/gitops-workflow/` - GitOps workflow patterns

---

**Document Control:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-06 | @ArhonJay | Initial GitOps setup guide |

