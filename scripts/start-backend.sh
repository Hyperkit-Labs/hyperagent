#!/bin/bash
# start-backend.sh - Hybrid Development Setup
# 
# Starts only backend services in Docker (PostgreSQL, Redis, API, x402-verifier)
# Frontend should be run locally with: cd frontend && npm run dev
#
# This provides the best performance on Windows/WSL2:
# - Backend services run in Docker (isolated, consistent)
# - Frontend runs locally (fast file system, native performance)
#
# Usage:
#   ./scripts/start-backend.sh          # Start backend services
#   ./scripts/start-backend.sh --logs   # Start and follow logs
#   ./scripts/start-backend.sh --stop  # Stop backend services

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Parse arguments
FOLLOW_LOGS=false
STOP_SERVICES=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --logs)
      FOLLOW_LOGS=true
      shift
      ;;
    --stop)
      STOP_SERVICES=true
      shift
      ;;
    *)
      echo -e "${YELLOW}Unknown option: $1${NC}"
      echo "Usage: $0 [--logs] [--stop]"
      exit 1
      ;;
  esac
done

# Stop services if requested
if [ "$STOP_SERVICES" = true ]; then
  echo -e "${BLUE}Stopping backend services...${NC}"
  docker-compose stop postgres redis hyperagent x402-verifier prometheus 2>/dev/null || true
  echo -e "${GREEN}Backend services stopped.${NC}"
  exit 0
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo -e "${YELLOW}Error: Docker is not running. Please start Docker Desktop.${NC}"
  exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
  echo -e "${YELLOW}Error: docker-compose is not installed.${NC}"
  exit 1
fi

# Use docker compose (v2) if available, otherwise docker-compose (v1)
if docker compose version &> /dev/null; then
  DOCKER_COMPOSE="docker compose"
else
  DOCKER_COMPOSE="docker-compose"
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Hybrid Development Setup${NC}"
echo -e "${BLUE}  Starting Backend Services Only${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Services to start (excluding frontend)
SERVICES="postgres redis hyperagent x402-verifier prometheus"

echo -e "${GREEN}Starting backend services:${NC}"
echo "  - PostgreSQL (port 5432)"
echo "  - Redis (port 6379)"
echo "  - HyperAgent API (port 8000)"
echo "  - x402 Verifier (port 3002)"
echo "  - Prometheus (port 9090)"
echo ""

# Start services in detached mode
echo -e "${BLUE}Building and starting services...${NC}"
$DOCKER_COMPOSE up -d $SERVICES

# Wait for services to be healthy
echo ""
echo -e "${BLUE}Waiting for services to be healthy...${NC}"
sleep 5

# Check service health
echo ""
echo -e "${GREEN}Service Status:${NC}"
$DOCKER_COMPOSE ps $SERVICES

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Backend services are running!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Open a new terminal"
echo "  2. Run: ${BLUE}cd frontend && npm run dev${NC}"
echo "  3. Open http://localhost:3000 in your browser"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  View logs:     ${BLUE}$DOCKER_COMPOSE logs -f${NC}"
echo "  Stop services: ${BLUE}./scripts/start-backend.sh --stop${NC}"
echo "  Restart:       ${BLUE}./scripts/start-backend.sh${NC}"
echo ""

# Follow logs if requested
if [ "$FOLLOW_LOGS" = true ]; then
  echo -e "${BLUE}Following logs (Ctrl+C to exit)...${NC}"
  $DOCKER_COMPOSE logs -f $SERVICES
fi

