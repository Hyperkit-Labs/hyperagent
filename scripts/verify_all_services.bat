@echo off
REM verify_all_services.bat - Health Check for All Services
REM
REM Verifies that all HyperAgent services are running and healthy:
REM   - PostgreSQL (port 5432)
REM   - Redis (port 6379)
REM   - HyperAgent API (port 8000)
REM   - x402 Verifier (port 3002)
REM   - Prometheus (port 9090, optional)

setlocal enabledelayedexpansion

set "ALL_HEALTHY=true"

echo ========================================
echo   HyperAgent Service Health Check
echo ========================================
echo.

REM Check PostgreSQL
echo Checking PostgreSQL...
netstat -an | findstr ":5432" >nul 2>&1
if errorlevel 1 (
    echo [X] PostgreSQL is not listening on port 5432
    set "ALL_HEALTHY=false"
) else (
    echo [OK] PostgreSQL is listening on port 5432
)
echo.

REM Check Redis
echo Checking Redis...
netstat -an | findstr ":6379" >nul 2>&1
if errorlevel 1 (
    echo [X] Redis is not listening on port 6379
    set "ALL_HEALTHY=false"
) else (
    echo [OK] Redis is listening on port 6379
)
echo.

REM Check HyperAgent API
echo Checking HyperAgent API...
curl -s -f http://localhost:8000/api/v1/health >nul 2>&1
if errorlevel 1 (
    echo [X] HyperAgent API is not responding
    set "ALL_HEALTHY=false"
) else (
    echo [OK] HyperAgent API is healthy
)
echo.

REM Check x402 Verifier
echo Checking x402 Verifier...
curl -s -f http://localhost:3002/health >nul 2>&1
if errorlevel 1 (
    echo [WARN] x402 Verifier is not responding (optional service)
) else (
    echo [OK] x402 Verifier is healthy
)
echo.

REM Check Prometheus (optional)
echo Checking Prometheus (optional)...
curl -s -f http://localhost:9090/-/healthy >nul 2>&1
if errorlevel 1 (
    echo [WARN] Prometheus is not responding (optional service)
) else (
    echo [OK] Prometheus is healthy
)
echo.

REM Summary
echo ========================================
if "!ALL_HEALTHY!"=="true" (
    echo [OK] All required services are healthy
    exit /b 0
) else (
    echo [X] Some services are not healthy
    echo.
    echo Troubleshooting:
    echo   1. Check if services are running: docker-compose ps
    echo   2. View service logs: docker-compose logs -f ^<service^>
    echo   3. Start services: docker-compose up -d
    echo   4. Or use hybrid setup: scripts\start-backend.bat
    exit /b 1
)

endlocal

