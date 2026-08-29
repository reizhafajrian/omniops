# 🚀 OmniOps — Self-Hosted GitOps Engine for Podman & Docker

[![Release](https://img.shields.io/github/v/release/reizhafajrian/omniops?style=flat-square)](https://github.com/reizhafajrian/omniops/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![Built with Rust](https://img.shields.io/badge/Built%20with-Rust-orange?style=flat-square)](https://www.rust-lang.org/)

**OmniOps** is a lightweight, self-hosted GitOps continuous deployment engine built in Rust. It monitors your Git repositories for new commits and automatically deploys your `docker-compose.yml` workloads via **Podman** (or Docker) — no Kubernetes required.

> **Docs:** [https://omniops.dev/docs](https://omniops.dev/docs)

---

## ✨ Key Features

- **GitOps Reconciliation** — Automatically syncs containers to match the desired state in your Git repo.
- **Podman-First** — Fully rootless container support via Podman. Docker is also supported.
- **Single Binary** — The entire engine (API + embedded Web UI) ships as one compiled `omni` binary.
- **Daemon Mode** — SSH-safe background process with `omni start` / `omni stop` / `omni status`.
- **Real-Time Dashboard** — Live WebSocket log streaming, topology graphs, CPU/RAM metrics.
- **Webhook Support** — Instant deploys on Git push via webhook, or periodic polling, or both.
- **Private Registries** — Automatic authentication for GCR, GHCR, ECR, Docker Hub.
- **Rollback Safety** — Preserves `last_known_good_commit` on failure for safe rollbacks.

---

## 🚀 Quick Start

### 1. Install OmniOps

```bash
# Via install script (macOS / Linux)
curl -sSL https://raw.githubusercontent.com/reizhafajrian/omniops/main/scripts/install.sh | bash

# Via Homebrew (macOS)
brew tap reizhafajrian/omniops && brew install omni

# Verify
omni --version
# omni 0.1.0
```

### 2. Install Podman (or Docker)

Let OmniOps install the container engine for you:

```bash
# Install Podman (recommended — rootless and daemonless)
omni install --engine podman

# Or install Docker
omni install --engine docker
```

### 3. Configure

Create a `.env` file in your working directory:

```env
PORT=9090
GITOPS_TOKEN=your-secret-token-here
DATABASE_URL=sqlite:./omniops.db
RUST_LOG=info
```

### 4. Start the Server

```bash
# Background mode (SSH-safe, recommended for servers)
omni start

# Foreground mode (for development / debugging)
omni serve
```

Open **http://localhost:9090** in your browser. Log in with your `GITOPS_TOKEN`.

---

## 📖 CLI Reference

```
Usage: omni [COMMAND]

Commands:
  serve      Start the server in the foreground (for debugging)
  install    Install a container engine: podman, docker, or both
  uninstall  Uninstall OmniOps (optionally with --deep-clean)
  start      Start the server in the background (daemon mode)
  stop       Stop the background server
  status     Show daemon status (RUNNING / STOPPED)
  help       Print help

Options:
  -h, --help     Print help
  -V, --version  Print version
```

### Daemon Mode (SSH-Safe)

When connected over SSH, use `omni start` so the server survives after you disconnect:

```bash
omni start          # Start in background
omni status         # OmniOps Status: RUNNING (PID: 12345)
tail -f ~/.omniops.log  # View live logs
omni stop           # Gracefully shut down
```

### Installing the Container Engine

```bash
omni install --engine podman   # Podman (default)
omni install --engine docker   # Docker
omni install --engine both     # Both
```

### Uninstalling

```bash
# Remove OmniOps only (leaves Podman/Docker and all containers intact)
omni uninstall

# DESTRUCTIVE: Remove OmniOps AND wipe Podman + all container data
omni uninstall --deep-clean

# Deep clean a specific engine
omni uninstall --deep-clean --engine docker
```

> ⚠️ `--deep-clean` permanently deletes all container images, volumes, machines, and config directories (`~/.config/containers`, `~/.local/share/containers`). This cannot be undone.

---

## 🏗️ Architecture

OmniOps is a Rust **Cargo workspace** with three crates following Hexagonal Architecture:

| Crate | Role |
|---|---|
| `domain` | Pure business logic — use cases, domain models, repository trait definitions. Zero I/O. |
| `infrastructure` | Implements domain ports via SQLite (SQLx), Git (libgit2), and Podman/Docker CLI. |
| `api` | Axum HTTP server, WebSocket handlers, CLI (Clap), and rust-embed for the React frontend. |

### Reconciliation Loop

```
Git Repo (source of truth)
     ↓  poll / webhook
OmniOps Engine
  - Diff latest SHA vs. last deployed SHA in SQLite
  - If different: checkout → registry login → podman compose up -d --pull always
  - Update last_deployed_sha and append sync record
     ↓  WebSocket
Web UI (localhost:9090)
```

### State Machine

Every stack transitions through these states:

```
Unknown → OutOfSync → Deploying → Synced
                              ↘ Failed (last_known_good_commit preserved)
```

---

## 🔑 Authentication

All API requests and the Web UI require a Bearer token:

```
Authorization: Bearer <GITOPS_TOKEN>
```

Set `GITOPS_TOKEN` in your `.env` file. This is the password for your OmniOps instance.

---

## 📡 API Quick Reference

```bash
BASE=http://localhost:9090/api
TOKEN=your-secret-token

# List all stacks
curl -H "Authorization: Bearer $TOKEN" $BASE/stacks

# Register a new stack
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-app",
    "repo_url": "https://github.com/you/repo.git",
    "branch": "main",
    "compose_file_path": "docker-compose.yml",
    "sync_mode": "both",
    "poll_interval_seconds": 60
  }' $BASE/stacks

# Manually trigger sync
curl -X POST -H "Authorization: Bearer $TOKEN" $BASE/stacks/{id}/sync

# WebSocket: Stream live container logs
wscat -c "ws://localhost:9090/api/logs/{stack_id}?container={container_name}" \
  -H "Authorization: Bearer $TOKEN"

# Webhook trigger (no auth header needed — secret is in the URL)
curl -X POST http://localhost:9090/api/webhooks/{SECRET_TOKEN}
```

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `9090` | HTTP server port |
| `HOST` | `0.0.0.0` | Bind address |
| `GITOPS_TOKEN` | *(required)* | API & UI authentication token |
| `DATABASE_URL` | `sqlite:./omniops.db` | SQLite database path |
| `RUST_LOG` | `info` | Log level: `error`, `warn`, `info`, `debug`, `trace` |

---

## 🛠️ Development Setup

If you want to build from source:

```bash
# Prerequisites: Rust toolchain, Node.js 18+, Podman or Docker

git clone https://github.com/reizhafajrian/omniops.git
cd omniops/app

# Build and install the CLI globally
cargo install --path backend/crates/api

# Run frontend in dev mode (hot-reload)
cd frontend && npm install && npm run dev
# → http://localhost:9091

# Run backend in dev mode (foreground with logs)
cd backend && cargo run -p api
# → http://localhost:9090
```

### Building Release Binaries

```bash
# Build for current platform
./scripts/build_release.sh

# Cross-platform builds are handled via GitHub Actions on git tag push
git tag v0.1.0 && git push origin v0.1.0
```

---

## 📦 Distribution

When a tag is pushed to GitHub, the release workflow (`.github/workflows/release.yml`) automatically builds and publishes binaries for:

| Platform | Binary |
|---|---|
| macOS (Apple Silicon) | `omni-aarch64-apple-darwin.tar.gz` |
| macOS (Intel) | `omni-x86_64-apple-darwin.tar.gz` |
| Linux (x86_64) | `omni-x86_64-unknown-linux-gnu.tar.gz` |
| Windows (x86_64) | `omni-x86_64-pc-windows-msvc.zip` |

---

## 🗂️ Project Structure

```
app/
├── backend/                    # Rust workspace
│   ├── Cargo.toml              # Workspace definition
│   └── crates/
│       ├── api/                # Axum server + CLI (bin: omni)
│       │   └── src/
│       │       ├── main.rs
│       │       ├── cli.rs      # omni install/uninstall/start/stop/status
│       │       ├── handlers/   # REST + WebSocket route handlers
│       │       └── middleware/ # Auth, CORS
│       ├── domain/             # Business logic (no I/O)
│       └── infrastructure/     # SQLite, Git, Podman adapters
├── frontend/                   # React + Vite + TypeScript + Tailwind
│   └── src/
│       ├── pages/              # Dashboard, StackDetail, Settings, etc.
│       ├── components/         # UI components
│       └── hooks/              # useLogSocket, useSystemMetrics, etc.
├── scripts/
│   ├── install.sh              # User-facing install script
│   └── build_release.sh        # Local release build helper
└── .github/workflows/
    └── release.yml             # Cross-platform CI/CD build
```

---

## 📄 License

MIT © [Reizha Fajrian](https://github.com/reizhafajrian)
