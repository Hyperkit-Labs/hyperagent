#!/bin/bash
# HyperAgent Sanity Check Script
# Runs basic build and smoke tests to verify the system is working

set -e  # Exit on error

echo "🔍 HyperAgent Sanity Check"
echo "=========================="
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Track results
PASSED=0
FAILED=0

# Function to run a check
run_check() {
    local name="$1"
    local command="$2"
    
    echo -e "${YELLOW}▶ ${name}${NC}"
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ ${name} passed${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ ${name} failed${NC}"
        ((FAILED++))
    fi
    echo ""
}

# 1. Check Node.js version
echo "1️⃣  Checking Node.js version..."
NODE_VERSION=$(node --version)
echo "   Node.js: $NODE_VERSION"
if [[ "$NODE_VERSION" =~ ^v([0-9]+) ]] && [ "${BASH_REMATCH[1]}" -ge 18 ]; then
    echo -e "${GREEN}✓ Node.js version is compatible (>= 18)${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ Node.js version must be >= 18${NC}"
    ((FAILED++))
fi
echo ""

# 2. Build CLI
echo "2️⃣  Building CLI..."
run_check "CLI Build" "npm run hyperagent:build"

# 3. Test CLI help
echo "3️⃣  Testing CLI help command..."
run_check "CLI Help" "npm run hyperagent -- --help"

# 4. Build TS API
echo "4️⃣  Building TS API..."
run_check "TS API Build" "cd ts/api && npm run build"

# 5. Build orchestrator
echo "5️⃣  Building Orchestrator..."
run_check "Orchestrator Build" "cd ts/orchestrator && npm run build"

# 6. Check frontend dependencies
echo "6️⃣  Checking frontend dependencies..."
run_check "Frontend Dependencies" "cd frontend && npm list --depth=0"

# 7. Lint frontend (if available)
echo "7️⃣  Linting frontend..."
if [ -f "frontend/package.json" ] && grep -q "\"lint\"" frontend/package.json; then
    run_check "Frontend Lint" "cd frontend && npm run lint"
else
    echo -e "${YELLOW}⊘ Frontend lint script not found, skipping${NC}"
    echo ""
fi

# 8. Test TS API health endpoint (if server is running)
echo "8️⃣  Testing TS API health endpoint..."
if curl -f http://localhost:4000/healthz > /dev/null 2>&1; then
    echo -e "${GREEN}✓ TS API is running and healthy${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⊘ TS API is not running (this is OK if not started)${NC}"
fi
echo ""

# 9. Check environment variables
echo "9️⃣  Checking environment configuration..."
if [ -f ".env" ]; then
    echo -e "${GREEN}✓ .env file exists${NC}"
    ((PASSED++))
    
    # Check for critical env vars
    if grep -q "GEMINI_API_KEY=" .env || grep -q "ANTHROPIC_API_KEY=" .env; then
        echo -e "${GREEN}✓ LLM API keys configured${NC}"
        ((PASSED++))
    else
        echo -e "${YELLOW}⚠ No LLM API keys found in .env${NC}"
    fi
else
    echo -e "${YELLOW}⚠ .env file not found (copy from .env.example)${NC}"
fi
echo ""

# 10. Check database configuration
echo "🔟 Checking database configuration..."
if grep -q "DATABASE_URL=" .env 2>/dev/null; then
    echo -e "${GREEN}✓ DATABASE_URL configured${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ DATABASE_URL not configured${NC}"
fi
echo ""

# Summary
echo "=========================="
echo "📊 Summary"
echo "=========================="
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All sanity checks passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some checks failed. Please review the errors above.${NC}"
    exit 1
fi
