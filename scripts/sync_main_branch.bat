@echo off
REM sync_main_branch.bat - Sync Main Branch from Development
REM 
REM Syncs main branch from development, excluding development-only files.
REM This is the recommended workflow for production releases.
REM
REM Usage:
REM   scripts\sync_main_branch.bat

setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
cd /d "%PROJECT_ROOT%"

echo ========================================
echo   Sync Main Branch from Development
echo ========================================
echo.

REM Check if we're in a git repository
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo Error: Not in a git repository
    exit /b 1
)

REM Get current branch
for /f "tokens=2" %%b in ('git branch --show-current 2^>nul') do set "CURRENT_BRANCH=%%b"
echo Current branch: !CURRENT_BRANCH!
echo.

REM Step 1: Switch to development branch
echo Step 1: Switching to development branch...
git show-ref --verify --quiet refs/heads/development >nul 2>&1
if errorlevel 1 (
    echo [WARN] Development branch does not exist, creating from current branch...
    git checkout -b development
) else (
    git checkout development
    echo [OK] Switched to development branch
)
echo.

REM Step 2: Pull latest changes from origin-dev
echo Step 2: Pulling latest changes from origin-dev/development...
git remote | findstr "origin-dev" >nul 2>&1
if errorlevel 1 (
    echo [WARN] origin-dev remote not found, skipping pull
) else (
    git pull origin-dev development 2>nul
    if errorlevel 1 (
        echo [WARN] No remote changes or remote not configured
    )
)
echo.

REM Step 3: Create or switch to main branch
echo Step 3: Creating/updating main branch...
git show-ref --verify --quiet refs/heads/main >nul 2>&1
if errorlevel 1 (
    echo [INFO] Main branch does not exist, creating from development...
    git checkout -b main
) else (
    echo [INFO] Main branch exists, switching to it...
    git checkout main
    echo [INFO] Merging development into main...
    git merge development --no-edit --no-ff
    if errorlevel 1 (
        echo [ERROR] Merge conflict detected. Please resolve manually.
        exit /b 1
    )
)
echo.

REM Step 4: Remove development-only files
echo Step 4: Removing development-only files from main branch...

set "REMOVED_ANY=false"

REM Remove directories
for %%d in (tests scripts docs GUIDE examples .cursor) do (
    if exist "%%d" (
        echo   Removing: %%d
        rmdir /s /q "%%d" 2>nul
        set "REMOVED_ANY=true"
    )
)

REM Remove files
for %%f in (pytest.ini tests\README.md) do (
    if exist "%%f" (
        echo   Removing: %%f
        del /q "%%f" 2>nul
        set "REMOVED_ANY=true"
    )
)

REM Remove plan files
for /r . %%f in (*.plan.md) do (
    if exist "%%f" (
        echo   Removing: %%f
        del /q "%%f" 2>nul
        set "REMOVED_ANY=true"
    )
)

if "!REMOVED_ANY!"=="true" (
    echo [OK] Development files removed
) else (
    echo [WARN] No development files found to remove
)
echo.

REM Step 5: Stage all changes
echo Step 5: Staging changes...
git add -A

REM Step 6: Commit changes
echo Step 6: Committing changes...
git diff --staged --quiet >nul 2>&1
if errorlevel 1 (
    git commit -m "chore: remove development files for production release

- Removed tests/ directory
- Removed scripts/ directory  
- Removed docs/ directory
- Removed GUIDE/ directory
- Removed examples/ directory
- Removed pytest.ini
- Removed test documentation
- Removed planning documents"
    if errorlevel 1 (
        echo [WARN] No changes to commit
    ) else (
        echo [OK] Changes committed
    )
) else (
    echo [WARN] No changes to commit (files already removed)
)
echo.

REM Summary
echo ========================================
echo [OK] Main branch synced and cleaned
echo.
for /f "tokens=2" %%b in ('git branch --show-current 2^>nul') do echo Current branch: %%b
echo.
echo Next steps:
echo   1. Review changes: git log --oneline -5
echo   2. Push to production remote: git push origin-prod main
echo   3. Switch back to development: git checkout development
echo.

endlocal

