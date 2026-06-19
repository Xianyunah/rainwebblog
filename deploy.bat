@echo off
title RainWeb Deploy

set REPO_URL=https://github.com/Xianyunah/rainwebblog.git
set INSTALL_DIR=rainweb

echo ====================================
echo   RainWeb - One-Click Deploy
echo   Repo: %REPO_URL%
echo ====================================
echo.

REM Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Install from https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js:
node -v

REM Check git
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed.
    pause
    exit /b 1
)

REM Clone or pull
if exist "%INSTALL_DIR%\.git" (
    echo [1/4] Updating existing installation...
    cd "%INSTALL_DIR%"
    git pull
) else (
    echo [1/4] Cloning repository...
    git clone "%REPO_URL%" "%INSTALL_DIR%"
    cd "%INSTALL_DIR%"
)

REM Install dependencies
echo.
echo [2/4] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
)
echo [OK] Dependencies installed.

REM Create wallpaper folder
if not exist "public\wallpaper" mkdir "public\wallpaper"

REM Start
echo.
echo [3/4] Starting server...
echo.
echo ====================================
echo   Open http://localhost:3001
echo   Default admin: admin / admin123
echo ====================================
echo.
start "" http://localhost:3001
node server.js

pause
