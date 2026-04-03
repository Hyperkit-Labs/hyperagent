# Root Makefile - backend in Docker, frontend (Studio) run locally
# Run from repository root. Docker = API gateway + orchestrator + services only.

# Compose files: local dev vs Contabo production.
# Run from infra/docker so ../../.env and ../../ paths resolve to repo root.
COMPOSE_DIR := infra/docker
COMPOSE_FILE := docker-compose.yml
COMPOSE_FILE_LOCAL := docker-compose.local.yml
ENV_FILE := .env

.PHONY: help up down logs test-minimal test-minimal-all verify-real-server restart migrate install-web run-web install-api run-api build rebuild \
	build-web build-prod check-env validate-prod format-api lint-api type-check-api quality-check-api \
	dogfood-setup dogfood-help dogfood-daemon ai-bom kill-ports

# Free common HyperAgent dev ports (Studio, gateway, services). Uses kill-port (pnpm).
kill-ports:
	@pnpm run kill-ports
	@echo "[+] kill-ports done"

# Dogfood: default scope and date (override: make dogfood-setup SCOPE=settings-byok DOGFOOD_DATE=2025-02-24)
DOGFOOD_SCOPE ?= full
DOGFOOD_DATE ?= $(shell date +%Y-%m-%d 2>/dev/null || echo 0000-00-00)
DOGFOOD_DIR := dogfood-output/$(DOGFOOD_DATE)-$(DOGFOOD_SCOPE)
DOGFOOD_TEMPLATE := .cursor/skills/dogfood/templates/dogfood-report-template.md

help:
	@echo "HyperAgent (run from repo root):"
	@echo ""
	@echo "Development:"
	@echo "  make up          - Start lite backend (5-6 services, cloud Supabase + Upstash)"
	@echo "  make up-full     - Start with roma-service, codegen (legacy)"
	@echo "  make up-tools    - Start with hyperagent-tools (port 9000); set TOOLS_BASE_URL=http://hyperagent-tools:9000 in .env"
	@echo "  make up-local    - Start full stack with local postgres and vectordb (Upstash from .env)"
	@echo "  make up-contabo  - Start Contabo production stack (for local testing)"
	@echo "  make build       - Build Docker images for local dev (run when code changes)"
	@echo "  make rebuild     - Force rebuild Docker images from scratch"
	@echo "  make down        - Stop stack"
	@echo "  make restart     - Restart stack"
	@echo "  make logs        - Follow logs"
	@echo "  make migrate     - Verify DB (local postgres only; use with make up-local)"
	@echo "  make install-web - pnpm install (workspaces)"
	@echo "  make run-web     - Start Next.js Studio locally (make up for backend first)"
	@echo "  make install-api - Create .venv and install API deps (optional)"
	@echo "  make run-api     - Run API locally with uvicorn (optional)"
	@echo ""
	@echo "API code quality (run from root):"
	@echo "  make format-api       - Format API code (Black, isort)"
	@echo "  make lint-api        - Check API formatting and imports"
	@echo "  make type-check-api  - MyPy type check API"
	@echo "  make quality-check-api - Lint + type-check API"
	@echo ""
	@echo "Production:"
	@echo "  make build-prod   - Build production Docker images and frontend"
	@echo "  make build-web    - Build production Next.js frontend"
	@echo "  make validate-prod - Validate production environment variables"
	@echo "  make check-env   - Check environment configuration"
	@echo ""
	@echo "Typical flow:  make up && make migrate && make run-web"
	@echo "After code changes: make build && make restart"
	@echo ""
	@echo "QA / Dogfood:"
	@echo "  make dogfood-setup [SCOPE=full|settings-byok|...] - Create output dir and report template"
	@echo "  make dogfood-help  - Show dogfood checklist and doc link"
	@echo "  make dogfood-daemon - Start agent-browser daemon (Windows fix; run in separate terminal)"
	@echo ""
	@echo "Ports (free local dev listeners; same as: pnpm kill-ports):"
	@echo "  make kill-ports  - Stop processes on 3000,3300,4000,4005,8000,8001,8004,8005,9000"
	@echo ""
	@echo "Security:"
	@echo "  make ai-bom [ARGS=...] - AI-BOM scan (excludes .next for speed; run from repo root)"
	@echo ""
	@echo "Minimal test suite:"
	@echo "  make test-minimal      - Smoke + gateway auth (services must be running)"
	@echo "  make test-minimal-all - Smoke + integration + E2E"
	@echo ""
	@echo "Real-server verification (last gate before production-ready):"
	@echo "  make verify-real-server - Playwright vs live stack. Coolify: GATEWAY_BASE_URL + make run-web. Full-local: make up && make run-web."

# Build Docker images for local dev (run when code changes, before make up)
build:
	@cd $(COMPOSE_DIR) && docker compose --env-file ../../$(ENV_FILE) -f $(COMPOSE_FILE_LOCAL) build
	@echo "[+] Docker images built. Run 'make up' to start."

# Force rebuild from scratch (local dev)
rebuild:
	@cd $(COMPOSE_DIR) && docker compose --env-file ../../$(ENV_FILE) -f $(COMPOSE_FILE_LOCAL) build --no-cache
	@echo "[+] Docker images rebuilt. Run 'make up' to start."

# Start lite stack (5-6 services). ROMA/codegen in-process. Cloud Supabase + Upstash.
up:
	@cd $(COMPOSE_DIR) && docker compose --env-file ../../$(ENV_FILE) -f $(COMPOSE_FILE_LOCAL) up -d
	@echo "[+] Backend up (lite). Gateway: http://localhost:4000  Run Studio: make run-web"
	@echo "    Requires SUPABASE_URL, REDIS_URL (TCP), Upstash REST vars for production gateway. Stop: make down   Logs: make logs"

# Start full stack with roma-service, codegen (legacy).
up-full:
	@cd $(COMPOSE_DIR) && docker compose --env-file ../../$(ENV_FILE) -f $(COMPOSE_FILE_LOCAL) --profile full up -d
	@echo "[+] Backend up (full). Gateway: http://localhost:4000"

# Start with hyperagent-tools (remote heavy toolchain). Set TOOLS_BASE_URL=http://hyperagent-tools:9000 in .env.
up-tools:
	@cd $(COMPOSE_DIR) && docker compose --env-file ../../$(ENV_FILE) -f $(COMPOSE_FILE_LOCAL) --profile tools up -d
	@echo "[+] Backend up with hyperagent-tools. Gateway: http://localhost:4000  Tools: http://localhost:9000"
	@echo "    Ensure TOOLS_BASE_URL=http://hyperagent-tools:9000 in .env for compile/audit to use remote tools"

# Start full stack with local postgres and vectordb (heavier). Redis protocol via Upstash in .env.
up-local:
	@cd $(COMPOSE_DIR) && docker compose --env-file ../../$(ENV_FILE) -f $(COMPOSE_FILE_LOCAL) --profile local-db up -d
	@echo "[+] Backend up (full local). Gateway: http://localhost:4000"
	@echo "    Local postgres:54322  vectordb:6333  REDIS_URL + REST creds in .env"

# Start Contabo production stack (for local testing; Coolify uses infra/docker/docker-compose.yml).
# Run from repo root with --project-directory . so paths resolve correctly.
up-contabo:
	@docker compose --project-directory . --env-file $(ENV_FILE) -f $(COMPOSE_DIR)/$(COMPOSE_FILE) up -d
	@echo "[+] Contabo stack up. Gateway: http://localhost:4000  Sandbox: http://localhost:8005"

# Stop local dev stack
down:
	@cd $(COMPOSE_DIR) && docker compose --env-file ../../$(ENV_FILE) -f $(COMPOSE_FILE_LOCAL) down

# Stop Contabo stack (use after make up-contabo)
down-contabo:
	@docker compose --project-directory . --env-file $(ENV_FILE) -f $(COMPOSE_DIR)/$(COMPOSE_FILE) down

restart:
	@cd $(COMPOSE_DIR) && docker compose --env-file ../../$(ENV_FILE) -f $(COMPOSE_FILE_LOCAL) restart
	@echo "[+] Stack restarted"

logs:
	@cd $(COMPOSE_DIR) && docker compose --env-file ../../$(ENV_FILE) -f $(COMPOSE_FILE_LOCAL) logs -f

# DB migrations: for local postgres only. Run after make up-local.
# For cloud Supabase, apply migrations via Dashboard SQL or: supabase db push
migrate:
	@cd $(COMPOSE_DIR) && docker compose --env-file ../../$(ENV_FILE) -f $(COMPOSE_FILE_LOCAL) --profile local-db exec supabase pg_isready -U postgres -d hyperagent
	@echo "[+] DB reachable. Schema from platform/supabase/migrations applied on first start."

# Frontend
install-web:
	pnpm install
	@echo "[+] Run frontend: make run-web"

run-web:
	pnpm --filter hyperagent-studio dev

# Optional: run API locally without Docker (venv + uvicorn). Use "make up" for standard backend.
install-api:
	@cd apps/hyperagent-api && \
	if [ ! -d .venv ]; then python -m venv .venv; fi && \
	(. .venv/Scripts/activate 2>/dev/null || . .venv/bin/activate) && \
	pip install -q -r requirements.txt && \
	echo "[+] Optional: make run-api to run API without Docker"

run-api:
	@cd apps/hyperagent-api && \
	(. .venv/Scripts/activate 2>/dev/null || . .venv/bin/activate) && \
	uvicorn hyperagent.api.main:app --reload --host 0.0.0.0 --port 8000

# API code quality (run from repo root)
format-api:
	@echo "[*] Formatting API code with Black and isort..."
	@cd apps/hyperagent-api && black hyperagent/ && isort hyperagent/
	@echo "[+] API formatting complete"

lint-api:
	@echo "[*] Checking API formatting and imports..."
	@cd apps/hyperagent-api && black --check hyperagent/ && isort --check-only hyperagent/
	@echo "[+] API lint passed"

type-check-api:
	@echo "[*] Running MyPy on API..."
	@cd apps/hyperagent-api && mypy hyperagent/
	@echo "[+] API type check passed"

quality-check-api: lint-api type-check-api
	@echo "[+] API quality checks complete"

# Production builds
build-web:
	@echo "[*] Building production Next.js frontend..."
	@cd apps/studio && pnpm run build
	@echo "[+] Frontend build complete"

build-prod: build build-web
	@echo "[+] Production build complete"
	@echo "    Backend images: built"
	@echo "    Frontend: built"
	@echo "    Next steps:"
	@echo "      1. Set production environment variables"
	@echo "      2. Run: make validate-prod"
	@echo "      3. Deploy using your deployment method"

# Environment validation
check-env:
	@echo "[*] Checking environment configuration..."
	@if [ -f .env ]; then \
		echo "[+] .env file found"; \
		if grep -q "NEXT_PUBLIC_API_URL" .env && ! grep -q "NEXT_PUBLIC_API_URL=http://localhost" .env; then \
			echo "[+] NEXT_PUBLIC_API_URL is configured"; \
		else \
			echo "[!] Warning: NEXT_PUBLIC_API_URL not set or using localhost"; \
		fi; \
		if grep -q "CORS_ORIGINS" .env && ! grep -q "CORS_ORIGINS=\*" .env; then \
			echo "[+] CORS_ORIGINS is configured"; \
		else \
			echo "[!] Warning: CORS_ORIGINS not set or using wildcard"; \
		fi; \
		if grep -q "JWT_SECRET_KEY" .env && ! grep -q "JWT_SECRET_KEY=change-me" .env; then \
			echo "[+] JWT_SECRET_KEY is configured"; \
		else \
			echo "[!] Warning: JWT_SECRET_KEY not set or using default"; \
		fi; \
		if grep -q "POSTGRES_PASSWORD" .env; then \
			echo "[+] POSTGRES_PASSWORD is configured"; \
		else \
			echo "[!] Warning: POSTGRES_PASSWORD not set"; \
		fi; \
	else \
		echo "[!] Warning: .env file not found"; \
	fi

validate-prod:
	@echo "[*] Validating production environment..."
	@if [ -z "$$NEXT_PUBLIC_API_URL" ]; then \
		echo "[!] Error: NEXT_PUBLIC_API_URL not set"; \
		exit 1; \
	fi
	@if [ -z "$$CORS_ORIGINS" ] || [ "$$CORS_ORIGINS" = "*" ]; then \
		echo "[!] Error: CORS_ORIGINS must be set to explicit origins in production"; \
		exit 1; \
	fi
	@if [ -z "$$JWT_SECRET_KEY" ] || [ "$$JWT_SECRET_KEY" = "change-me-in-production" ]; then \
		echo "[!] Error: JWT_SECRET_KEY must be set to a secure value in production"; \
		exit 1; \
	fi
	@if [ -z "$$POSTGRES_PASSWORD" ]; then \
		echo "[!] Error: POSTGRES_PASSWORD must be set"; \
		exit 1; \
	fi
	@echo "[+] Production environment validation passed"

# Dogfood QA: create output dir, screenshots/videos subdirs, and copy report template.
# Usage: make dogfood-setup [SCOPE=full] [DOGFOOD_DATE=YYYY-MM-DD]
dogfood-setup:
	@mkdir -p $(DOGFOOD_DIR)/screenshots $(DOGFOOD_DIR)/videos
	@if [ -f $(DOGFOOD_TEMPLATE) ]; then \
		cp $(DOGFOOD_TEMPLATE) $(DOGFOOD_DIR)/report.md; \
		echo "[+] Dogfood output: $(DOGFOOD_DIR)/"; \
		echo "    Edit report: $(DOGFOOD_DIR)/report.md (set App name, URL, Session, Scope)"; \
		echo "    Then: agent-browser --session hyperkit-local open http://localhost:3000"; \
	else \
		echo "[!] Template not found: $(DOGFOOD_TEMPLATE)"; exit 1; \
	fi

# Print dogfood checklist and link to full plan.
dogfood-help:
	@echo "Dogfood (exploratory QA) checklist:"
	@echo "  1. Backend and Studio running (make up, make run-web) or staging/prod URL known"
	@echo "  2. make dogfood-setup SCOPE=full  (or SCOPE=settings-byok, etc.)"
	@echo "  3. Edit dogfood-output/.../report.md: App name, URL, Session, Scope"
	@echo "  4. agent-browser --session <name> open <STUDIO_URL> && agent-browser --session <name> wait --load networkidle"
	@echo "  5. If auth required: login, then save state if supported"
	@echo "  6. Orient: screenshot + snapshot; then explore pages, document issues in report.md"
	@echo "  7. Close: agent-browser --session <name> close"
	@echo ""
	@echo "Full plan: docs/qa/dogfood.md"
	@echo "Skill: .cursor/skills/dogfood/SKILL.md (use agent-browser directly, not npx)"
	@echo ""
	@echo "Windows 'Daemon failed to start': run 'make dogfood-daemon' in one terminal; in another, run agent-browser WITHOUT --session (e.g. agent-browser open http://localhost:3000)."

# Start agent-browser daemon manually (Windows workaround when CLI fails to start daemon).
# Run in one terminal and leave it open; run agent-browser open/wait/... in another terminal.
dogfood-daemon:
	@bash scripts/dogfood-daemon.sh

# AI-BOM scan (excludes .next for speed). Requires: pip install ai-bom
# Usage: make ai-bom   or make ai-bom ARGS="--format json -o bom.json"
ai-bom:
	@bash scripts/ai-bom-scan.sh $(ARGS)

# Minimal test suite. Smoke tests require services (make up). Integration/E2E run pytest/playwright.
test-minimal:
	@node scripts/minimal-suite/run.mjs

test-minimal-all:
	@node scripts/minimal-suite/run.mjs --all

# Real-server verification: Playwright E2E against live stack. Prereq: make up && make run-web
verify-real-server:
	@pnpm --filter hyperagent-studio run test:e2e:real-server
