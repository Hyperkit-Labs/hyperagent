@echo off
REM cleanup_dev.bat - Development Environment Cleanup
REM
REM Cleans up development artifacts:
REM   - Python cache files (__pycache__, *.pyc)
REM   - Node.js cache and build artifacts
REM   - Log files
REM   - Temporary files
REM   - Docker build cache (optional)

setlocal enabledelayedexpansion

set "CLEAN_DOCKER=false"
set "CLEAN_NODE_MODULES=false"

REM Parse arguments
:parse_args
if "%~1"=="" goto end_parse
if "%~1"=="--docker" set "CLEAN_DOCKER=true"
if "%~1"=="--all" set "CLEAN_NODE_MODULES=true"
shift
goto parse_args
:end_parse

echo ========================================
echo   Development Environment Cleanup
echo ========================================
echo.

REM Clean Python cache
echo Cleaning Python cache files...
for /d /r . %%d in (__pycache__) do (
    if exist "%%d" (
        echo   Removing: %%d
        rmdir /s /q "%%d" 2>nul
    )
)

for /r . %%f in (*.pyc) do (
    if exist "%%f" (
        del /q "%%f" 2>nul
    )
)

for /r . %%f in (*.pyo) do (
    if exist "%%f" (
        del /q "%%f" 2>nul
    )
)

echo [OK] Python cache cleaned
echo.

REM Clean Python build artifacts
echo Cleaning Python build artifacts...
for /d /r . %%d in (*.egg-info) do (
    if exist "%%d" (
        echo   Removing: %%d
        rmdir /s /q "%%d" 2>nul
    )
)

if exist "dist" (
    echo   Removing: dist
    rmdir /s /q "dist" 2>nul
)

if exist "build" (
    echo   Removing: build
    rmdir /s /q "build" 2>nul
)

echo [OK] Python build artifacts cleaned
echo.

REM Clean Node.js artifacts
echo Cleaning Node.js build artifacts...
if exist "frontend\.next" (
    echo   Removing: frontend\.next
    rmdir /s /q "frontend\.next" 2>nul
)

if "%CLEAN_NODE_MODULES%"=="true" (
    if exist "frontend\node_modules" (
        echo   Removing: frontend\node_modules
        rmdir /s /q "frontend\node_modules" 2>nul
    )
) else (
    echo [SKIP] node_modules (use --all to clean)
)

echo [OK] Node.js artifacts cleaned
echo.

REM Clean log files (older than 7 days)
echo Cleaning old log files...
if exist "logs" (
    forfiles /p logs /m *.log /d -7 /c "cmd /c del @path" 2>nul
    echo [OK] Old log files cleaned (kept last 7 days)
) else (
    echo [SKIP] No logs directory found
)
echo.

REM Clean temporary files
echo Cleaning temporary files...
for /r . %%f in (*.tmp) do (
    if exist "%%f" (
        del /q "%%f" 2>nul
    )
)

for /r . %%f in (.DS_Store) do (
    if exist "%%f" (
        del /q "%%f" 2>nul
    )
)

echo [OK] Temporary files cleaned
echo.

REM Clean Docker cache (optional)
if "%CLEAN_DOCKER%"=="true" (
    echo Cleaning Docker build cache...
    docker builder prune -f 2>nul
    if errorlevel 1 (
        echo [WARN] Docker not found or failed
    ) else (
        echo [OK] Docker cache cleaned
    )
    echo.
)

REM Summary
echo ========================================
echo [OK] Cleanup completed
echo.
echo To clean everything including node_modules:
echo   scripts\cleanup_dev.bat --all
echo.
echo To also clean Docker cache:
echo   scripts\cleanup_dev.bat --docker

endlocal

