"""
Docker Sandbox API for Contabo VPS.

Accepts tarball URLs from the orchestrator, spawns ephemeral Docker
containers with the extracted project, and returns preview URLs. Validates
requests via Bearer token (OPENSANDBOX_API_KEY).
"""

from __future__ import annotations

import asyncio
import ipaddress
import logging
import os
import shutil
import socket
import subprocess
import sys
import tarfile
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

API_KEY = (
    os.environ.get("OPENSANDBOX_API_KEY") or os.environ.get("SANDBOX_API_KEY") or ""
).strip()
PREVIEW_BASE_URL = (os.environ.get("PREVIEW_BASE_URL") or "").rstrip("/")
WORK_DIR = Path(os.environ.get("SANDBOX_WORK_DIR", "/var/lib/sandbox-docker"))

app = FastAPI(title="HyperAgent Docker Sandbox API", version="0.1.0")
security = HTTPBearer(auto_error=False)

_sandboxes: dict[str, dict] = {}


def _verify_api_key(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> None:
    if not API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Sandbox API not configured: set OPENSANDBOX_API_KEY",
        )
    if not credentials or credentials.credentials != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


ALLOWED_PORTS = {80, 3000, 4000, 8080, 8545}


class SandboxCreateBody(BaseModel):
    tarball_url: str = Field(..., description="URL of gzipped tarball to run")
    timeout_minutes: int = Field(default=30, ge=1, le=120)
    port: int = Field(
        default=8545, description="Port to expose (8545 Hardhat, 3000 frontend)"
    )


class SandboxCreateResponse(BaseModel):
    sandbox_id: str
    url: str
    status: str


def _run_sync(
    cmd: list[str], cwd: str | None = None, timeout: int = 120
) -> tuple[int, str, str]:
    try:
        r = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return r.returncode, r.stdout or "", r.stderr or ""
    except subprocess.TimeoutExpired:
        return -1, "", "timeout"
    except Exception as e:
        return -1, "", str(e)


_GNU_META = frozenset({tarfile.GNUTYPE_LONGNAME, tarfile.GNUTYPE_LONGLINK})


def _validate_tarball_member(member: tarfile.TarInfo) -> None:
    if member.type in _GNU_META:
        return
    name = member.name
    parts = Path(name).parts
    if not name or name.startswith(("/", "\\")):
        raise HTTPException(
            status_code=400, detail="Invalid tarball: absolute paths are not allowed"
        )
    if len(name) > 1 and name[1] == ":":
        raise HTTPException(
            status_code=400, detail="Invalid tarball: absolute paths are not allowed"
        )
    if ".." in parts:
        raise HTTPException(
            status_code=400,
            detail="Invalid tarball: path traversal entries are not allowed",
        )
    if member.issym() or member.islnk():
        raise HTTPException(
            status_code=400, detail="Invalid tarball: symlinks are not allowed"
        )
    if member.isdev() or member.isfifo():
        raise HTTPException(
            status_code=400,
            detail="Invalid tarball: device and FIFO entries are not allowed",
        )


def _extract_tarball(tarball_path: Path, extract_dir: Path) -> None:
    try:
        with tarfile.open(tarball_path, mode="r:gz") as archive:
            members = archive.getmembers()
            if not members:
                raise HTTPException(
                    status_code=400, detail="Invalid tarball: archive is empty"
                )
            for member in members:
                _validate_tarball_member(member)
            to_extract = [m for m in members if m.type not in _GNU_META]
            extract_kw: dict = {"numeric_owner": False}
            if sys.version_info >= (3, 12):
                extract_kw["filter"] = "data"
            archive.extractall(path=extract_dir, members=to_extract, **extract_kw)
    except HTTPException:
        raise
    except tarfile.TarError as e:
        raise HTTPException(status_code=400, detail=f"Invalid tarball: {e}") from e


def _is_public_ip(ip_str: str) -> bool:
    """
    Return True if the given IP address is globally reachable (not private, loopback, etc.).
    """
    try:
        ip_obj = ipaddress.ip_address(ip_str)
    except ValueError:
        return False
    if (
        ip_obj.is_private
        or ip_obj.is_loopback
        or ip_obj.is_link_local
        or ip_obj.is_multicast
    ):
        return False
    if getattr(ip_obj, "is_reserved", False) or getattr(
        ip_obj, "is_unspecified", False
    ):
        return False
    return True


def _validate_tarball_url(tarball_url: str) -> None:
    """
    Validate that the tarball URL uses http/https and resolves only to public IP addresses.
    Raises HTTPException(400) if the URL is not acceptable.
    """
    parsed = urlparse(tarball_url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise HTTPException(
            status_code=400, detail="tarball_url must be an http(s) URL with a hostname"
        )
    hostname = parsed.hostname
    try:
        addr_info = socket.getaddrinfo(
            hostname, parsed.port or 80, proto=socket.IPPROTO_TCP
        )
    except socket.gaierror:
        raise HTTPException(
            status_code=400, detail="tarball_url host could not be resolved"
        )
    ips = {ai[4][0] for ai in addr_info if ai and ai[4]}
    if not ips:
        raise HTTPException(
            status_code=400, detail="tarball_url host has no IP addresses"
        )
    for ip in ips:
        if not _is_public_ip(ip):
            raise HTTPException(
                status_code=400,
                detail="tarball_url must not point to private or loopback addresses",
            )


async def _create_sandbox_container(
    tarball_url: str, timeout_minutes: int, port: int
) -> tuple[str, int]:
    _validate_tarball_url(tarball_url)
    sandbox_id = f"sandbox-{uuid.uuid4().hex[:12]}"
    extract_dir = WORK_DIR / sandbox_id
    extract_dir.mkdir(parents=True, exist_ok=True)
    try:
        _validate_tarball_url(tarball_url)
        tarball_path = extract_dir / "project.tar.gz"
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.get(tarball_url)
            r.raise_for_status()
            tarball_path.write_bytes(r.content)

        try:
            _extract_tarball(tarball_path, extract_dir)
        except HTTPException:
            shutil.rmtree(extract_dir, ignore_errors=True)
            raise

        if not (extract_dir / "package.json").exists():
            shutil.rmtree(extract_dir, ignore_errors=True)
            raise HTTPException(
                status_code=400, detail="Tarball must contain package.json"
            )

        host_port = 0
        for p in range(19000, 65535):
            if p not in {
                s.get("host_port") for s in _sandboxes.values() if s.get("host_port")
            }:
                host_port = p
                break
        if host_port == 0:
            shutil.rmtree(extract_dir, ignore_errors=True)
            raise HTTPException(status_code=503, detail="No available ports")

        timeout_sec = timeout_minutes * 60
        cmd = [
            "docker",
            "run",
            "-d",
            "--rm",
            "-p",
            f"{host_port}:{port}",
            "-v",
            f"{extract_dir}:/app",
            "-w",
            "/app",
            "node:22-alpine",
            "sh",
            "-c",
            "npm install && (npm run start 2>/dev/null || npm start 2>/dev/null || npx hardhat node)",
        ]

        code, out, err = _run_sync(cmd, timeout=30)
        if code != 0:
            shutil.rmtree(extract_dir, ignore_errors=True)
            raise HTTPException(
                status_code=500, detail=f"docker run failed: {err or out}"
            )

        container_id = out.strip()
        if not container_id or len(container_id) < 10:
            shutil.rmtree(extract_dir, ignore_errors=True)
            raise HTTPException(status_code=500, detail="Failed to get container ID")

        url = (
            f"{PREVIEW_BASE_URL}/preview/{sandbox_id}"
            if PREVIEW_BASE_URL
            else f"http://localhost:{host_port}"
        )
        _sandboxes[sandbox_id] = {
            "container_id": container_id,
            "host_port": host_port,
            "extract_dir": str(extract_dir),
            "url": url,
            "created_at": time.time(),
            "timeout_sec": timeout_sec,
        }

        asyncio.create_task(_cleanup_after_timeout(sandbox_id, timeout_sec))
        return sandbox_id, host_port
    except HTTPException:
        raise
    except Exception as e:
        shutil.rmtree(extract_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(e)[:200])


async def _cleanup_after_timeout(sandbox_id: str, timeout_sec: int) -> None:
    await asyncio.sleep(timeout_sec)
    meta = _sandboxes.pop(sandbox_id, None)
    if meta:
        if meta.get("container_id"):
            try:
                subprocess.run(
                    ["docker", "stop", meta["container_id"]],
                    capture_output=True,
                    timeout=10,
                )
            except Exception:
                pass
        extract_dir = meta.get("extract_dir")
        if extract_dir and Path(extract_dir).exists():
            try:
                shutil.rmtree(extract_dir, ignore_errors=True)
            except Exception:
                pass


async def _preview_proxy_impl(sandbox_id: str, path: str, request: Request):
    """Proxy requests to the sandbox container."""
    meta = _sandboxes.get(sandbox_id)
    if not meta:
        raise HTTPException(status_code=404, detail="Sandbox not found or expired")
    port = meta.get("host_port")
    if not port:
        raise HTTPException(status_code=404, detail="Sandbox not found")
    target = f"http://127.0.0.1:{port}/{path}" if path else f"http://127.0.0.1:{port}/"
    if request.url.query:
        target += f"?{request.url.query}"
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.request(
            request.method,
            target,
            content=(
                await request.body()
                if request.method in ("POST", "PUT", "PATCH")
                else None
            ),
        )
    from starlette.responses import Response

    headers = {
        k: v
        for k, v in r.headers.items()
        if k.lower() not in ("transfer-encoding", "connection")
    }
    return Response(content=r.content, status_code=r.status_code, headers=headers)


@app.post("/sandbox/create", response_model=SandboxCreateResponse)
async def sandbox_create(
    body: SandboxCreateBody,
    _: None = Depends(_verify_api_key),
) -> SandboxCreateResponse:
    """Create an ephemeral sandbox from a tarball URL. Returns preview URL."""
    # Validate requested container port to avoid passing arbitrary values to docker.
    try:
        requested_port = int(body.port)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid port: must be an integer")
    if not (1 <= requested_port <= 65535):
        raise HTTPException(
            status_code=400, detail="Invalid port: must be between 1 and 65535"
        )
    if requested_port not in ALLOWED_PORTS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid port: must be one of {sorted(ALLOWED_PORTS)}",
        )

    sandbox_id, host_port = await _create_sandbox_container(
        body.tarball_url,
        body.timeout_minutes,
        requested_port,
    )
    meta = _sandboxes.get(sandbox_id, {})
    url = meta.get("url", f"http://localhost:{host_port}")
    return SandboxCreateResponse(
        sandbox_id=sandbox_id,
        url=url,
        status="running",
    )


@app.api_route(
    "/preview/{sandbox_id}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"]
)
@app.api_route(
    "/preview/{sandbox_id}/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
)
async def preview_proxy(
    sandbox_id: str,
    request: Request,
    path: str = "",
):
    """Proxy requests to the sandbox container. Used when PREVIEW_BASE_URL points here."""
    return await _preview_proxy_impl(sandbox_id, path, request)


@app.delete("/sandbox/{sandbox_id}")
async def sandbox_stop(
    sandbox_id: str,
    _: None = Depends(_verify_api_key),
) -> dict:
    """Stop and remove a sandbox."""
    meta = _sandboxes.pop(sandbox_id, None)
    if not meta:
        raise HTTPException(status_code=404, detail="Sandbox not found")
    cid = meta.get("container_id")
    if cid:
        try:
            subprocess.run(["docker", "stop", cid], capture_output=True, timeout=10)
        except Exception:
            pass
    return {"sandbox_id": sandbox_id, "status": "stopped"}


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "sandbox-docker"}


@app.get("/")
def root() -> dict:
    return {"service": "sandbox-docker", "docs": "/docs"}
