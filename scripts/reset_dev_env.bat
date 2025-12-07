@echo off
REM reset_dev_env.bat - Reset Development Environment
REM
REM Resets the development environment to a clean state:
REM   - Stops all Docker services
REM   - Removes Docker volumes (database, Redis, etc.)
REM   - Cleans build artifacts
REM
REM WARNING: This will delete all local data including database!

setlocal enabledelayedexpansion

set "KEEP_VOLUMES=false"

REM Parse arguments
:parse_args
if "%~1"=="" goto end_parse
if "%~1"=="--keep-volumes" set "KEEP_VOLUMES=true"
shift
goto parse_args
:end_parse

echo ========================================
echo   Reset Development Environment
echo ========================================
echo.
echo WARNING: This will reset your development environment!
echo.

if "%KEEP_VOLUMES%"=="false" (
    echo This will DELETE all local data including:
    echo   - Database (PostgreSQL)
    echo   - Redis cache
    echo   - Prometheus metrics
    echo   - All Docker volumes
    echo.
)

set /p confirm="Are you sure you want to continue? (type 'yes' to confirm): "
if /i not "!confirm!"=="yes" (
    echo Reset cancelled.
    exit /b 0
)

echo.
echo Starting reset process...
echo.

REM Step 1: Stop Docker services
echo Step 1: Stopping Docker services...
docker-compose down 2>nul
if errorlevel 1 (
    docker compose down 2>nul
)
echo [OK] Docker services stopped
echo.

REM Step 2: Remove Docker volumes
if "%KEEP_VOLUMES%"=="false" (
    echo Step 2: Removing Docker volumes...
    for /f "tokens=2" %%v in ('docker volume ls ^| findstr "hyperagent"') do (
        echo   Removing volume: %%v
        docker volume rm %%v 2>nul
    )
    echo [OK] Docker volumes removed
) else (
    echo Step 2: Keeping Docker volumes (--keep-volumes)
)
echo.

REM Step 3: Clean build artifacts
echo Step 3: Cleaning build artifacts...
call scripts\cleanup_dev.bat 2>nul
if errorlevel 1 (
    REM Fallback cleanup
    for /d /r . %%d in (__pycache__) do (
        if exist "%%d" rmdir /s /q "%%d" 2>nul
    )
    for /r . %%f in (*.pyc) do (
        if exist "%%f" del /q "%%f" 2>nul
    )
    if exist "frontend\.next" rmdir /s /q "frontend\.next" 2>nul
)
echo [OK] Build artifacts cleaned
echo.

REM Summary
echo ========================================
echo [OK] Development environment reset complete
echo.
echo Next steps:
echo   1. Start services: docker-compose up -d
echo   2. Or use hybrid setup: scripts\start-backend.bat
echo   3. Run migrations: alembic upgrade head
echo   4. Seed templates (optional): python scripts\seed_contract_templates.py
echo.

endlocal

