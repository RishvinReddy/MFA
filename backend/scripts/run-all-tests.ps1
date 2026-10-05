$ErrorActionPreference = "Stop"

try {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Running Phase 1 E2E (9 tests)" -ForegroundColor Cyan
    npx ts-node tests/phase1-e2e.ts
    if ($LASTEXITCODE -ne 0) { throw "Phase 1 failed" }

    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Running Milestone 2 (16 tests)" -ForegroundColor Cyan
    npx ts-node tests/milestone2.test.ts
    if ($LASTEXITCODE -ne 0) { throw "Milestone 2 failed" }

    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Running Adaptive Authentication (3 tests)" -ForegroundColor Cyan
    npx ts-node tests/adaptive-auth.test.ts
    if ($LASTEXITCODE -ne 0) { throw "Adaptive Auth failed" }

    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Running Continuous Authentication (4 tests)" -ForegroundColor Cyan
    npx ts-node tests/continuous-auth.test.ts
    if ($LASTEXITCODE -ne 0) { throw "Continuous Auth failed" }

    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Running MFA Enrollment (5 tests)" -ForegroundColor Cyan
    npx ts-node tests/mfa-enrollment-fix.ts
    if ($LASTEXITCODE -ne 0) { throw "MFA Enrollment failed" }

    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Running Phase 5 Workstation (6 tests)" -ForegroundColor Cyan
    npx ts-node tests/phase5.test.ts
    if ($LASTEXITCODE -ne 0) { throw "Phase 5 failed" }

    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Running Phase 6 SOC (8 tests)" -ForegroundColor Cyan
    npx ts-node tests/phase6.test.ts
    if ($LASTEXITCODE -ne 0) { throw "Phase 6 failed" }

    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Running Phase 7C Hardening (5 tests)" -ForegroundColor Cyan
    npx ts-node tests/phase7c.test.ts
    if ($LASTEXITCODE -ne 0) { throw "Phase 7C failed" }

    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Running Phase 7D Biometric (11 tests)" -ForegroundColor Cyan
    npm run test -- tests/phase7d.test.ts
    if ($LASTEXITCODE -ne 0) { throw "Phase 7D failed" }

    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Running Phase 7F Observability (10 tests)" -ForegroundColor Cyan
    npm run test -- tests/phase7f.test.ts
    if ($LASTEXITCODE -ne 0) { throw "Phase 7F failed" }

    Write-Host "========================================" -ForegroundColor Green
    Write-Host "SUCCESS: ALL 77/77 TESTS PASSED" -ForegroundColor Green
} catch {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "ERROR: Test suite failed: $_" -ForegroundColor Red
    exit 1
}
