#!/usr/bin/env bash
set -e

echo "=================================================="
echo "    OmniOps Installation Script"
echo "=================================================="
echo ""

# 1. Detect OS and Architecture
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

echo "[1/3] Detected operating system: $OS ($ARCH)"

if [[ "$OS" == "darwin" ]]; then
    if [[ "$ARCH" == "x86_64" ]]; then
        TARGET="x86_64-apple-darwin"
    elif [[ "$ARCH" == "arm64" ]]; then
        TARGET="aarch64-apple-darwin"
    fi
elif [[ "$OS" == "linux" ]]; then
    if [[ "$ARCH" == "x86_64" ]]; then
        TARGET="x86_64-unknown-linux-gnu"
    elif [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then
        TARGET="aarch64-unknown-linux-gnu"
    fi
else
    echo "Unsupported OS: $OS"
    exit 1
fi

if [[ -z "$TARGET" ]]; then
    echo "Unsupported architecture: $ARCH"
    exit 1
fi

# 2. Download latest binary (Placeholder for GitHub Releases)
echo "[2/3] Downloading OmniOps binary for $TARGET..."

# TODO: Replace with actual GitHub Release URL once published
# LATEST_URL="https://github.com/reizhafajrian/omniops/releases/latest/download/omniops-$TARGET.tar.gz"
# curl -sSL "$LATEST_URL" -o omniops.tar.gz
# tar -xzf omniops.tar.gz

echo "(Skipping download in development... assuming binary is available locally)"
# We will use the locally built one for now in this script placeholder

# 3. Install
echo "[3/3] Installing to /usr/local/bin..."
# sudo mv omniops /usr/local/bin/
# sudo chmod +x /usr/local/bin/omniops

echo ""
echo "Installation complete!"
echo "Run 'omniops' to start the server."
echo "=================================================="
