#!/usr/bin/env bash
set -e

echo "=================================================="
echo "    OmniOps Build Release Script"
echo "=================================================="

# Move to script directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$DIR")"

echo "Building frontend..."
cd "$PROJECT_ROOT/frontend"
npm ci
npm run build

echo "Building backend..."
cd "$PROJECT_ROOT/backend"
# Build for current architecture
cargo build --release --bin omniops

echo "Build complete! Binary located at:"
echo "$PROJECT_ROOT/backend/target/release/omniops"
