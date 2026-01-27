# HyperAgent Sanity Check Script (PowerShell)
# Runs basic build and smoke tests to verify the system is working

$ErrorActionPreference = "Continue"

Write-Host "HyperAgent Sanity Check" -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Cyan
Write-Host ""

# Track results
$Passed = 0
$Failed = 0

# 1. Check Node.js version
Write-Host "1. Checking Node.js version..." -ForegroundColor Cyan
try {
    $nodeVersion = node --version
    Write-Host "   Node.js: $nodeVersion"
    
    if ($nodeVersion -match 'v(\d+)\.') {
        $majorVersion = [int]$matches[1]
        if ($majorVersion -ge 18) {
            Write-Host "[PASS] Node.js version is compatible (>= 18)" -ForegroundColor Green
            $Passed++
        }
        else {
            Write-Host "[FAIL] Node.js version must be >= 18" -ForegroundColor Red
            $Failed++
        }
    }
}
catch {
    Write-Host "[FAIL] Node.js not found" -ForegroundColor Red
    $Failed++
}
Write-Host ""

# 2. Build CLI
Write-Host "2. Building CLI..." -ForegroundColor Cyan
try {
    npm run hyperagent:build 2>&1 | Out-Null
    Write-Host "[PASS] CLI Build" -ForegroundColor Green
    $Passed++
}
catch {
    Write-Host "[FAIL] CLI Build" -ForegroundColor Red
    $Failed++
}
Write-Host ""

# 3. Test CLI help
Write-Host "3. Testing CLI help command..." -ForegroundColor Cyan
try {
    npm run hyperagent -- --help 2>&1 | Out-Null
    Write-Host "[PASS] CLI Help" -ForegroundColor Green
    $Passed++
}
catch {
    Write-Host "[FAIL] CLI Help" -ForegroundColor Red
    $Failed++
}
Write-Host ""

# 4. Build TS API
Write-Host "4. Building TS API..." -ForegroundColor Cyan
try {
    Push-Location ts/api
    npm run build 2>&1 | Out-Null
    Pop-Location
    Write-Host "[PASS] TS API Build" -ForegroundColor Green
    $Passed++
}
catch {
    Pop-Location
    Write-Host "[FAIL] TS API Build" -ForegroundColor Red
    $Failed++
}
Write-Host ""

# 5. Build orchestrator
Write-Host "5. Building Orchestrator..." -ForegroundColor Cyan
try {
    Push-Location ts/orchestrator
    npm run build 2>&1 | Out-Null
    Pop-Location
    Write-Host "[PASS] Orchestrator Build" -ForegroundColor Green
    $Passed++
}
catch {
    Pop-Location
    Write-Host "[FAIL] Orchestrator Build" -ForegroundColor Red
    $Failed++
}
Write-Host ""

# 6. Check environment variables
Write-Host "6. Checking environment configuration..." -ForegroundColor Cyan
if (Test-Path ".env") {
    Write-Host "[PASS] .env file exists" -ForegroundColor Green
    $Passed++
}
else {
    Write-Host "[WARN] .env file not found (copy from .env.example)" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "=======================" -ForegroundColor Cyan
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Cyan
Write-Host "Passed: $Passed" -ForegroundColor Green
Write-Host "Failed: $Failed" -ForegroundColor Red
Write-Host ""

if ($Failed -eq 0) {
    Write-Host "All sanity checks passed!" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "Some checks failed. Please review the errors above." -ForegroundColor Red
    exit 1
}
