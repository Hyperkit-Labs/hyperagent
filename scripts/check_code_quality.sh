#!/bin/bash
# Code Quality Check Script
# Run all code quality checks locally before committing

set -e

echo "[*] Running code quality checks..."

# Check Black formatting
echo "[*] Checking Black formatting..."
black --check hyperagent/ || {
    echo "[-] Black formatting check failed. Run: black hyperagent/"
    exit 1
}
echo "[+] Black formatting check passed"

# Check isort import sorting
echo "[*] Checking isort import sorting..."
isort --check-only hyperagent/ || {
    echo "[-] isort import check failed. Run: isort hyperagent/"
    exit 1
}
echo "[+] isort import check passed"

# Check MyPy type hints
echo "[*] Checking MyPy type hints..."
mypy hyperagent/ || {
    echo "[-] MyPy type check failed. Fix type hints or add ignore comments."
    exit 1
}
echo "[+] MyPy type check passed"

# Check for secrets
echo "[*] Checking for secrets in code..."
if git grep -n "PRIVATE_KEY\|sk-.*\|0x[a-fA-F0-9]\{64\}" -- "*.py" "*.ts" "*.tsx" | grep -v "env.example\|\.env\|test" | grep -v "#.*PRIVATE_KEY"; then
    echo "[-] Potential secrets found in code. Review and remove."
    exit 1
fi
echo "[+] No secrets found in code"

# Check for hardcoded credentials
echo "[*] Checking for hardcoded credentials..."
if git grep -n "password.*=.*['\"].*['\"]" -- "*.py" | grep -v "test\|example\|#"; then
    echo "[-] Potential hardcoded passwords found. Use environment variables."
    exit 1
fi
echo "[+] No hardcoded credentials found"

echo "[+] All code quality checks passed!"

