#!/bin/bash
# Security Verification Script
# Verifies Docker image security after updates
#
# Dependencies:
#   - Docker (required)
#   - Docker Scout (optional, but recommended for detailed scans)
#     Install: https://docs.docker.com/scout/
#
# If Docker Scout is not available, script will:
#   - Show basic information about images
#   - Provide manual scan instructions
#   - Exit gracefully without errors

set -e

echo "=========================================="
echo "Docker Image Security Verification"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if Docker Scout is available
check_docker_scout() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: Docker is not installed${NC}"
        exit 1
    fi
    
    if ! docker scout version &> /dev/null; then
        echo -e "${YELLOW}Warning: Docker Scout is not available. Install it from: https://docs.docker.com/scout/${NC}"
        echo "Continuing with basic checks..."
        return 1
    fi
    return 0
}

# Function to scan image and extract vulnerability counts
scan_image() {
    local image=$1
    local name=$2
    
    echo "Scanning ${name} (${image})..."
    echo "----------------------------------------"
    
    if docker scout cves "$image" 2>&1 | tee /tmp/scout_${name}.log; then
        # Extract vulnerability counts
        local critical=$(grep -oP '\d+(?=C)' /tmp/scout_${name}.log | head -1 || echo "0")
        local high=$(grep -oP '\d+(?=H)' /tmp/scout_${name}.log | head -1 || echo "0")
        local medium=$(grep -oP '\d+(?=M)' /tmp/scout_${name}.log | head -1 || echo "0")
        local low=$(grep -oP '\d+(?=L)' /tmp/scout_${name}.log | head -1 || echo "0")
        
        echo ""
        echo "Summary for ${name}:"
        echo "  Critical: ${critical}"
        echo "  High: ${high}"
        echo "  Medium: ${medium}"
        echo "  Low: ${low}"
        echo ""
        
        # Check if image exists locally
        if docker image inspect "$image" &> /dev/null; then
            echo -e "${GREEN}✓ Image exists locally${NC}"
        else
            echo -e "${YELLOW}⚠ Image not found locally. Pull it first: docker pull ${image}${NC}"
        fi
        
        return 0
    else
        echo -e "${RED}✗ Failed to scan ${name}${NC}"
        return 1
    fi
}

# Main execution
main() {
    echo "Checking Docker Scout availability..."
    if ! check_docker_scout; then
        echo "Skipping detailed scans. Basic checks only."
        echo ""
        echo "Images to verify:"
        echo "  - hyperagent:latest"
        echo "  - redis:7.4-alpine"
        echo "  - pgvector/pgvector:pg16"
        echo "  - hyperagent-x402-verifier:latest"
        echo ""
        echo "To scan manually, run:"
        echo "  docker scout cves <image-name>"
        exit 0
    fi
    
    echo -e "${GREEN}✓ Docker Scout is available${NC}"
    echo ""
    
    # Scan all images
    echo "=========================================="
    echo "Scanning Images..."
    echo "=========================================="
    echo ""
    
    scan_image "hyperagent:latest" "HyperAgent"
    scan_image "redis:7.4-alpine" "Redis"
    scan_image "pgvector/pgvector:pg16" "PostgreSQL/pgvector"
    scan_image "hyperagent-x402-verifier:latest" "x402 Verifier"
    
    echo "=========================================="
    echo "Security Verification Complete"
    echo "=========================================="
    echo ""
    echo "Note: Some vulnerabilities may be:"
    echo "  - In compiled binaries (require upstream fixes)"
    echo "  - Marked as 'not fixed' (awaiting Debian/upstream patches)"
    echo "  - Low severity (acceptable risk for most deployments)"
    echo ""
    echo "For detailed recommendations, run:"
    echo "  docker scout recommendations <image-name>"
}

# Run main function
main

