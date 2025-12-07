@echo off
REM Code Quality Check Script for Windows
REM Run all code quality checks locally before committing

echo [*] Running code quality checks...

REM Check Black formatting
echo [*] Checking Black formatting...
black --check hyperagent/
if %errorlevel% neq 0 (
    echo [-] Black formatting check failed. Run: black hyperagent/
    exit /b 1
)
echo [+] Black formatting check passed

REM Check isort import sorting
echo [*] Checking isort import sorting...
isort --check-only hyperagent/
if %errorlevel% neq 0 (
    echo [-] isort import check failed. Run: isort hyperagent/
    exit /b 1
)
echo [+] isort import check passed

REM Check MyPy type hints
echo [*] Checking MyPy type hints...
mypy hyperagent/
if %errorlevel% neq 0 (
    echo [-] MyPy type check failed. Fix type hints or add ignore comments.
    exit /b 1
)
echo [+] MyPy type check passed

echo [+] All code quality checks passed!

