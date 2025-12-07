#!/bin/bash
# check_dependencies.sh - Verify All Required Dependencies
#
# Checks that all required dependencies are installed:
#   - Python 3.10+
#   - Node.js 18+
#   - Docker (optional, for containerized setup)
#   - PostgreSQL client tools (optional)
#   - Redis client tools (optional)
#
# Usage:
#   ./scripts/check_dependencies.sh
#   ./scripts/check_dependencies.sh --verbose

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

VERBOSE=false
if [[ "$1" == "--verbose" ]] || [[ "$1" == "-v" ]]; then
    VERBOSE=true
fi

ALL_OK=true

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Dependency Check${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to check command
check_command() {
    local name=$1
    local command=$2
    local required=${3:-true}
    local min_version=$4
    
    if command -v "$command" &> /dev/null; then
        local version=$($command --version 2>&1 | head -n1)
        echo -e "${GREEN}✓${NC} $name is installed"
        if [ "$VERBOSE" = true ]; then
            echo "  Command: $command"
            echo "  Version: $version"
        fi
        
        # Check version if min_version provided
        if [ -n "$min_version" ]; then
            # Extract version number and compare
            local installed_version=$(echo "$version" | grep -oE '[0-9]+\.[0-9]+' | head -n1)
            if [ -n "$installed_version" ]; then
                if [ "$VERBOSE" = true ]; then
                    echo "  Required: >= $min_version"
                fi
                # Simple version comparison (works for major.minor)
                local installed_major=$(echo "$installed_version" | cut -d. -f1)
                local installed_minor=$(echo "$installed_version" | cut -d. -f2)
                local required_major=$(echo "$min_version" | cut -d. -f1)
                local required_minor=$(echo "$min_version" | cut -d. -f2)
                
                if [ "$installed_major" -gt "$required_major" ] || \
                   ([ "$installed_major" -eq "$required_major" ] && [ "$installed_minor" -ge "$required_minor" ]); then
                    if [ "$VERBOSE" = true ]; then
                        echo -e "  ${GREEN}✓ Version requirement met${NC}"
                    fi
                else
                    echo -e "  ${YELLOW}⚠ Version $installed_version is below required $min_version${NC}"
                fi
            fi
        fi
        return 0
    else
        if [ "$required" = true ]; then
            echo -e "${RED}✗${NC} $name is NOT installed (REQUIRED)"
            ALL_OK=false
            return 1
        else
            echo -e "${YELLOW}⚠${NC} $name is NOT installed (optional)"
            return 1
        fi
    fi
}

# Required dependencies
echo -e "${BLUE}Required Dependencies:${NC}"
echo ""

check_command "Python" "python3" true "3.10"
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
    if [ "$VERBOSE" = true ]; then
        echo "  Python path: $(which python3)"
    fi
fi
echo ""

check_command "pip" "pip3" true
echo ""

check_command "Node.js" "node" true "18.0"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version 2>&1 | sed 's/v//')
    if [ "$VERBOSE" = true ]; then
        echo "  Node path: $(which node)"
    fi
fi
echo ""

check_command "npm" "npm" true "8.0"
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version 2>&1)
    if [ "$VERBOSE" = true ]; then
        echo "  npm path: $(which npm)"
    fi
fi
echo ""

check_command "Git" "git" true
echo ""

# Optional dependencies
echo -e "${BLUE}Optional Dependencies (for Docker setup):${NC}"
echo ""

check_command "Docker" "docker" false
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version 2>&1)
    if [ "$VERBOSE" = true ]; then
        echo "  Docker path: $(which docker)"
    fi
    
    # Check if Docker is running
    if docker info &> /dev/null; then
        echo -e "  ${GREEN}✓ Docker daemon is running${NC}"
    else
        echo -e "  ${YELLOW}⚠ Docker daemon is not running${NC}"
    fi
fi
echo ""

check_command "Docker Compose" "docker-compose" false
if ! command -v docker-compose &> /dev/null; then
    # Check for docker compose (v2)
    if docker compose version &> /dev/null; then
        echo -e "${GREEN}✓${NC} Docker Compose is available (v2)"
        if [ "$VERBOSE" = true ]; then
            docker compose version
        fi
    fi
fi
echo ""

check_command "PostgreSQL Client" "psql" false
echo ""

check_command "Redis Client" "redis-cli" false
echo ""

# Check Python packages
echo -e "${BLUE}Python Packages:${NC}"
echo ""

if command -v python3 &> /dev/null; then
    # Check if virtual environment is active
    if [ -n "$VIRTUAL_ENV" ]; then
        echo -e "${GREEN}✓${NC} Virtual environment is active"
        if [ "$VERBOSE" = true ]; then
            echo "  Path: $VIRTUAL_ENV"
        fi
    else
        echo -e "${YELLOW}⚠${NC} No virtual environment detected"
        echo "  Recommendation: python3 -m venv venv && source venv/bin/activate"
    fi
    echo ""
    
    # Check key packages
    if python3 -c "import fastapi" 2>/dev/null; then
        FASTAPI_VERSION=$(python3 -c "import fastapi; print(fastapi.__version__)" 2>/dev/null)
        echo -e "${GREEN}✓${NC} FastAPI is installed (v$FASTAPI_VERSION)"
    else
        echo -e "${YELLOW}⚠${NC} FastAPI is not installed"
        echo "  Install: pip install -r requirements.txt"
    fi
    
    if python3 -c "import alembic" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Alembic is installed"
    else
        echo -e "${YELLOW}⚠${NC} Alembic is not installed"
    fi
else
    echo -e "${RED}✗${NC} Cannot check Python packages (Python not found)"
fi
echo ""

# Check Node.js packages
echo -e "${BLUE}Node.js Packages:${NC}"
echo ""

if command -v npm &> /dev/null && [ -d "frontend" ]; then
    if [ -d "frontend/node_modules" ]; then
        echo -e "${GREEN}✓${NC} Frontend dependencies are installed"
        if [ "$VERBOSE" = true ]; then
            echo "  Path: frontend/node_modules"
        fi
    else
        echo -e "${YELLOW}⚠${NC} Frontend dependencies are not installed"
        echo "  Install: cd frontend && npm install"
    fi
else
    echo -e "${YELLOW}⚠${NC} Cannot check frontend packages"
fi
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
if [ "$ALL_OK" = true ]; then
    echo -e "${GREEN}✓ All required dependencies are installed${NC}"
    exit 0
else
    echo -e "${RED}✗ Some required dependencies are missing${NC}"
    echo ""
    echo "Install missing dependencies:"
    echo "  Python: https://www.python.org/downloads/"
    echo "  Node.js: https://nodejs.org/"
    echo "  Docker: https://www.docker.com/products/docker-desktop"
    exit 1
fi

