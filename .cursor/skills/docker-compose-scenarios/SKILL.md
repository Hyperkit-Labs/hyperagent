---
name: docker-compose-scenarios
description: When and how Docker Compose builds, starts, and recreates containers in this repo. Use when running make build/up/down/rebuild/restart or changing code/env/compose.
---

# Docker Compose scenarios (HyperAgent)

When and how images and containers are built, reused, or recreated. All commands from **repo root**; compose and env are under `infra/docker` and `../../.env`.

## Purpose

- Avoid unnecessary full rebuilds.
- Know when containers will be recreated vs reused.
- Choose the right command after code, env, or compose changes.

## When to use

- After pulling code or changing Dockerfiles/compose.
- After changing service code (orchestrator, api-gateway, etc.).
- After changing `.env` or compose `environment`/`env_file`.
- When cleaning up or doing a full reset.

## Commands (from repo root)

| Command        | Under the hood                    | Effect on images           | Effect on containers        |
|----------------|-----------------------------------|----------------------------|-----------------------------|
| `make build`   | `docker compose build`           | Rebuild only if context/Dockerfile changed (cache). | None. |
| `make rebuild` | `docker compose build --no-cache`| Rebuild all images from scratch. | None. |
| `make up`      | `docker compose up -d`           | Build if image missing.   | Create or start; recreate if image changed. |
| `make down`    | `docker compose down`            | None.                      | Stop and remove containers (and compose networks). |
| `make restart` | `docker compose restart`         | None.                      | Restart existing containers (same image). |

## Scenarios

### 1. First run (no images, no containers)

- Run: `make up` (or `make build` then `make up`).
- Result: Images are built (or pulled), then all containers are created and started.
- Optional: `make migrate` to verify DB; `make run-web` to run Studio on host.

### 2. Containers already exist; no code or compose changes

- Run: `make build`.
- Result: Build runs; cache hits for all services → no image changes → **no containers recreated**.
- Run: `make up`.
- Result: All services already running → Compose does nothing (or starts any stopped container). **No rebuild, no recreate.**

### 3. You changed service code (e.g. orchestrator, api-gateway)

- Run: `make build`.
- Result: Only services whose **build context** changed get rebuilt (e.g. orchestrator image rebuilt; others cached). Containers unchanged.
- Run: `make up` (or `make restart`).
- Result: Services with **new image IDs** get **recreated**; others keep existing containers.
- Note: Many services use **volumes** (e.g. `../../services/orchestrator:/app`). Code on host is live in the container; for those, **restart** is often enough without rebuilding: `make restart`.

### 4. You changed only `.env` or compose `environment`/`env_file`

- Images unchanged. Containers still have old env until recreated.
- Run: `make down` then `make up` (recreate all), or `make up --force-recreate` (recreate all), or restart specific service.
- Result: New env loaded into new/restarted containers.

### 5. You changed a Dockerfile or compose `build` (e.g. base image, build args)

- Run: `make build` (or `make rebuild` for that service or all).
- Result: Affected images rebuild; others use cache.
- Run: `make up`.
- Result: Containers for rebuilt images are recreated; rest reused.

### 6. You want a clean slate (no cache, fresh containers)

- Run: `make down` → `make rebuild` → `make up`.
- Result: All images rebuilt from scratch; all containers recreated.
- Optional: `docker system prune -f` to remove unused images/containers (use with care).

### 7. You only want to restart processes (no rebuild)

- Run: `make restart`.
- Result: All compose containers restarted with **same image**. Use after env change if you already recreated (e.g. `make down && make up`) or for a quick process restart.

### 8. Studio (frontend) is not in compose

- Studio is **not** a service in `docker-compose.yml`. It runs on the host: `make run-web`.
- `make build` / `make up` never build or start a Studio container. Orphan `hyperagent-studio` is from an old compose; remove with `docker rm -f hyperagent-studio` if present.

## Quick reference

- **Only rebuild images (use cache):** `make build`.
- **Rebuild all images (no cache):** `make rebuild`.
- **Apply new images / recreate containers:** after `make build` or `make rebuild`, run `make up`.
- **Apply new .env to containers:** `make down && make up` or `make up --force-recreate`.
- **Restart without rebuild:** `make restart`.
- **Stop and remove all stack:** `make down`.

## References

- Compose file: `infra/docker/docker-compose.yml`
- Makefile: repo root `Makefile`
- Env: repo root `.env` (and `infra/docker/README.md`)
