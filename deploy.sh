#!/bin/bash
set -e

REPO_URL="https://github.com/Xianyunah/rainwebblog.git"
INSTALL_DIR="${1:-rainweb}"

echo "===================================="
echo "  RainWeb - One-Click Deploy"
echo "  Repo: $REPO_URL"
echo "===================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed. Install from https://nodejs.org (LTS 20.x+)"
    exit 1
fi
echo "[OK] Node.js: $(node -v)"

# Check git
if ! command -v git &> /dev/null; then
    echo "[ERROR] Git is not installed."
    exit 1
fi

# Clone or pull
if [ -d "$INSTALL_DIR/.git" ]; then
    echo "[1/4] Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull
else
    echo "[1/4] Cloning repository..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Install dependencies
echo ""
echo "[2/4] Installing dependencies..."
npm install --production
echo "[OK] Dependencies installed."

# Create wallpaper directory
mkdir -p public/wallpaper

# Start
echo ""
echo "[3/4] Starting server..."
echo ""
echo "===================================="
echo "  Open http://localhost:3001"
echo "  Default admin: admin / admin123"
echo "===================================="
echo ""

if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3001 2>/dev/null || true
elif command -v open &> /dev/null; then
    open http://localhost:3001 2>/dev/null || true
fi

node server.js
