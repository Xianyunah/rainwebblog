@echo off
title RainWeb
echo ====================================
echo   RainWeb v1.0.0 - 个人云管理平台
echo ====================================
echo.

if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed.
)

echo Starting server...
echo.
echo Open http://localhost:3001 in your browser
echo Default admin: admin / admin123
echo.
start "" http://localhost:3001
node server.js

pause
