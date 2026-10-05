@echo off
setlocal EnableExtensions EnableDelayedExpansion
title BioShield MFA - System Launcher

REM ============================================================
REM  BioShield MFA
REM  Development / Research Environment Launcher
REM ============================================================

REM Always run relative to this script, not the caller's terminal.
cd /d "%~dp0"

REM -----------------------------
REM Configuration
REM -----------------------------
set "FRONTEND_DIR=%CD%\frontend"
set "BACKEND_DIR=%CD%\backend"
set "BIOMETRIC_DIR=%CD%\biometric-service"

set "FRONTEND_PORT=3000"
set "BACKEND_PORT=8080"
set "BIOMETRIC_PORT=5000"

set "FRONTEND_URL=http://localhost:%FRONTEND_PORT%"
set "BACKEND_URL=http://localhost:%BACKEND_PORT%"
set "BIOMETRIC_URL=http://localhost:%BIOMETRIC_PORT%"

set "ERRORS=0"

cls
echo ============================================================
echo:
echo                  BioShield MFA
echo        Intelligent Authentication Platform
echo:
echo ============================================================
echo:
echo  Running pre-launch checks...
echo:

REM ============================================================
REM  1. DIRECTORY VALIDATION
REM ============================================================

if not exist "%FRONTEND_DIR%\" (
    echo [ERROR] Frontend directory not found:
    echo         %FRONTEND_DIR%
    set /a ERRORS+=1
) else (
    echo [ OK ] Frontend directory
)

if not exist "%BACKEND_DIR%\" (
    echo [ERROR] Backend directory not found:
    echo         %BACKEND_DIR%
    set /a ERRORS+=1
) else (
    echo [ OK ] Backend directory
)

if not exist "%BIOMETRIC_DIR%\" (
    echo [ERROR] Biometric service directory not found:
    echo         %BIOMETRIC_DIR%
    set /a ERRORS+=1
) else (
    echo [ OK ] Biometric service directory
)

REM ============================================================
REM  2. NODE.JS / NPM VALIDATION
REM ============================================================

where node >nul 2>&1

if errorlevel 1 (
    echo [ERROR] Node.js was not found in PATH.
    set /a ERRORS+=1
) else (
    for /f "delims=" %%V in ('node --version') do set "NODE_VERSION=%%V"
    echo [ OK ] Node.js !NODE_VERSION!
)

where npm >nul 2>&1

if errorlevel 1 (
    echo [ERROR] npm was not found in PATH.
    set /a ERRORS+=1
) else (
    for /f "delims=" %%V in ('npm --version') do set "NPM_VERSION=%%V"
    echo [ OK ] npm !NPM_VERSION!
)

REM ============================================================
REM  3. PYTHON / VIRTUAL ENVIRONMENT VALIDATION
REM ============================================================

set "PYTHON_EXE="

if exist "%BIOMETRIC_DIR%\venv\Scripts\python.exe" (
    set "PYTHON_EXE=%BIOMETRIC_DIR%\venv\Scripts\python.exe"
    echo [ OK ] Python virtual environment detected
) else (
    where python >nul 2>&1

    if errorlevel 1 (
        echo [ERROR] Python virtual environment not found.
        echo [ERROR] System Python was also not found in PATH.
        set /a ERRORS+=1
    ) else (
        set "PYTHON_EXE=python"
        echo [WARN] venv not found - using system Python
    )
)

REM ============================================================
REM  4. PROJECT FILE VALIDATION
REM ============================================================

if not exist "%FRONTEND_DIR%\package.json" (
    echo [ERROR] frontend\package.json not found.
    set /a ERRORS+=1
) else (
    echo [ OK ] Frontend package.json
)

if not exist "%BACKEND_DIR%\package.json" (
    echo [ERROR] backend\package.json not found.
    set /a ERRORS+=1
) else (
    echo [ OK ] Backend package.json
)

if not exist "%BIOMETRIC_DIR%\main.py" (
    echo [ERROR] biometric-service\main.py not found.
    set /a ERRORS+=1
) else (
    echo [ OK ] Biometric service entry point
)

REM ============================================================
REM  5. NODE MODULE CHECK
REM ============================================================

if exist "%FRONTEND_DIR%\" (
    if not exist "%FRONTEND_DIR%\node_modules\" (
        echo [WARN] Frontend node_modules not found.
        echo        Run: cd frontend ^&^& npm install
    ) else (
        echo [ OK ] Frontend dependencies
    )
)

if exist "%BACKEND_DIR%\" (
    if not exist "%BACKEND_DIR%\node_modules\" (
        echo [WARN] Backend node_modules not found.
        echo        Run: cd backend ^&^& npm install
    ) else (
        echo [ OK ] Backend dependencies
    )
)

REM ============================================================
REM  ABORT IF CRITICAL CHECKS FAILED
REM ============================================================

if not "%ERRORS%"=="0" (
    echo:
    echo ============================================================
    echo  STARTUP ABORTED
    echo ============================================================
    echo:
    echo  !ERRORS! critical pre-launch check failure.
    echo  Fix the errors above and run this launcher again.
    echo:
    pause
    exit /b 1
)

echo:
echo ============================================================
echo  Pre-launch checks completed successfully.
echo ============================================================
echo:

REM ============================================================
REM  6. START BIOMETRIC / AI SERVICE
REM ============================================================

echo [1/3] Starting Biometric AI Service...
echo       Address: %BIOMETRIC_URL%

start "BioShield - Biometric AI Service" cmd /k "cd /d "%BIOMETRIC_DIR%" && "%PYTHON_EXE%" -m uvicorn main:app --host 127.0.0.1 --port %BIOMETRIC_PORT% --reload"

ping 127.0.0.1 -n 3 >nul

REM ============================================================
REM  7. START BACKEND
REM ============================================================

echo [2/3] Starting Backend API...
echo       Address: %BACKEND_URL%

start "BioShield - Backend API" cmd /k "cd /d "%BACKEND_DIR%" && npm run dev"

ping 127.0.0.1 -n 3 >nul

REM ============================================================
REM  8. START FRONTEND
REM ============================================================

echo [3/3] Starting Frontend Client...
echo       Address: %FRONTEND_URL%

start "BioShield - Frontend Client" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev"

REM ============================================================
REM  9. STARTUP SUMMARY
REM ============================================================

echo:
echo ============================================================
echo:
echo              BioShield MFA Services Started
echo:
echo ============================================================
echo:
echo  SERVICE                 ADDRESS
echo  ----------------------------------------------------------
echo  Frontend Client         %FRONTEND_URL%
echo  Backend API             %BACKEND_URL%
echo  Biometric AI Service    %BIOMETRIC_URL%
echo:
echo ============================================================
echo:
echo  Separate terminal windows have been opened for each
echo  service. Check those windows for runtime errors.
echo:
echo  NOTE:
echo  This launcher confirms that the service processes were
echo  started. It does not guarantee that each service completed
echo  initialization successfully.
echo:
echo ============================================================
echo:

ping 127.0.0.1 -n 6 >nul

echo Opening application...
start "" "%FRONTEND_URL%"

echo:
echo Startup sequence completed.
echo You may close this launcher window.
echo:

pause

endlocal
