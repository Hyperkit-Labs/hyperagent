#!/bin/bash

# Script to remove .env file from entire Git history
# WARNING: This rewrites Git history. Use with caution.

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}⚠️  WARNING: This will rewrite Git history!${NC}"
echo -e "${YELLOW}This removes .env from ALL commits in the repository.${NC}"
echo ""
read -p "Continue? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo -e "${RED}Aborted${NC}"
    exit 1
fi

# Create backup branch
echo -e "${BLUE}Creating backup branch...${NC}"
git branch backup-before-env-removal-$(date +%Y%m%d-%H%M%S)

# Remove .env from all commits using filter-branch
echo -e "${BLUE}Removing .env from Git history...${NC}"
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Clean up
echo -e "${BLUE}Cleaning up Git references...${NC}"
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo -e "${GREEN}✅ .env removed from Git history${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Verify: git log --all --source --full-history -- .env"
echo -e "  2. Force push: git push origin --force --all"
echo -e "  3. Force push tags: git push origin --force --tags"
echo ""
echo -e "${RED}⚠️  WARNING: Force push required. Coordinate with team first!${NC}"

