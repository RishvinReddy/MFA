# ============================================================
#  BioShield MFA - System Stopper (PowerShell)
# ============================================================

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "                 BioShield MFA System Stopper               " -ForegroundColor Cyan
Write-Host "        Terminating All Running Services & Ports            " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Terminate launcher windows by title
Write-Host "[1/2] Closing service terminal windows by title..." -ForegroundColor Yellow
Get-Process | Where-Object { $_.MainWindowTitle -like "*BioShield*" -or $_.MainWindowTitle -like "*uvicorn*" -or $_.MainWindowTitle -like "*npm run dev*" } | Stop-Process -Force -ErrorAction SilentlyContinue

# 2. Check and terminate processes on project ports
Write-Host "[2/2] Checking and terminating processes on project ports..." -ForegroundColor Yellow
Write-Host ""

$ports = @(3000, 8080, 5000, 5173)
foreach ($port in $ports) {
    Write-Host "  -> Checking Port $port..." -ForegroundColor Gray
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            if ($conn.OwningProcess -and $conn.OwningProcess -ne 0 -and $conn.OwningProcess -ne 4) {
                Write-Host "     Stopping PID $($conn.OwningProcess) on Port $port..." -ForegroundColor Green
                Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  All BioShield MFA services have been terminated." -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
