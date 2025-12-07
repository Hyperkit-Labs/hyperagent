@echo off
REM check_dependencies.bat - Verify All Required Dependencies
REM
REM Checks that all required dependencies are installed:
REM   - Python 3.10+
REM   - Node.js 18+
REM   - Docker (optional, for containerized setup)
REM   - PostgreSQL client tools (optional)
REM   - Redis client tools (optional)

setlocal enabledelayedexpansion

set "ALL_OK=true"

echo ========================================
echo   Dependency Check
echo ========================================
echo.

REM Check Python
echo Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    python3 --version >nul 2>&1
    if errorlevel 1 (
        echo [X] Python is NOT installed (REQUIRED)
        set "ALL_OK=false"
    ) else (
        echo [OK] Python is installed
        python3 --version
    )
) else (
    echo [OK] Python is installed
    python --version
)
echo.

REM Check pip
echo Checking pip...
pip --version >nul 2>&1
if errorlevel 1 (
    pip3 --version >nul 2>&1
    if errorlevel 1 (
        echo [X] pip is NOT installed (REQUIRED)
        set "ALL_OK=false"
    ) else (
        echo [OK] pip is installed
    )
) else (
    echo [OK] pip is installed
)
echo.

REM Check Node.js
echo Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [X] Node.js is NOT installed (REQUIRED)
    set "ALL_OK=false"
) else (
    echo [OK] Node.js is installed
    node --version
)
echo.

REM Check npm
echo Checking npm...
npm --version >nul 2>&1
if errorlevel 1 (
    echo [X] npm is NOT installed (REQUIRED)
    set "ALL_OK=false"
) else (
    echo [OK] npm is installed
    npm --version
)
echo.

REM Check Git
echo Checking Git...
git --version >nul 2>&1
if errorlevel 1 (
    echo [X] Git is NOT installed (REQUIRED)
    set "ALL_OK=false"
) else (
    echo [OK] Git is installed
    git --version
)
echo.

REM Optional: Docker
echo Checking Docker (optional)...
docker --version >nul 2>&1
if errorlevel 1 (
    echo [WARN] Docker is not installed (optional)
) else (
    echo [OK] Docker is installed
    docker --version
    
    REM Check if Docker is running
    docker info >nul 2>&1
    if errorlevel 1 (
        echo [WARN] Docker daemon is not running
    ) else (
        echo [OK] Docker daemon is running
    )
)
echo.

REM Optional: Docker Compose
echo Checking Docker Compose (optional)...
docker-compose --version >nul 2>&1
if errorlevel 1 (
    docker compose version >nul 2>&1
    if errorlevel 1 (
        echo [WARN] Docker Compose is not installed (optional)
    ) else (
        echo [OK] Docker Compose is available (v2)
        docker compose version
    )
) else (
    echo [OK] Docker Compose is installed
    docker-compose --version
)
echo.

REM Check Python packages
echo Checking Python packages...
if defined VIRTUAL_ENV (
    echo [OK] Virtual environment is active
    echo   Path: %VIRTUAL_ENV%
) else (
    echo [WARN] No virtual environment detected
    echo   Recommendation: python -m venv venv ^&^& venv\Scripts\activate
)
echo.

REM Check frontend packages
echo Checking frontend packages...
if exist "frontend\node_modules" (
    echo [OK] Frontend dependencies are installed
) else (
    echo [WARN] Frontend dependencies are not installed
    echo   Install: cd frontend ^&^& npm install
)
echo.

REM Summary
echo ========================================
if "!ALL_OK!"=="true" (
    echo [OK] All required dependencies are installed
    exit /b 0
) else (
    echo [X] Some required dependencies are missing
    echo.
    echo Install missing dependencies:
    echo   Python: https://www.python.org/downloads/
    echo   Node.js: https://nodejs.org/
    echo   Docker: https://www.docker.com/products/docker-desktop
    exit /b 1
)

endlocal

