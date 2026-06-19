@echo off
title RainWeb Deploy
echo ====================================
echo   RainWeb - One-Click Deploy
echo ====================================
echo.

REM Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Install from https://nodejs.org (LTS 20.x+)
    pause
    exit /b 1
)
echo [OK] Node.js: 
node -v

REM Check npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm not found.
    pause
    exit /b 1
)

REM Install dependencies
echo.
echo [1/3] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
)
echo [OK] Dependencies installed.

REM Create wallpaper folder
if not exist "public\wallpaper" mkdir "public\wallpaper"

REM Start server
echo.
echo [2/3] Starting server...
echo.
echo ====================================
echo   Open http://localhost:3001 in browser
echo   Default admin: admin / admin123
echo ====================================
echo.
start "" http://localhost:3001
node server.js

pause
