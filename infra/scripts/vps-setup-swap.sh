#!/usr/bin/env bash
# Idempotent Linux swap file for small VPS (burst page cache + Coolify deploys). Not a performance fix; avoids hard OOM.
# Usage: sudo ./infra/scripts/vps-setup-swap.sh [size_gib]   default 2 (GiB)
set -euo pipefail
SIZE_GIB="${1:-2}"
if [[ "$(uname -s)" != "Linux" ]]; then
  echo "vps-setup-swap.sh: only runs on Linux; skipping."
  exit 0
fi
if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "Run as root: sudo $0 [size_gib]"
  exit 1
fi
SWAPFILE="/swapfile-hyperagent"
if swapon --show 2>/dev/null | grep -qF "$SWAPFILE"; then
  echo "Swap already active: $SWAPFILE"
  exit 0
fi
if ! [[ "$SIZE_GIB" =~ ^[0-9]+$ ]] || [[ "$SIZE_GIB" -lt 1 ]]; then
  echo "size_gib must be a positive integer (got: $SIZE_GIB)"
  exit 1
fi
SIZE_MB=$((SIZE_GIB * 1024))
if [[ -f "$SWAPFILE" ]]; then
  chmod 600 "$SWAPFILE"
  mkswap "$SWAPFILE" >/dev/null
  swapon "$SWAPFILE"
else
  if command -v fallocate >/dev/null 2>&1; then
    fallocate -l "${SIZE_MB}M" "$SWAPFILE"
  else
    dd if=/dev/zero of="$SWAPFILE" bs=1M count="$SIZE_MB" status=none
  fi
  chmod 600 "$SWAPFILE"
  mkswap "$SWAPFILE" >/dev/null
  swapon "$SWAPFILE"
fi
FSTAB_LINE="$SWAPFILE none swap sw 0 0"
if [[ -f /etc/fstab ]] && ! grep -qF "$SWAPFILE" /etc/fstab; then
  echo "$FSTAB_LINE" >>/etc/fstab
  echo "Added fstab entry for $SWAPFILE"
fi
echo "Swap on: $(swapon --show | grep -F "$SWAPFILE" || true)"
free -h || true
