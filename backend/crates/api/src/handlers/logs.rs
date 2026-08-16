//! WebSocket handler for live Docker Compose log streaming.
//!
//! # Protocol
//!
//! 1. Client connects to `WS /api/logs/:id` with `Authorization: Bearer <token>`
//!    in the upgrade request headers (Axum's WS upgrade preserves request headers).
//! 2. The server upgrades and immediately begins streaming lines from the Docker
//!    daemon via the Unix socket for all containers belonging to the stack's
//!    compose project.
//! 3. If the underlying Docker stream drops (container restart, etc.), the server
//!    closes the WS with code 1011 (Internal Error) so the client's reconnect
//!    strategy activates.
//!
//! # Security
//!
//! Auth is enforced by the middleware layer applied globally in `router.rs`.
//! This handler does NOT re-check the token — that would be redundant and
//! error-prone.
//!
//! # Docker Unix socket note
//!
//! ⚠️  SECURITY TRADE-OFF: Mounting `/var/run/docker.sock` into the engine
//! container grants the process **root-equivalent access to the host** because
//! the Docker daemon runs as root and executes arbitrary commands on its behalf.
//! This is a conscious architectural decision for v1 (self-hosted, trusted
//! network). Mitigations for production:
//!   - Run the engine as a dedicated system user with a Unix socket ACL.
//!   - Use Docker socket proxies (e.g., Tecnativa/docker-socket-proxy) to
//!     restrict which Docker API endpoints are accessible.
//!   - Evaluate rootless Docker or a non-root container runtime.

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    response::IntoResponse,
};
use tokio::io::AsyncBufReadExt;
use tracing::info;


use crate::app_state::AppState;

use axum::extract::Query;
use std::collections::HashMap;

/// Upgrade the HTTP connection to a WebSocket and stream Docker logs for `id`.
pub async fn ws_logs(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(params): Query<HashMap<String, String>>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    let service = params.get("service").cloned();
    let engine = state.settings.read().await.container_engine.clone();

    ws.on_upgrade(move |socket| handle_ws(socket, id, service, engine))
}

async fn handle_ws(
    mut socket: WebSocket,
    project_name: String,
    service: Option<String>,
    engine: String,
) {
    info!(project_name = %project_name, service = ?service, "WS log session opened");

    // 1. Find all containers for this project
    let ps_res = tokio::process::Command::new(&engine)
        .args(["ps", "-a", "--format", "json"])
        .output()
        .await;

    let mut container_names = Vec::new();

    if let Ok(out) = ps_res {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            if let Ok(containers) = serde_json::from_str::<Vec<serde_json::Value>>(&stdout) {
                for c in containers {
                    let mut belongs_to_project = false;
                    let mut svc_name = None;
                    
                    if let Some(labels) = c.get("Labels").or_else(|| c.get("labels")).and_then(|v| v.as_object()) {
                        if let Some(p) = labels.get("com.docker.compose.project").or_else(|| labels.get("io.podman.compose.project")) {
                            if p.as_str() == Some(project_name.as_str()) {
                                belongs_to_project = true;
                            }
                        }
                        if let Some(s) = labels.get("com.docker.compose.service").or_else(|| labels.get("io.podman.compose.service")) {
                            svc_name = s.as_str().map(|s| s.to_string());
                        }
                    }
                    
                    if belongs_to_project {
                        let name = c.get("Names").or_else(|| c.get("names")).and_then(|v| v.as_array().and_then(|a| a.first())).and_then(|v| v.as_str())
                            .or_else(|| c.get("Id").or_else(|| c.get("id")).and_then(|v| v.as_str()));
                            
                        if let Some(n) = name {
                            if let Some(ref filter_svc) = service {
                                if svc_name.as_ref() == Some(filter_svc) {
                                    container_names.push(n.to_string());
                                }
                            } else {
                                container_names.push(n.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    if container_names.is_empty() {
        let _ = socket.send(Message::Text(format!("error: no containers found for project '{}'", project_name))).await;
        // Keep the socket open to prevent reconnect loops
        loop {
            if let Some(msg) = socket.recv().await {
                if let Ok(Message::Close(_)) = msg {
                    break;
                }
            } else {
                break;
            }
        }
        return;
    }

    let (tx, mut rx) = tokio::sync::mpsc::channel::<String>(100);
    let mut children = Vec::new();

    for cname in &container_names {
        let mut cmd = tokio::process::Command::new(&engine);
        cmd.args(["logs", "-f", "--tail", "100", "--names", cname]);
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());

        if let Ok(mut child) = cmd.spawn() {
            if let Some(stdout) = child.stdout.take() {
                let tx_clone = tx.clone();
                tokio::spawn(async move {
                    let mut lines = tokio::io::BufReader::new(stdout).lines();
                    while let Ok(Some(line)) = lines.next_line().await {
                        if tx_clone.send(line).await.is_err() {
                            break;
                        }
                    }
                });
            }
            if let Some(stderr) = child.stderr.take() {
                let tx_clone = tx.clone();
                tokio::spawn(async move {
                    let mut lines = tokio::io::BufReader::new(stderr).lines();
                    while let Ok(Some(line)) = lines.next_line().await {
                        if tx_clone.send(line).await.is_err() {
                            break;
                        }
                    }
                });
            }
            children.push(child);
        }
    }

    drop(tx);

    let mut stream_ended = false;
    loop {
        tokio::select! {
            line_opt = rx.recv(), if !stream_ended => {
                match line_opt {
                    Some(text) => {
                        if socket.send(Message::Text(text)).await.is_err() {
                            break;
                        }
                    }
                    None => {
                        let _ = socket.send(Message::Text("--- log stream ended, waiting for reconnect ---".into())).await;
                        let _ = socket.send(Message::Close(Some(axum::extract::ws::CloseFrame {
                            code: 1011,
                            reason: "Stream ended".into()
                        }))).await;
                        break;
                    }
                }
            }
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(Message::Ping(payload))) => {
                        let _ = socket.send(Message::Pong(payload)).await;
                    }
                    Some(Ok(Message::Text(text))) if text == "PING" => {
                        let _ = socket.send(Message::Text("PONG".into())).await;
                    }
                    _ => {}
                }
            }
        }
    }

    for mut child in children {
        let _ = child.kill().await;
    }
    info!(project_name = %project_name, "WS log session closed");
}

// ── WS /api/exec/:id/:service ──────────────────────────────────────────────────

use tokio::io::AsyncWriteExt;

/// Upgrade HTTP connection to WebSocket for live interactive container shell exec.
pub async fn ws_exec(
    State(state): State<AppState>,
    Path((id, service)): Path<(String, String)>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    let engine = state.settings.read().await.container_engine.clone();

    ws.on_upgrade(move |socket| handle_ws_exec(socket, id, service, engine))
}

async fn handle_ws_exec(mut socket: WebSocket, project_name: String, service: String, engine: String) {
    info!(project_name = %project_name, service = %service, "WS exec session opened");

    let mut child = match tokio::process::Command::new(&engine)
        .args([
            "compose",
            "-p",
            &project_name,
            "exec",
            "-T",
            &service,
            "sh",
        ])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            let _ = socket.send(Message::Text(format!("error spawning exec: {e}"))).await;
            return;
        }
    };

    let mut stdin = child.stdin.take().expect("stdin piped");
    let stdout = child.stdout.take().expect("stdout piped");
    let mut lines = tokio::io::BufReader::new(stdout).lines();

    loop {
        tokio::select! {
            line = lines.next_line() => {
                match line {
                    Ok(Some(text)) => {
                        if socket.send(Message::Text(text + "\r\n")).await.is_err() {
                            break;
                        }
                    }
                    _ => break,
                }
            }
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Text(input))) => {
                        let bytes = input.as_bytes();
                        if stdin.write_all(bytes).await.is_err() {
                            break;
                        }
                        let _ = stdin.flush().await;
                    }
                    Some(Ok(Message::Close(_))) | None => break,
                    _ => {}
                }
            }
        }
    }

    let _ = child.kill().await;
    info!(project_name = %project_name, service = %service, "WS exec session closed");
}

