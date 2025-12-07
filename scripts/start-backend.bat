@echo off
REM start-backend.bat - Hybrid Development Setup
REM 
REM Starts only backend services in Docker (PostgreSQL, Redis, API, x402-verifier)
REM Frontend should be run locally with: cd frontend && npm run dev
REM
REM This provides the best performance on Windows:
REM - Backend services run in Docker (isolated, consistent)
REM - Frontend runs locally (fast file system, native performance)
REM
REM Usage:
REM   scripts\start-backend.bat          REM Start backend services
REM   scripts\start-backend.bat --logs   REM Start and follow logs
REM   scripts\start-backend.bat --stop   REM Stop backend services

setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
cd /d "%PROJECT_ROOT%"

set "FOLLOW_LOGS=false"
set "STOP_SERVICES=false"

REM Parse arguments
:parse_args
if "%~1"=="" goto end_parse
if "%~1"=="--logs" set "FOLLOW_LOGS=true"
if "%~1"=="--stop" set "STOP_SERVICES=true"
shift
goto parse_args
:end_parse

REM Stop services if requested
if "%STOP_SERVICES%"=="true" (
    echo Stopping backend services...
    docker-compose stop postgres redis hyperagent x402-verifier prometheus 2>nul
    if errorlevel 1 (
        docker compose stop postgres redis hyperagent x402-verifier prometheus 2>nul
    )
    echo Backend services stopped.
    exit /b 0
)

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not running. Please start Docker Desktop.
    exit /b 1
)

REM Use docker compose (v2) if available, otherwise docker-compose (v1)
docker compose version >nul 2>&1
if errorlevel 1 (
    set "DOCKER_COMPOSE=docker-compose"
) else (
    set "DOCKER_COMPOSE=docker compose"
)

echo ========================================
echo   Hybrid Development Setup
echo   Starting Backend Services Only
echo ========================================
echo.

set "SERVICES=postgres redis hyperagent x402-verifier prometheus"

echo Starting backend services:
echo   - PostgreSQL (port 5432)
echo   - Redis (port 6379)
echo   - HyperAgent API (port 8000)
echo   - x402 Verifier (port 3002)
echo   - Prometheus (port 9090)
echo.

echo Building and starting services...
%DOCKER_COMPOSE% up -d %SERVICES%

if errorlevel 1 (
    echo Error: Failed to start services.
    exit /b 1
)

echo.
echo Waiting for services to be healthy...
timeout /t 5 /nobreak >nul

echo.
echo Service Status:
%DOCKER_COMPOSE% ps %SERVICES%

echo.
echo ========================================
echo   Backend services are running!
echo ========================================
echo.
echo Next steps:
echo   1. Open a new terminal
echo   2. Run: cd frontend ^&^& npm run dev
echo   3. Open http://localhost:3000 in your browser
echo.
echo Useful commands:
echo   View logs:     %DOCKER_COMPOSE% logs -f
echo   Stop services: scripts\start-backend.bat --stop
echo   Restart:       scripts\start-backend.bat
echo.

REM Follow logs if requested
if "%FOLLOW_LOGS%"=="true" (
    echo Following logs (Ctrl+C to exit)...
    %DOCKER_COMPOSE% logs -f %SERVICES%
)

endlocal

