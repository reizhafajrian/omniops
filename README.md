# 🚀 Dockops — Self-Hosted GitOps Engine for Podman & Docker

A lightweight, self-hosted GitOps reconciliation engine designed for Podman (and Docker) environments — conceptually similar to ArgoCD, but without the complexity of a Kubernetes control plane. It automatically deploys and manages applications defined by `docker-compose.yml` directly from your Git repositories.

---

## 🏗️ Architecture

The system consists of two main components:

1. **Headless Rust Backend Engine (`/backend`)**: A high-performance reconciliation daemon + Axum REST API and WebSocket API powered by SQLite persistence. It talks directly to `podman` and `podman-compose` to manage workloads.
2. **React Frontend Control Plane (`/frontend`)**: A modern, real-time dashboard powered by React 18, Vite, TypeScript, Tailwind CSS, Shadcn UI, TanStack Query, and an xterm.js live terminal for container logs.

---

## ✨ Key Features

- **Automated GitOps Reconciliation**: Polls your remote Git repositories (e.g., every 60 seconds) and automatically deploys your containers via `podman-compose` when a new commit is detected.
- **Daemonless Podman Support**: Completely integrated with Podman. Parses `podman ps --format json` and uses labels (`io.podman.compose.project`, `io.podman.compose.service`) to map containers to your stacks.
- **System Metrics & Topology**: Inspects your running containers to display CPU usage, memory consumption, exposed ports, volume mappings, and network attachments in real-time.
- **Live Terminal Logs**: View live stdout and stderr streams of your deployments directly in the UI using WebSockets and xterm.js.
- **Rollback Safety**: Automatically detects deployment failures (e.g., syntax error in your compose file) and allows you to rollback to the last known good commit with a single click.
- **SQLite State Management**: Uses a robust embedded SQLite database to persist the deployment states, timestamps, and commit hashes for every stack you manage.
- **Single-Command Install Script**: Comes with a customized `install.sh` to install dependencies (including Podman), setup a `systemd` service for the backend daemon, and expose the UI — all automatically.

---

## 🧠 How It Works (End-to-End Engine Architecture)

Dockops works on an **automated reconciliation loop** coupled with an **exhaustive state machine**. It monitors your Git repositories, compares the latest remote commit hash against the last applied hash in SQLite, validates the compose configuration, and applies changes automatically to the local Podman instance.

```mermaid
sequenceDiagram
    autonumber
    participant Git as Remote Git Repo
    participant Loop as Background Reconcile Loop
    participant Store as SQLite StateStore
    participant Podman as Podman Daemon
    participant UI as React Control Plane

    Loop->>Store: 1. Load current stack state & last applied commit
    Loop->>Git: 2. Fetch remote branch HEAD commit hash (cheap)
    Git-->>Loop: Return latest commit hash (e.g. `e4f9b2a`)
  
    alt Remote hash matches last_synced_commit
        Loop->>Store: 3a. Status is `Synced` — No action needed
    else Remote hash differs (OutOfSync Trigger)
        Loop->>Store: 3b. Transition state to `Deploying`
        Loop->>Git: 4. Sparse checkout commit to /tmp/gitops_checkouts/
        Loop->>Podman: 5. Run `podman-compose up -d --remove-orphans`
      
        alt Compose apply succeeds
            Podman-->>Loop: Containers started successfully (exit code 0)
            Loop->>Store: 6a. Transition state to `Synced`, update `last_known_good_commit`
            Loop->>Store: 6b. Append successful `SyncEvent` to audit log
        else Compose apply fails
            Loop->>Store: 7a. Transition state to `Failed` (preserves `last_known_good_commit`)
            Loop->>Store: 7b. Append failed `SyncEvent` with captured error traceback
        end
    end

    UI->>Store: 8. TanStack Query polls GET /api/stacks every 3s
    UI->>Podman: 9. WS /api/logs/:id streams live container stdout/stderr
```

---

## 🔄 Lifecycle & State Machine

Every tracked stack follows a strict 5-state lifecycle defined in `DeploymentState`. There are **no implicit success fallthroughs** — every state transition is explicit and persisted to SQLite.

```text
       ┌──────────┐
       │ Unknown  │  (Initial state at startup before first poll)
       └────┬─────┘
            │
            ▼
      ┌───────────┐
  ┌──►│ OutOfSync │  (Remote commit != last_synced_commit)
  │   └─────┬─────┘
  │         │
  │         ▼
  │   ┌───────────┐
  │   │ Deploying │  (Per-stack Mutex held, checkout & compose apply running)
  │   └──┬─────┬──┘
  │      │     │
  │      │     └──────────────┐
  │      ▼                    ▼
  │ ┌──────────┐        ┌──────────┐
  │ │  Synced  │        │  Failed  │  (Error logged, last_known_good_commit PRESERVED)
  │ └──────────┘        └──────────┘
  │      │                    │
  └──────┴────────────────────┘  (Next poll or manual rollback)
```

---

## 🔑 Security Token (`GITOPS_TOKEN`)

The **Token** is your engine's security password (`GITOPS_TOKEN`). It must be passed as a Bearer token to authorize all REST API routes and WebSocket endpoints.

- **Environment Variable**: `VITE_GITOPS_TOKEN` (Frontend) and `GITOPS_TOKEN` (Backend).
- **Why it is needed**: It prevents unauthorized access to your container metrics, configuration, and repository details.
- **UI configuration**: Enter your token in the frontend Settings page (the top navigation bar gear icon), which persists it securely into `localStorage`.

---

## 🚦 Installation & Setup

### Automated Installation (Linux / macOS)

We have created an automated installation script (`install.sh`) that ensures you have all prerequisites installed and configured properly. It handles:

- Installing `podman` (via Homebrew on Mac or package managers on Linux).
- Installing `podman-compose`.
- Creating and configuring `podman machine` (if running on a Mac).
- Setting up the required folders.

To install using the automated script:

```bash
chmod +x install.sh
./install.sh
```

### Manual Setup (For Development)

#### 1. Start Rust Backend Engine

```bash
cd backend
# Create an .env file mapping to your tokens and DB URLs
cargo run -p api
```

*(Runs at `http://0.0.0.0:9090`)*

#### 2. Start React Control Plane

```bash
cd frontend
npm install
npm run dev
```

*(Runs at `http://localhost:9091`)*

---

## 📡 API Reference

All requests require `Authorization: Bearer <GITOPS_TOKEN>`.

```bash
# List all registered stacks
curl -H "Authorization: Bearer <GITOPS_TOKEN>" \
  http://localhost:9090/api/stacks

# Create a new stack to be tracked
curl -X POST -H "Authorization: Bearer <GITOPS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"id":"my-app","repo_url":"https://github.com/user/repo.git","branch":"main","compose_path":"docker-compose.yml","poll_interval_secs":60}' \
  http://localhost:9090/api/stacks

# Get real-time system metrics, topology, and containers for a stack
curl -H "Authorization: Bearer <GITOPS_TOKEN>" \
  http://localhost:9090/api/stacks/my-app/services

# Delete stack & clean up containers
curl -X DELETE -H "Authorization: Bearer <GITOPS_TOKEN>" \
  http://localhost:9090/api/stacks/my-app
```
