#!/bin/bash

# Parallel Commit Script (Bash version)
# Handles git commits with optional dry-run mode

set -e

DRY_RUN=false
MAX_COMMITS=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --max=*)
      MAX_COMMITS="${1#*=}"
      shift
      ;;
    --max)
      MAX_COMMITS="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

log() {
  echo "[parallel-commit] $1"
}

if [ "$DRY_RUN" = true ]; then
  log "DRY RUN mode enabled"
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  log "Error: Not in a git repository"
  exit 1
fi

# Get staged files
STAGED_FILES=$(git diff --cached --name-only)

if [ -z "$STAGED_FILES" ]; then
  log "No staged files found. Staging all changes..."
  git add -A
  STAGED_FILES=$(git diff --cached --name-only)
  
  if [ -z "$STAGED_FILES" ]; then
    log "No changes to commit"
    exit 0
  fi
fi

FILE_COUNT=$(echo "$STAGED_FILES" | wc -l | tr -d ' ')
log "Found $FILE_COUNT staged file(s)"

# Group files
FRONTEND_FILES=$(echo "$STAGED_FILES" | grep "^apps/web/" || true)
BACKEND_FILES=$(echo "$STAGED_FILES" | grep -E "^(apps/api|services|agents)/" || true)
DOCS_FILES=$(echo "$STAGED_FILES" | grep -E "^docs/|\.md$" || true)
CONFIG_FILES=$(echo "$STAGED_FILES" | grep -E "^\\.|config|package\\.json|\.json$" || true)

COMMITS=0

# Commit frontend changes
if [ -n "$FRONTEND_FILES" ]; then
  FRONTEND_COUNT=$(echo "$FRONTEND_FILES" | wc -l | tr -d ' ')
  MESSAGE="feat(frontend): update $FRONTEND_COUNT file(s)"
  
  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would commit frontend: $MESSAGE"
  else
    echo "$FRONTEND_FILES" | xargs git add
    git commit -m "$MESSAGE"
    log "✓ Committed frontend: $MESSAGE"
  fi
  COMMITS=$((COMMITS + 1))
  
  if [ -n "$MAX_COMMITS" ] && [ "$COMMITS" -ge "$MAX_COMMITS" ]; then
    exit 0
  fi
fi

# Commit backend changes
if [ -n "$BACKEND_FILES" ]; then
  BACKEND_COUNT=$(echo "$BACKEND_FILES" | wc -l | tr -d ' ')
  MESSAGE="feat(backend): update $BACKEND_COUNT file(s)"
  
  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would commit backend: $MESSAGE"
  else
    echo "$BACKEND_FILES" | xargs git add
    git commit -m "$MESSAGE"
    log "✓ Committed backend: $MESSAGE"
  fi
  COMMITS=$((COMMITS + 1))
  
  if [ -n "$MAX_COMMITS" ] && [ "$COMMITS" -ge "$MAX_COMMITS" ]; then
    exit 0
  fi
fi

# Commit docs changes
if [ -n "$DOCS_FILES" ]; then
  DOCS_COUNT=$(echo "$DOCS_FILES" | wc -l | tr -d ' ')
  MESSAGE="docs: update $DOCS_COUNT file(s)"
  
  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would commit docs: $MESSAGE"
  else
    echo "$DOCS_FILES" | xargs git add
    git commit -m "$MESSAGE"
    log "✓ Committed docs: $MESSAGE"
  fi
  COMMITS=$((COMMITS + 1))
  
  if [ -n "$MAX_COMMITS" ] && [ "$COMMITS" -ge "$MAX_COMMITS" ]; then
    exit 0
  fi
fi

# Commit config changes
if [ -n "$CONFIG_FILES" ]; then
  CONFIG_COUNT=$(echo "$CONFIG_FILES" | wc -l | tr -d ' ')
  MESSAGE="chore(config): update $CONFIG_COUNT file(s)"
  
  if [ "$DRY_RUN" = true ]; then
    log "[DRY RUN] Would commit config: $MESSAGE"
  else
    echo "$CONFIG_FILES" | xargs git add
    git commit -m "$MESSAGE"
    log "✓ Committed config: $MESSAGE"
  fi
  COMMITS=$((COMMITS + 1))
fi

log "Completed: $COMMITS commit(s)"

