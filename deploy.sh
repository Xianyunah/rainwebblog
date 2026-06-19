#!/bin/bash
set -e

echo "===================================="
echo "  RainWeb - One-Click Deploy"
echo "===================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed. Install from https://nodejs.org (LTS 20.x+)"
    exit 1
fi
echo "[OK] Node.js: $(node -v)"

# Install dependencies
echo ""
echo "[1/3] Installing dependencies..."
npm install --production
echo "[OK] Dependencies installed."

# Create wallpaper directory
mkdir -p public/wallpaper

# Start server
echo ""
echo "[2/3] Starting server..."
echo ""
echo "===================================="
echo "  Open http://localhost:3001"
echo "  Default admin: admin / admin123"
echo "===================================="
echo ""

# Open browser
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3001 2>/dev/null || true
elif command -v open &> /dev/null; then
    open http://localhost:3001 2>/dev/null || true
fi

node server.js
