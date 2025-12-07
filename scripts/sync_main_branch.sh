#!/bin/bash
# sync_main_branch.sh - Sync Main Branch from Development
# 
# Syncs main branch from development, excluding development-only files.
# This is the recommended workflow for production releases.
#
# Usage:
#   bash scripts/sync_main_branch.sh

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Sync Main Branch from Development${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}Error: Not in a git repository${NC}"
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${BLUE}Current branch: ${CURRENT_BRANCH}${NC}"
echo ""

# Step 1: Switch to development branch
echo -e "${BLUE}Step 1: Switching to development branch...${NC}"
if git show-ref --verify --quiet refs/heads/development; then
    git checkout development
    echo -e "${GREEN}✓ Switched to development branch${NC}"
else
    echo -e "${YELLOW}⚠ Development branch does not exist, creating from current branch...${NC}"
    git checkout -b development
fi
echo ""

# Step 2: Pull latest changes from origin-dev
echo -e "${BLUE}Step 2: Pulling latest changes from origin-dev/development...${NC}"
if git remote | grep -q origin-dev; then
    git pull origin-dev development 2>/dev/null || echo -e "${YELLOW}⚠ No remote changes or remote not configured${NC}"
else
    echo -e "${YELLOW}⚠ origin-dev remote not found, skipping pull${NC}"
fi
echo ""

# Step 3: Create or switch to main branch
echo -e "${BLUE}Step 3: Creating/updating main branch...${NC}"
if git show-ref --verify --quiet refs/heads/main; then
    echo -e "${BLUE}Main branch exists, switching to it...${NC}"
    git checkout main
    echo -e "${BLUE}Merging development into main...${NC}"
    git merge development --no-edit --no-ff || {
        echo -e "${RED}✗ Merge conflict detected. Please resolve manually.${NC}"
        exit 1
    }
else
    echo -e "${BLUE}Main branch does not exist, creating from development...${NC}"
    git checkout -b main
fi
echo ""

# Step 4: Remove development-only files
echo -e "${BLUE}Step 4: Removing development-only files from main branch...${NC}"

# List of files/directories to remove for production
REMOVE_FILES=(
    "tests/"
    "scripts/"
    "docs/"
    "GUIDE/"
    "examples/"
    "pytest.ini"
    "tests/README.md"
    ".cursor/"
)

REMOVED_ANY=false

for item in "${REMOVE_FILES[@]}"; do
    if [ -e "$item" ] || [ -d "$item" ]; then
        echo -e "  ${YELLOW}Removing: $item${NC}"
        rm -rf "$item"
        REMOVED_ANY=true
    fi
done

# Remove plan files
find . -name "*.plan.md" -type f -not -path "./.git/*" 2>/dev/null | while read -r file; do
    echo -e "  ${YELLOW}Removing: $file${NC}"
    rm -f "$file"
    REMOVED_ANY=true
done

if [ "$REMOVED_ANY" = true ]; then
    echo -e "${GREEN}✓ Development files removed${NC}"
else
    echo -e "${YELLOW}⚠ No development files found to remove${NC}"
fi
echo ""

# Step 5: Stage all changes
echo -e "${BLUE}Step 5: Staging changes...${NC}"
git add -A

# Step 6: Commit changes
echo -e "${BLUE}Step 6: Committing changes...${NC}"
if git diff --staged --quiet; then
    echo -e "${YELLOW}⚠ No changes to commit (files already removed)${NC}"
else
    git commit -m "chore: remove development files for production release

- Removed tests/ directory
- Removed scripts/ directory  
- Removed docs/ directory
- Removed GUIDE/ directory
- Removed examples/ directory
- Removed pytest.ini
- Removed test documentation
- Removed planning documents" || {
        echo -e "${YELLOW}⚠ No changes to commit${NC}"
    }
    echo -e "${GREEN}✓ Changes committed${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Main branch synced and cleaned${NC}"
echo ""
echo -e "${BLUE}Current branch: $(git branch --show-current)${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Review changes: ${BLUE}git log --oneline -5${NC}"
echo "  2. Push to production remote: ${BLUE}git push origin-prod main${NC}"
echo "  3. Switch back to development: ${BLUE}git checkout development${NC}"
echo ""

