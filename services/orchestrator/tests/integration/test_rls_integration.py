"""
RLS integration tests: verify backend-only tables deny non-service_role and allow service_role.

Requires:
  - Full Supabase migrations applied to DATABASE_URL (owner, typically postgres).
  - supabase/scripts/ci-rls-test-users.sql applied once (creates rls_ci_service, rls_ci_anon).
  - Env RLS_INTEGRATION_TESTS=1 (set automatically in CI after setup).

Run locally (DATABASE_URL is read from repo root .env if not exported):
  pnpm db:apply-migrations
  pnpm db:ci-setup-rls-test-users
  cd services/orchestrator && RLS_INTEGRATION_TESTS=1 pytest tests/integration/test_rls_integration.py -v
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path

import pytest

pytest.importorskip("psycopg")

RUN = os.environ.get("RLS_INTEGRATION_TESTS", "").strip() == "1"

# integration -> tests -> orchestrator -> services -> repo root
_REPO_ROOT = Path(__file__).resolve().parents[3]
_DOTENV_LOADED = False


def _load_dotenv_from_repo_root() -> None:
    """Match Node migration scripts: load root .env so DATABASE_URL is set when pytest runs without export."""
    global _DOTENV_LOADED
    if _DOTENV_LOADED:
        return
    _DOTENV_LOADED = True
    if os.environ.get("DATABASE_URL", "").strip():
        return
    try:
        from dotenv import load_dotenv

        env_path = _REPO_ROOT / ".env"
        if env_path.is_file():
            load_dotenv(env_path)
    except ImportError:
        pass


def _base_url() -> str | None:
    _load_dotenv_from_repo_root()
    u = os.environ.get("DATABASE_URL", "").strip()
    return u or None


def _service_url() -> str:
    base = _base_url()
    if not base:
        pytest.skip("DATABASE_URL not set")
    # Replace userinfo with rls_ci_service (password from ci-rls-test-users.sql)
    from urllib.parse import urlparse, urlunparse

    p = urlparse(base)
    host = p.hostname or "localhost"
    port = p.port or 5432
    return f"postgresql://rls_ci_service:rls_ci_service@{host}:{port}{p.path or '/'}"


def _anon_url() -> str:
    base = _base_url()
    if not base:
        pytest.skip("DATABASE_URL not set")
    from urllib.parse import urlparse

    p = urlparse(base)
    host = p.hostname or "localhost"
    port = p.port or 5432
    return f"postgresql://rls_ci_anon:rls_ci_anon@{host}:{port}{p.path or '/'}"


@pytest.mark.skipif(not RUN, reason="Set RLS_INTEGRATION_TESTS=1 and apply ci-rls-test-users.sql")
class TestRLSPoliciesPublic:
    def test_service_role_sees_rows_after_seed(self) -> None:
        import psycopg

        owner = _base_url()
        if not owner:
            pytest.skip("DATABASE_URL unset and not found in repo root .env")
        seed_id = str(uuid.uuid4())
        try:
            with psycopg.connect(owner, autocommit=True) as oc:
                with oc.cursor() as cur:
                    cur.execute(
                        "INSERT INTO public.projects (id, name, status) VALUES (%s::uuid, %s, %s)",
                        (seed_id, "rls-integration-seed", "draft"),
                    )

            with psycopg.connect(_service_url()) as sc:
                with sc.cursor() as cur:
                    cur.execute("SET ROLE service_role")
                    cur.execute(
                        "SELECT count(*) FROM public.projects WHERE id = %s::uuid",
                        (seed_id,),
                    )
                    n = cur.fetchone()[0]
                assert n == 1
        finally:
            with psycopg.connect(owner, autocommit=True) as oc:
                with oc.cursor() as cur:
                    cur.execute("DELETE FROM public.projects WHERE id = %s::uuid", (seed_id,))

    def test_non_service_role_select_returns_zero_projects(self) -> None:
        import psycopg

        with psycopg.connect(_anon_url()) as ac:
            with ac.cursor() as cur:
                cur.execute("SELECT count(*) FROM public.projects")
                n = cur.fetchone()[0]
        assert n == 0

    def test_service_role_without_set_role_sees_zero_for_strict_backend_tables(self) -> None:
        """Policies are TO service_role; NOINHERIT user must SET ROLE to match."""
        import psycopg

        with psycopg.connect(_service_url()) as sc:
            with sc.cursor() as cur:
                cur.execute("SELECT count(*) FROM public.projects")
                n_without = cur.fetchone()[0]
                cur.execute("SET ROLE service_role")
                cur.execute("SELECT count(*) FROM public.projects")
                n_with = cur.fetchone()[0]
        assert n_without == 0
        assert n_with >= 0
