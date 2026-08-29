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

# 2. Download latest binary
echo "[2/3] Downloading OmniOps binary for $TARGET..."

LATEST_URL="https://github.com/reizhafajrian/omniops/releases/latest/download/omni-${TARGET}.tar.gz"
TEMP_DIR=$(mktemp -d)

# Try downloading, if it fails gracefully fallback
if ! curl -sSLf "$LATEST_URL" -o "$TEMP_DIR/omni.tar.gz"; then
    echo "Error: Failed to download from GitHub Releases."
    echo "Make sure the release is published at:"
    echo "$LATEST_URL"
    echo ""
    echo "If you are developing locally, you can install from source using:"
    echo "cargo install --path backend/crates/api"
    rm -rf "$TEMP_DIR"
    exit 1
fi

tar -xzf "$TEMP_DIR/omni.tar.gz" -C "$TEMP_DIR"

# 3. Install
echo "[3/3] Installing to /usr/local/bin..."

if [ -w "/usr/local/bin" ]; then
    mv "$TEMP_DIR/omni" /usr/local/bin/omni
else
    echo "Requesting sudo privileges to move binary to /usr/local/bin..."
    sudo mv "$TEMP_DIR/omni" /usr/local/bin/omni
fi

chmod +x /usr/local/bin/omni
rm -rf "$TEMP_DIR"

echo ""
echo "Installation complete!"
echo "Run 'omni' to start the server or 'omni --help' for commands."
echo "=================================================="
