"""Tar extraction and port allowlist (PR #432 hardening)."""

from __future__ import annotations

import importlib
import io
import tarfile
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient


@pytest.fixture
def main_mod(monkeypatch, tmp_path):
    monkeypatch.setenv("OPENSANDBOX_API_KEY", "unit-test-key")
    monkeypatch.setenv("SANDBOX_WORK_DIR", str(tmp_path))
    import main

    importlib.reload(main)
    return main


def _gzip_tar_bytes(members_build) -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tf:
        members_build(tf)
    return buf.getvalue()


def test_extract_accepts_flat_package_json(main_mod, tmp_path):
    def build(tf: tarfile.TarFile) -> None:
        data = b'{"name":"p"}'
        ti = tarfile.TarInfo("package.json")
        ti.size = len(data)
        tf.addfile(ti, io.BytesIO(data))

    archive = tmp_path / "p.tar.gz"
    dest = tmp_path / "out"
    dest.mkdir()
    archive.write_bytes(_gzip_tar_bytes(build))
    main_mod._extract_tarball(archive, dest)
    assert (dest / "package.json").is_file()


def test_extract_rejects_dotdot_path(main_mod, tmp_path):
    def build(tf: tarfile.TarFile) -> None:
        data = b"x"
        ti = tarfile.TarInfo("pkg/../evil.txt")
        ti.size = len(data)
        tf.addfile(ti, io.BytesIO(data))

    archive = tmp_path / "bad.tar.gz"
    dest = tmp_path / "out"
    dest.mkdir()
    archive.write_bytes(_gzip_tar_bytes(build))
    with pytest.raises(HTTPException) as ei:
        main_mod._extract_tarball(archive, dest)
    assert ei.value.status_code == 400


def test_extract_rejects_absolute_path(main_mod, tmp_path):
    def build(tf: tarfile.TarFile) -> None:
        data = b"x"
        ti = tarfile.TarInfo("/etc/passwd")
        ti.size = len(data)
        tf.addfile(ti, io.BytesIO(data))

    archive = tmp_path / "bad.tar.gz"
    dest = tmp_path / "out"
    dest.mkdir()
    archive.write_bytes(_gzip_tar_bytes(build))
    with pytest.raises(HTTPException) as ei:
        main_mod._extract_tarball(archive, dest)
    assert ei.value.status_code == 400


def test_extract_rejects_symlink(main_mod, tmp_path):
    def build(tf: tarfile.TarFile) -> None:
        ti = tarfile.TarInfo("link")
        ti.type = tarfile.SYMTYPE
        ti.linkname = "package.json"
        ti.size = 0
        tf.addfile(ti)

    archive = tmp_path / "bad.tar.gz"
    dest = tmp_path / "out"
    dest.mkdir()
    archive.write_bytes(_gzip_tar_bytes(build))
    with pytest.raises(HTTPException) as ei:
        main_mod._extract_tarball(archive, dest)
    assert ei.value.status_code == 400
    assert "symlink" in (ei.value.detail or "").lower()


def test_sandbox_create_rejects_disallowed_port(main_mod):
    client = TestClient(main_mod.app)
    r = client.post(
        "/sandbox/create",
        json={
            "tarball_url": "https://example.com/x.tgz",
            "port": 22,
            "timeout_minutes": 30,
        },
        headers={"Authorization": "Bearer unit-test-key"},
    )
    assert r.status_code == 400
    body = r.json()
    assert "8545" in str(body) or "port" in str(body).lower()


def test_sandbox_create_accepts_allowed_port(main_mod, monkeypatch):
    async def fake_create(url: str, timeout: int, port: int):
        return "sandbox-fake123", 19001

    monkeypatch.setattr(main_mod, "_create_sandbox_container", fake_create)
    client = TestClient(main_mod.app)
    r = client.post(
        "/sandbox/create",
        json={
            "tarball_url": "https://example.com/x.tgz",
            "port": 8545,
            "timeout_minutes": 30,
        },
        headers={"Authorization": "Bearer unit-test-key"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["sandbox_id"] == "sandbox-fake123"


def test_is_public_ip_rejects_loopback(main_mod):
    assert main_mod._is_public_ip("127.0.0.1") is False
    assert main_mod._is_public_ip("8.8.8.8") is True
