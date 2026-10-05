@echo off
setlocal EnableExtensions EnableDelayedExpansion
title BioShield MFA - System Stopper

REM ============================================================
REM  BioShield MFA
REM  Service & Process Termination Script
REM ============================================================

cd /d "%~dp0"
cls
echo ============================================================
echo:
echo                 BioShield MFA System Stopper
echo        Terminating All Running Services & Ports
echo:
echo ============================================================
echo:

REM ============================================================
REM  1. STOP BY WINDOW TITLE
REM ============================================================
echo [1/2] Closing service terminal windows...
taskkill /F /FI "WINDOWTITLE eq BioShield*" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq *uvicorn*" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq *npm run dev*" /T >nul 2>&1

REM ============================================================
REM  2. STOP BY PORT (3000, 8080, 5000, 5173)
REM ============================================================
echo [2/2] Checking and terminating processes on project ports...
echo:

echo   -> Checking Port 3000 (Frontend Client)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r /c:":3000 .*LISTENING"') do (
    if not "%%a"=="0" if not "%%a"=="4" (
        echo      Stopping PID %%a on Port 3000...
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo   -> Checking Port 8080 (Backend API)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r /c:":8080 .*LISTENING"') do (
    if not "%%a"=="0" if not "%%a"=="4" (
        echo      Stopping PID %%a on Port 8080...
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo   -> Checking Port 5000 (Biometric AI Service)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r /c:":5000 .*LISTENING"') do (
    if not "%%a"=="0" if not "%%a"=="4" (
        echo      Stopping PID %%a on Port 5000...
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo   -> Checking Port 5173 (Vite Alternate Port)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r /c:":5173 .*LISTENING"') do (
    if not "%%a"=="0" if not "%%a"=="4" (
        echo      Stopping PID %%a on Port 5173...
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo:
echo ============================================================
echo:
echo        All BioShield MFA services have been terminated.
echo:
echo ============================================================
echo:
endlocal
