#!/bin/bash
# cleanup_dev.sh - Development Environment Cleanup
#
# Cleans up development artifacts:
#   - Python cache files (__pycache__, *.pyc)
#   - Node.js cache and build artifacts
#   - Log files
#   - Temporary files
#   - Docker build cache (optional)
#
# Usage:
#   ./scripts/cleanup_dev.sh
#   ./scripts/cleanup_dev.sh --docker  # Also clean Docker cache
#   ./scripts/cleanup_dev.sh --all     # Clean everything including node_modules

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

CLEAN_DOCKER=false
CLEAN_NODE_MODULES=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --docker)
            CLEAN_DOCKER=true
            shift
            ;;
        --all)
            CLEAN_NODE_MODULES=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--docker] [--all]"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Development Environment Cleanup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

TOTAL_SIZE=0

# Function to calculate directory size
get_size() {
    local path=$1
    if [ -d "$path" ]; then
        du -sh "$path" 2>/dev/null | cut -f1 || echo "0"
    else
        echo "0"
    fi
}

# Function to remove and report
clean_item() {
    local name=$1
    local path=$2
    
    if [ -e "$path" ] || [ -d "$path" ]; then
        local size=$(get_size "$path")
        echo -e "${BLUE}Cleaning:${NC} $name"
        echo "  Path: $path"
        echo "  Size: $size"
        rm -rf "$path"
        echo -e "${GREEN}  ✓ Removed${NC}"
        echo ""
    fi
}

# Clean Python cache files
echo -e "${BLUE}Cleaning Python cache files...${NC}"
find . -type d -name "__pycache__" -not -path "./.git/*" -not -path "./venv/*" -not -path "./.venv/*" | while read -r dir; do
    clean_item "Python cache" "$dir"
done

find . -type f -name "*.pyc" -not -path "./.git/*" -not -path "./venv/*" -not -path "./.venv/*" | while read -r file; do
    rm -f "$file"
done

find . -type f -name "*.pyo" -not -path "./.git/*" -not -path "./venv/*" -not -path "./.venv/*" | while read -r file; do
    rm -f "$file"
done

echo -e "${GREEN}✓ Python cache cleaned${NC}"
echo ""

# Clean Python .egg-info
echo -e "${BLUE}Cleaning Python build artifacts...${NC}"
find . -type d -name "*.egg-info" -not -path "./.git/*" | while read -r dir; do
    clean_item "Python egg-info" "$dir"
done

find . -type d -name "dist" -not -path "./.git/*" -not -path "./node_modules/*" | while read -r dir; do
    clean_item "Python dist" "$dir"
done

find . -type d -name "build" -not -path "./.git/*" -not -path "./node_modules/*" | while read -r dir; do
    clean_item "Python build" "$dir"
done

echo -e "${GREEN}✓ Python build artifacts cleaned${NC}"
echo ""

# Clean Node.js cache and build artifacts
echo -e "${BLUE}Cleaning Node.js cache and build artifacts...${NC}"

# .next directory
if [ -d "frontend/.next" ]; then
    clean_item "Next.js build" "frontend/.next"
fi

# node_modules (optional)
if [ "$CLEAN_NODE_MODULES" = true ]; then
    if [ -d "frontend/node_modules" ]; then
        clean_item "node_modules" "frontend/node_modules"
    fi
else
    echo -e "${YELLOW}Skipping node_modules (use --all to clean)${NC}"
fi

# npm cache
if command -v npm &> /dev/null; then
    echo -e "${BLUE}Cleaning npm cache...${NC}"
    npm cache clean --force 2>/dev/null || true
    echo -e "${GREEN}✓ npm cache cleaned${NC}"
fi

echo ""

# Clean log files
echo -e "${BLUE}Cleaning log files...${NC}"
if [ -d "logs" ]; then
    find logs -type f -name "*.log" -mtime +7 | while read -r file; do
        rm -f "$file"
        echo "  Removed: $file"
    done
    echo -e "${GREEN}✓ Old log files cleaned (kept last 7 days)${NC}"
else
    echo -e "${YELLOW}No logs directory found${NC}"
fi
echo ""

# Clean temporary files
echo -e "${BLUE}Cleaning temporary files...${NC}"
find . -type f -name "*.tmp" -not -path "./.git/*" | while read -r file; do
    rm -f "$file"
done

find . -type f -name "*.swp" -not -path "./.git/*" | while read -r file; do
    rm -f "$file"
done

find . -type f -name "*.swo" -not -path "./.git/*" | while read -r file; do
    rm -f "$file"
done

find . -type f -name ".DS_Store" -not -path "./.git/*" | while read -r file; do
    rm -f "$file"
done

echo -e "${GREEN}✓ Temporary files cleaned${NC}"
echo ""

# Clean Docker cache (optional)
if [ "$CLEAN_DOCKER" = true ]; then
    echo -e "${BLUE}Cleaning Docker build cache...${NC}"
    if command -v docker &> /dev/null; then
        docker builder prune -f
        echo -e "${GREEN}✓ Docker cache cleaned${NC}"
    else
        echo -e "${YELLOW}Docker not found, skipping${NC}"
    fi
    echo ""
fi

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Cleanup completed${NC}"
echo ""
echo "To clean everything including node_modules:"
echo "  ./scripts/cleanup_dev.sh --all"
echo ""
echo "To also clean Docker cache:"
echo "  ./scripts/cleanup_dev.sh --docker"

