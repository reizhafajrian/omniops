#!/usr/bin/env bash
set -e

ENGINE="podman" # default

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --engine) ENGINE="$2"; shift ;;
        --engine=*) ENGINE="${1#*=}" ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

echo "=================================================="
echo "    GitOps Engine Installation Script    "
echo "=================================================="
echo ""

echo "Selected Engine: $ENGINE"

# 1. Detect OS
OS="$(uname -s)"
echo "[1/3] Detected operating system: $OS"

install_podman() {
    if ! command -v podman &> /dev/null; then
        echo "Installing Podman..."
        case "$OS" in
            Linux*)
                if command -v apt-get &> /dev/null; then
                    sudo apt-get update
                    sudo apt-get install -y podman podman-compose
                elif command -v dnf &> /dev/null; then
                    sudo dnf install -y podman podman-compose
                elif command -v pacman &> /dev/null; then
                    sudo pacman -S --noconfirm podman podman-compose
                else
                    echo "Unsupported Linux package manager. Please install podman manually."
                fi
                ;;
            Darwin*)
                if command -v brew &> /dev/null; then
                    brew install podman podman-compose
                    echo "Initializing Podman machine..."
                    podman machine init || true
                    podman machine start || true
                else
                    echo "Homebrew is not installed. Please install Podman manually."
                fi
                ;;
        esac
    else
        echo "Podman is already installed!"
    fi
}

install_docker() {
    if ! command -v docker &> /dev/null; then
        echo "Installing Docker..."
        case "$OS" in
            Linux*)
                if command -v apt-get &> /dev/null; then
                    sudo apt-get update
                    sudo apt-get install -y docker.io docker-compose-v2
                elif command -v dnf &> /dev/null; then
                    sudo dnf install -y docker docker-compose
                elif command -v pacman &> /dev/null; then
                    sudo pacman -S --noconfirm docker docker-compose
                else
                    echo "Unsupported Linux package manager. Please install docker manually."
                fi
                ;;
            Darwin*)
                if command -v brew &> /dev/null; then
                    brew install --cask docker
                    echo "Please open Docker Desktop to start the daemon."
                else
                    echo "Homebrew is not installed. Please install Docker manually."
                fi
                ;;
        esac
    else
        echo "Docker is already installed!"
    fi
}

# 2. Check and Install Engine
echo "[2/3] Installing Engine(s)..."
if [[ "$ENGINE" == "podman" || "$ENGINE" == "both" ]]; then
    install_podman
fi

if [[ "$ENGINE" == "docker" || "$ENGINE" == "both" ]]; then
    install_docker
fi

# 3. Setup backend config
echo "[3/3] Setting up GitOps Engine application..."

echo ""
echo "Installation complete!"
echo "To run the application, navigate to the project directory and run:"
echo "  cargo run -p api  (for the backend)"
echo "  npm run dev       (for the frontend)"
echo "=================================================="
