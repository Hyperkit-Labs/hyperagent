#!/bin/sh
cd "$(dirname "$0")"
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-10000}"
