#!/bin/bash
# verify_all_services.sh - Health Check for All Services
#
# Verifies that all HyperAgent services are running and healthy:
#   - PostgreSQL (port 5432)
#   - Redis (port 6379)
#   - HyperAgent API (port 8000)
#   - x402 Verifier (port 3002)
#   - Prometheus (port 9090, optional)
#
# Usage:
#   ./scripts/verify_all_services.sh
#   ./scripts/verify_all_services.sh --verbose

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

# Track overall status
ALL_HEALTHY=true

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  HyperAgent Service Health Check${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to check HTTP endpoint
check_http() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    if command -v curl &> /dev/null; then
        if curl -s -f -o /dev/null -w "%{http_code}" "$url" | grep -q "^${expected_status}$"; then
            echo -e "${GREEN}✓${NC} ${name} is healthy"
            if [ "$VERBOSE" = true ]; then
                echo "  URL: $url"
            fi
            return 0
        else
            echo -e "${RED}✗${NC} ${name} is not responding"
            if [ "$VERBOSE" = true ]; then
                echo "  URL: $url"
                echo "  Expected status: $expected_status"
            fi
            return 1
        fi
    elif command -v wget &> /dev/null; then
        if wget -q --spider "$url" 2>/dev/null; then
            echo -e "${GREEN}✓${NC} ${name} is healthy"
            if [ "$VERBOSE" = true ]; then
                echo "  URL: $url"
            fi
            return 0
        else
            echo -e "${RED}✗${NC} ${name} is not responding"
            if [ "$VERBOSE" = true ]; then
                echo "  URL: $url"
            fi
            return 1
        fi
    else
        echo -e "${YELLOW}⚠${NC} Cannot check ${name} (curl/wget not available)"
        return 1
    fi
}

# Function to check TCP port
check_port() {
    local name=$1
    local host=$2
    local port=$3
    
    if command -v nc &> /dev/null; then
        if nc -z "$host" "$port" 2>/dev/null; then
            echo -e "${GREEN}✓${NC} ${name} is listening on ${host}:${port}"
            return 0
        else
            echo -e "${RED}✗${NC} ${name} is not listening on ${host}:${port}"
            return 1
        fi
    elif command -v timeout &> /dev/null && command -v bash &> /dev/null; then
        if timeout 1 bash -c "echo > /dev/tcp/${host}/${port}" 2>/dev/null; then
            echo -e "${GREEN}✓${NC} ${name} is listening on ${host}:${port}"
            return 0
        else
            echo -e "${RED}✗${NC} ${name} is not listening on ${host}:${port}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠${NC} Cannot check ${name} port (nc/timeout not available)"
        return 1
    fi
}

# Check PostgreSQL
echo -e "${BLUE}Checking PostgreSQL...${NC}"
if check_port "PostgreSQL" "localhost" "5432"; then
    # Try to connect and run a simple query
    if command -v psql &> /dev/null; then
        if PGPASSWORD="${POSTGRES_PASSWORD:-secure_password}" psql -h localhost -U "${POSTGRES_USER:-hyperagent_user}" -d "${POSTGRES_DB:-hyperagent_db}" -c "SELECT 1;" > /dev/null 2>&1; then
            echo -e "${GREEN}  ✓ Database connection successful${NC}"
        else
            echo -e "${YELLOW}  ⚠ Port open but connection failed (check credentials)${NC}"
            ALL_HEALTHY=false
        fi
    fi
else
    ALL_HEALTHY=false
fi
echo ""

# Check Redis
echo -e "${BLUE}Checking Redis...${NC}"
if check_port "Redis" "localhost" "6379"; then
    if command -v redis-cli &> /dev/null; then
        if redis-cli -h localhost ping > /dev/null 2>&1; then
            echo -e "${GREEN}  ✓ Redis connection successful${NC}"
        else
            echo -e "${YELLOW}  ⚠ Port open but connection failed${NC}"
            ALL_HEALTHY=false
        fi
    fi
else
    ALL_HEALTHY=false
fi
echo ""

# Check HyperAgent API
echo -e "${BLUE}Checking HyperAgent API...${NC}"
if check_http "HyperAgent API" "http://localhost:8000/api/v1/health" "200"; then
    if [ "$VERBOSE" = true ]; then
        if command -v curl &> /dev/null; then
            echo "  Response:"
            curl -s http://localhost:8000/api/v1/health | python3 -m json.tool 2>/dev/null || echo "  (JSON parsing failed)"
        fi
    fi
else
    ALL_HEALTHY=false
fi
echo ""

# Check x402 Verifier
echo -e "${BLUE}Checking x402 Verifier...${NC}"
if check_http "x402 Verifier" "http://localhost:3002/health" "200"; then
    # Service is healthy
    :
else
    echo -e "${YELLOW}  ⚠ x402 Verifier not responding (optional service)${NC}"
    # Don't fail overall check for optional service
fi
echo ""

# Check Prometheus (optional)
echo -e "${BLUE}Checking Prometheus (optional)...${NC}"
if check_http "Prometheus" "http://localhost:9090/-/healthy" "200"; then
    # Service is healthy
    :
else
    echo -e "${YELLOW}  ⚠ Prometheus not responding (optional service)${NC}"
    # Don't fail overall check for optional service
fi
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
if [ "$ALL_HEALTHY" = true ]; then
    echo -e "${GREEN}✓ All required services are healthy${NC}"
    exit 0
else
    echo -e "${RED}✗ Some services are not healthy${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check if services are running: docker-compose ps"
    echo "  2. View service logs: docker-compose logs -f <service>"
    echo "  3. Start services: docker-compose up -d"
    echo "  4. Or use hybrid setup: ./scripts/start-backend.sh"
    exit 1
fi

