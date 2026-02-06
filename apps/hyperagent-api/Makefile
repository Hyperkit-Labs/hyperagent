# Makefile for HyperAgent Docker operations

.PHONY: help build up down logs restart clean test format lint type-check quality-check

# Default target
help:
	@echo "HyperAgent Commands:"
	@echo ""
	@echo "Docker Commands:"
	@echo "  make build          - Build Docker image"
	@echo "  make up             - Start all services (development)"
	@echo "  make up-build       - Build and start all services"
	@echo "  make up-prod        - Start all services (production)"
	@echo "  make down           - Stop all services"
	@echo "  make logs           - View logs (all services)"
	@echo "  make logs-frontend  - View frontend logs"
	@echo "  make logs-backend   - View backend logs"
	@echo "  make logs-db        - View database logs"
	@echo "  make logs-redis     - View Redis logs"
	@echo "  make restart        - Restart services"
	@echo "  make clean          - Remove containers and volumes"
	@echo "  make test           - Run tests in container"
	@echo "  make shell          - Open shell in container"
	@echo "  make migrate        - Run database migrations"
	@echo "  make health         - Check service health"
	@echo ""
	@echo "Code Quality Commands:"
	@echo "  make format          - Format code with Black and isort"
	@echo "  make lint            - Check code formatting and imports"
	@echo "  make type-check      - Run MyPy type checking"
	@echo "  make quality-check   - Run all code quality checks"

# Build Docker image
build:
	@echo "[*] Building HyperAgent Docker image..."
	docker build -t hyperagent:latest .

# Start development stack
up:
	@echo "[*] Starting HyperAgent development stack..."
	docker-compose up -d
	@echo "[+] Services started. Use 'make logs' to view logs."

# Start development stack with build
up-build:
	@echo "[*] Building and starting HyperAgent development stack..."
	docker-compose up -d --build
	@echo "[+] Services started. Use 'make logs' to view logs."

# Start production stack
up-prod:
	@echo "[*] Starting HyperAgent production stack..."
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
	@echo "[+] Production services started."

# Stop all services
down:
	@echo "[*] Stopping HyperAgent services..."
	docker-compose down

# View logs (all services)
logs:
	docker-compose logs -f

# View logs for specific service
logs-frontend:
	docker-compose logs -f frontend

logs-backend:
	docker-compose logs -f hyperagent

logs-db:
	docker-compose logs -f postgres

logs-redis:
	docker-compose logs -f redis

# Restart services
restart:
	@echo "[*] Restarting HyperAgent services..."
	docker-compose restart

# Clean up containers and volumes
clean:
	@echo "[!] Removing containers and volumes..."
	docker-compose down -v
	@echo "[+] Cleanup complete."

# Run tests in container
test:
	@echo "[*] Running tests in container..."
	docker-compose exec hyperagent pytest tests/ -v

# Open shell in container
shell:
	docker-compose exec hyperagent /bin/bash

# Run database migrations
migrate:
	@echo "[*] Running database migrations..."
	docker-compose exec hyperagent alembic upgrade head

# Health check
health:
	@echo "[*] Checking service health..."
	@docker-compose ps
	@curl -f http://localhost:8000/api/v1/health/basic || echo "[-] API not responding"

# Code Quality Commands
format:
	@echo "[*] Formatting code with Black and isort..."
	black hyperagent/
	isort hyperagent/
	@echo "[+] Code formatting complete"

lint:
	@echo "[*] Checking code formatting and imports..."
	black --check hyperagent/
	isort --check-only hyperagent/
	@echo "[+] Linting checks passed"

type-check:
	@echo "[*] Running MyPy type checking..."
	mypy hyperagent/
	@echo "[+] Type checking passed"

quality-check: lint type-check
	@echo "[*] Running all code quality checks..."
	@bash scripts/check_code_quality.sh || echo "[-] Some checks failed. See output above."
	@echo "[+] All code quality checks complete"

