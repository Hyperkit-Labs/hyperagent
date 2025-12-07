#!/bin/bash
# reset_dev_env.sh - Reset Development Environment
#
# Resets the development environment to a clean state:
#   - Stops all Docker services
#   - Removes Docker volumes (database, Redis, etc.)
#   - Cleans build artifacts
#   - Optionally resets database migrations
#
# ⚠️  WARNING: This will delete all local data including database!
#
# Usage:
#   ./scripts/reset_dev_env.sh
#   ./scripts/reset_dev_env.sh --keep-volumes  # Keep database/Redis data
#   ./scripts/reset_dev_env.sh --full          # Full reset including migrations

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

KEEP_VOLUMES=false
FULL_RESET=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --keep-volumes)
            KEEP_VOLUMES=true
            shift
            ;;
        --full)
            FULL_RESET=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--keep-volumes] [--full]"
            exit 1
            ;;
    esac
done

echo -e "${RED}========================================${NC}"
echo -e "${RED}  Reset Development Environment${NC}"
echo -e "${RED}========================================${NC}"
echo ""
echo -e "${YELLOW}⚠️  WARNING: This will reset your development environment!${NC}"
echo ""

if [ "$KEEP_VOLUMES" = false ]; then
    echo -e "${RED}This will DELETE all local data including:${NC}"
    echo "  - Database (PostgreSQL)"
    echo "  - Redis cache"
    echo "  - Prometheus metrics"
    echo "  - All Docker volumes"
    echo ""
fi

read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Reset cancelled."
    exit 0
fi

echo ""
echo -e "${BLUE}Starting reset process...${NC}"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Step 1: Stop all Docker services
echo -e "${BLUE}Step 1: Stopping Docker services...${NC}"
if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    else
        DOCKER_COMPOSE="docker-compose"
    fi
    
    $DOCKER_COMPOSE down 2>/dev/null || true
    echo -e "${GREEN}✓ Docker services stopped${NC}"
else
    echo -e "${YELLOW}⚠ Docker Compose not found, skipping${NC}"
fi
echo ""

# Step 2: Remove Docker volumes
if [ "$KEEP_VOLUMES" = false ]; then
    echo -e "${BLUE}Step 2: Removing Docker volumes...${NC}"
    if command -v docker &> /dev/null; then
        # Remove project-specific volumes
        docker volume ls | grep -E "hyperagent|hyperagent_" | awk '{print $2}' | while read -r volume; do
            echo "  Removing volume: $volume"
            docker volume rm "$volume" 2>/dev/null || true
        done
        
        echo -e "${GREEN}✓ Docker volumes removed${NC}"
    else
        echo -e "${YELLOW}⚠ Docker not found, skipping${NC}"
    fi
    echo ""
else
    echo -e "${BLUE}Step 2: Keeping Docker volumes (--keep-volumes)${NC}"
    echo ""
fi

# Step 3: Clean build artifacts
echo -e "${BLUE}Step 3: Cleaning build artifacts...${NC}"
./scripts/cleanup_dev.sh 2>/dev/null || {
    # Fallback if cleanup script fails
    find . -type d -name "__pycache__" -not -path "./.git/*" -exec rm -rf {} + 2>/dev/null || true
    find . -type f -name "*.pyc" -not -path "./.git/*" -delete 2>/dev/null || true
    rm -rf frontend/.next 2>/dev/null || true
}
echo -e "${GREEN}✓ Build artifacts cleaned${NC}"
echo ""

# Step 4: Reset database migrations (optional)
if [ "$FULL_RESET" = true ]; then
    echo -e "${BLUE}Step 4: Resetting database migrations...${NC}"
    if [ -d "alembic/versions" ]; then
        # Note: This doesn't delete migration files, just resets the database
        echo "  Note: Migration files are kept. Database will be recreated on next start."
        echo -e "${GREEN}✓ Migration reset prepared${NC}"
    else
        echo -e "${YELLOW}⚠ No migrations directory found${NC}"
    fi
    echo ""
fi

# Step 5: Remove .env.local and other local config (optional)
echo -e "${BLUE}Step 5: Cleaning local configuration...${NC}"
if [ -f "frontend/.env.local" ]; then
    read -p "Remove frontend/.env.local? (y/n): " remove_env
    if [ "$remove_env" = "y" ]; then
        rm -f frontend/.env.local
        echo -e "${GREEN}✓ Removed frontend/.env.local${NC}"
    fi
fi
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Development environment reset complete${NC}"
echo ""
echo "Next steps:"
echo "  1. Start services: docker-compose up -d"
echo "  2. Or use hybrid setup: ./scripts/start-backend.sh"
echo "  3. Run migrations: alembic upgrade head"
echo "  4. Seed templates (optional): python scripts/seed_contract_templates.py"
echo ""

