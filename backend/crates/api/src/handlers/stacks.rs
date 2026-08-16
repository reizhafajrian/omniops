//! REST handlers for stack management endpoints.
//!
//! All handlers are thin: they parse the request, acquire the per-stack lock
//! where necessary, invoke the appropriate use-case, and return a response.
//! Business logic lives exclusively in the domain use-cases.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;

use domain::entities::stack::StackId;

use crate::app_state::AppState;

// ── GET /api/stacks ────────────────────────────────────────────────────────────

/// Returns the current sync status of all configured stacks.
///
/// Combines config data with persisted state from SQLite.
pub async fn list_stacks(State(state): State<AppState>) -> impl IntoResponse {
    let stacks = state.load_all_stacks().await;
    Json(json!({ "stacks": stacks }))
}

// ── GET /api/stacks/:id/history ────────────────────────────────────────────────

/// Returns the most recent 50 sync events for a single stack.
pub async fn get_stack_history(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let stack_id = match StackId::new(&id) {
        Ok(sid) => sid,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": format!("invalid stack id: {e}") })),
            )
                .into_response()
        }
    };

    if state.find_stack_config(&stack_id).await.is_none() {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": format!("stack '{}' not found", id) })),
        )
            .into_response();
    }

    match state.store.list_events(&stack_id, 50).await {
        Ok(events) => Json(json!({ "events": events })).into_response(),
        Err(e) => {
            tracing::error!(stack_id = %stack_id, error = %e, "failed to load history");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "failed to load history" })),
            )
                .into_response()
        }
    }
}

// ── POST /api/stacks/:id/sync ──────────────────────────────────────────────────

/// Manually triggers a pull + reconcile for one stack.
///
/// Respects the per-stack mutex: if a sync is already in progress (e.g., from
/// the scheduled loop), this returns `409 Conflict` immediately rather than
/// queuing a duplicate.
pub async fn trigger_sync(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let stack_id = match StackId::new(&id) {
        Ok(sid) => sid,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": format!("invalid stack id: {e}") })),
            )
                .into_response()
        }
    };

    let stack = match state.load_stack(&stack_id).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": format!("stack '{}' not found", id) })),
            )
                .into_response()
        }
    };

    let lock = match state.lock_for(&stack_id).await {
        Some(l) => l,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": format!("stack '{}' not found", id) })),
            )
                .into_response()
        }
    };

    // try_lock returns immediately without blocking — if someone else holds it
    // we return 409 instead of queuing a duplicate sync.
    let _guard = match lock.try_lock() {
        Ok(g) => g,
        Err(_) => {
            return (
                StatusCode::CONFLICT,
                Json(json!({
                    "error": "sync already in progress for this stack"
                })),
            )
                .into_response()
        }
    };

    let uc = state.sync_use_case();
    match uc
        .execute(stack, domain::entities::sync_event::EventKind::ManualSync)
        .await
    {
        Ok(updated) => Json(json!({
            "message": "sync triggered",
            "stack": updated
        }))
        .into_response(),
        Err(e) => {
            tracing::error!(stack_id = %stack_id, error = %e, "manual sync failed");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("{e}") })),
            )
                .into_response()
        }
    }
}

// ── POST /api/stacks/:id/stop ──────────────────────────────────────────────────

/// Stops all containers and networks for a given stack.
pub async fn stop_stack(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let stack_id = match StackId::new(&id) {
        Ok(sid) => sid,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": format!("invalid stack id: {e}") })),
            )
                .into_response()
        }
    };

    // Ensure the stack exists
    if state.load_stack(&stack_id).await.is_none() {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": format!("stack '{}' not found", id) })),
        )
            .into_response();
    }

    let lock = match state.lock_for(&stack_id).await {
        Some(l) => l,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": format!("stack '{}' not found", id) })),
            )
                .into_response()
        }
    };

    let _guard = match lock.try_lock() {
        Ok(g) => g,
        Err(_) => {
            return (
                StatusCode::CONFLICT,
                Json(json!({
                    "error": "action in progress for this stack"
                })),
            )
                .into_response()
        }
    };
    let stack_opt = state.load_stack(&stack_id).await;
    let mut working_dir = None;
    let mut dir_buf = std::path::PathBuf::new();

    if let Some(ref stack) = stack_opt {
        let is_inline = stack.config.source_type == "inline";
        let mut dir_exists = false;
        
        if is_inline {
            let dir = std::env::temp_dir().join("omniops_inline").join(stack_id.as_str());
            if dir.exists() {
                dir_buf = dir;
                dir_exists = true;
            }
        } else if let Some(ref c) = stack.last_synced_commit {
            let dir = std::env::temp_dir()
                .join("omniops_checkouts")
                .join(stack_id.as_str())
                .join(c);
            if dir.exists() {
                dir_buf = dir;
                dir_exists = true;
            }
        }

        if dir_exists {
            working_dir = Some(dir_buf.as_path());
        }
    }

    let reconciler = &state.reconciler;
    let machine_name = stack_opt.as_ref().and_then(|s| s.config.machine_name.as_deref());
    match reconciler.stop(&stack_id, working_dir, machine_name).await {
        Ok(_) => {
            if let Some(mut stack) = stack_opt {
                stack.state = domain::entities::deployment_state::DeploymentState::Stopped;
                let _ = state.store.save_stack_state(&stack).await;
            }

            Json(json!({
                "message": "stack stopped successfully"
            }))
            .into_response()
        },
        Err(e) => {
            tracing::error!(stack_id = %stack_id, error = %e, "failed to stop stack");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("{e}") })),
            )
                .into_response()
        }
    }
}

// ── POST /api/stacks/:id/rollback ──────────────────────────────────────────────

/// Re-applies the last known-good commit for one stack.
pub async fn trigger_rollback(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let stack_id = match StackId::new(&id) {
        Ok(sid) => sid,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": format!("invalid stack id: {e}") })),
            )
                .into_response()
        }
    };

    let stack = match state.load_stack(&stack_id).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": format!("stack '{}' not found", id) })),
            )
                .into_response()
        }
    };

    let lock = match state.lock_for(&stack_id).await {
        Some(l) => l,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": format!("stack '{}' not found", id) })),
            )
                .into_response()
        }
    };

    let _guard = match lock.try_lock() {
        Ok(g) => g,
        Err(_) => {
            return (
                StatusCode::CONFLICT,
                Json(json!({
                    "error": "sync already in progress — cannot rollback now"
                })),
            )
                .into_response()
        }
    };

    let uc = state.rollback_use_case();
    match uc.execute(stack).await {
        Ok(updated) => Json(json!({
            "message": "rollback triggered",
            "stack": updated
        }))
        .into_response(),
        Err(e) => {
            tracing::error!(stack_id = %stack_id, error = %e, "rollback failed");
            (
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(json!({ "error": format!("{e}") })),
            )
                .into_response()
        }
    }
}

// ── POST /api/stacks ────────────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
pub struct CreateStackPayload {
    pub id: String,
    pub source_type: Option<String>,
    pub inline_compose: Option<String>,
    pub repo_url: Option<String>,
    pub branch: Option<String>,
    pub compose_path: Option<String>,
    pub poll_interval_secs: Option<u64>,
    pub pat_token: Option<String>,
    pub env_vars: Option<String>,
    pub registry_host: Option<String>,
    pub registry_user: Option<String>,
    pub registry_pass: Option<String>,
    pub sync_mode: Option<String>,
    pub is_protected: Option<bool>,
    pub security_pin: Option<String>,
    pub machine_name: Option<String>,
}

/// Register a new stack dynamically via the UI dashboard.
pub async fn create_stack(
    State(state): State<AppState>,
    Json(payload): Json<CreateStackPayload>,
) -> impl IntoResponse {
    let stack_id = match StackId::new(&payload.id) {
        Ok(sid) => sid,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": format!("invalid stack id: {e}") })),
            )
                .into_response()
        }
    };

    let mut auth = None;
    if let Some(pat) = payload.pat_token.as_ref().filter(|t| !t.trim().is_empty()) {
        let env_var_name = format!("STACK_{}_PAT", stack_id.as_str().to_uppercase().replace('-', "_"));
        std::env::set_var(&env_var_name, pat.trim());
        auth = Some(domain::entities::stack::AuthRef::Pat {
            pat_env: env_var_name,
        });
    } else if std::env::var("GITHUB_PAT").ok().filter(|t| !t.trim().is_empty()).is_some() {
        auth = Some(domain::entities::stack::AuthRef::Pat {
            pat_env: "GITHUB_PAT".to_string(),
        });
    }

    let webhook_secret = uuid::Uuid::new_v4().simple().to_string();

    let source_type = payload.source_type.unwrap_or_else(|| "git".to_string());
    
    let config = domain::entities::stack::StackConfig {
        id: stack_id.clone(),
        source_type: source_type.clone(),
        inline_compose: payload.inline_compose,
        repo_url: payload.repo_url.unwrap_or_default().trim().to_string(),
        branch: {
            let b = payload.branch.unwrap_or_default();
            if b.trim().is_empty() { "main".to_string() } else { b.trim().to_string() }
        },
        compose_path: {
            let cp = payload.compose_path.unwrap_or_default();
            if cp.trim().is_empty() { "docker-compose.yml".to_string() } else { cp.trim().to_string() }
        },
        poll_interval_secs: payload.poll_interval_secs.unwrap_or(60),
        auth,
        env_vars: payload.env_vars.filter(|s| !s.trim().is_empty()),
        registry_host: payload.registry_host.filter(|s| !s.trim().is_empty()),
        registry_user: payload.registry_user.filter(|s| !s.trim().is_empty()),
        registry_pass: payload.registry_pass.filter(|s| !s.trim().is_empty()),
        sync_mode: payload.sync_mode.unwrap_or_else(|| "poll".to_string()),
        webhook_secret: Some(webhook_secret),
        is_protected: payload.is_protected.unwrap_or(false),
        security_pin: payload.security_pin.filter(|s| !s.trim().is_empty()),
        machine_name: payload.machine_name.filter(|m| !m.trim().is_empty()),
    };

    if let Err(e) = state.add_stack(config.clone()).await {
        return (
            StatusCode::CONFLICT,
            Json(json!({ "error": e })),
        )
            .into_response();
    }

    // Persist stack config permanently to SQLite database
    let pat_val = payload.pat_token.as_deref();
    if let Err(e) = state.store.save_stack_config(&config, pat_val).await {
        tracing::error!(stack_id = %stack_id, error = %e, "failed to persist stack_config to SQLite");
    }

    // Spawn background reconcile loop for this newly added stack
    crate::reconcile_loop::spawn_single_reconcile_loop(state.clone(), config.clone());

    // Trigger an initial sync in background
    let state_clone = state.clone();
    let config_clone = config.clone();
    tokio::spawn(async move {
        if let Some(stack) = state_clone.load_stack(&config_clone.id).await {
            let uc = state_clone.sync_use_case();
            let _ = uc
                .execute(stack, domain::entities::sync_event::EventKind::ManualSync)
                .await;
        }
    });

    let created_stack = state.load_stack(&stack_id).await.unwrap_or_else(|| {
        domain::entities::stack::Stack::new_from_config(config)
    });

    (
        StatusCode::CREATED,
        Json(json!({
            "message": "stack registered and sync initiated",
            "stack": created_stack
        })),
    )
        .into_response()
}

// ── DELETE /api/stacks/:id ──────────────────────────────────────────────────────

/// Delete a stack and clean up running Docker containers in the background if they exist.
pub async fn delete_stack(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let stack_id = match StackId::new(&id) {
        Ok(sid) => sid,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": format!("invalid stack id: {e}") })),
            )
                .into_response()
        }
    };

    let stack_id_str = stack_id.to_string();

    // Verify stack exists
    if state.find_stack_config(&stack_id).await.is_none() {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": format!("stack '{id}' not found") })),
        )
            .into_response();
    }

    // Spawn background task to bring down containers if running
    let stack_id_bg = stack_id_str.clone();
    let engine = state.settings.read().await.container_engine.clone();

    tokio::spawn(async move {
        tracing::info!(stack_id = %stack_id_bg, "spawning background container engine compose down for deleted stack");
        let _ = tokio::process::Command::new(&engine)
            .args(["compose", "-p", &stack_id_bg, "down", "--remove-orphans"])
            .output()
            .await;
    });

    // Remove from in-memory AppState and delete from SQLite database
    state.remove_stack(&stack_id).await;
    let _ = state.store.delete_stack_config(&stack_id).await;

    (
        StatusCode::OK,
        Json(json!({
            "message": format!("stack '{id}' deleted and background container cleanup initiated"),
            "stack_id": id
        })),
    )
        .into_response()
}

// ── GET /api/stacks/:id/services ────────────────────────────────────────────────

/// Enumerate all individual services/containers belonging to a compose stack with CPU, RAM, Volumes & Networks.
pub async fn get_stack_services(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let stack_id = match StackId::new(&id) {
        Ok(sid) => sid,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": format!("invalid stack id: {e}") })),
            )
                .into_response()
        }
    };

    let stack_config = match state.find_stack_config(&stack_id).await {
        Some(c) => c,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": format!("stack '{id}' not found") })),
            )
                .into_response();
        }
    };

    match state.docker_inspector.get_services(&stack_id, &stack_config).await {
        Ok(services) => Json(json!({ "services": services })).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("failed to inspect services: {}", e) })),
        )
            .into_response(),
    }
}

pub async fn get_stack_compose(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let stack_id = match StackId::new(&id) {
        Ok(sid) => sid,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": format!("invalid stack id: {e}") })),
            )
                .into_response()
        }
    };

    let stack_config = match state.find_stack_config(&stack_id).await {
        Some(c) => c,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": format!("stack '{id}' not found") })),
            )
                .into_response();
        }
    };

    // The compose file is persisted during sync to `workspaces/{stack_id}/{compose_path}`.
    let workspace_dir = std::path::Path::new("workspaces").join(stack_id.as_str());
    let compose_file_name = stack_config.compose_path.trim_start_matches('/');
    let workspace_compose_path = workspace_dir.join(compose_file_name);

    match tokio::fs::read_to_string(&workspace_compose_path).await {
        Ok(content) => Json(json!({ "compose_content": content })).into_response(),
        Err(e) => {
            if stack_config.source_type == "inline" {
                if let Some(inline) = &stack_config.inline_compose {
                    return Json(json!({ "compose_content": inline })).into_response();
                }
            }
            
            (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": format!("compose file not found or not synced yet: {e}") })),
            )
                .into_response()
        }
    }
}

// ── POST /api/stacks/:id/clean (Clean containers & volumes) ────────────────────

/// Clean stack containers AND volumes (`docker compose down -v`).
pub async fn clean_stack_volumes(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let stack_id = match StackId::new(&id) {
        Ok(sid) => sid,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": format!("invalid stack id: {e}") })),
            )
                .into_response()
        }
    };

    if state.find_stack_config(&stack_id).await.is_none() {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": format!("stack '{id}' not found") })),
        )
            .into_response();
    }

    let engine = state.settings.read().await.container_engine.clone();

    // Reconstruct the workspace directory where the compose file is stored
    let workspace_dir = std::path::Path::new("workspaces").join(stack_id.as_str());
    let stack_config = state.find_stack_config(&stack_id).await.unwrap(); // we already checked above
    let compose_file_name = stack_config.compose_path.trim_start_matches('/');

    let mut command = tokio::process::Command::new(&engine);
    if workspace_dir.exists() {
        command.current_dir(&workspace_dir);
    }
    
    command.args([
        "compose", 
        "-f", 
        compose_file_name,
        "-p", 
        stack_id.as_str(), 
        "down", 
        "-v", 
        "--remove-orphans"
    ]);

    let output = command.output().await;

    match output {
        Ok(out) if out.status.success() => (
            StatusCode::OK,
            Json(json!({
                "message": format!("stack '{id}' containers, networks, and persistent volumes cleaned successfully"),
                "stack_id": id
            })),
        )
            .into_response(),
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": format!("failed to clean stack volumes: {stderr}") })),
            )
                .into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("failed to execute docker compose down: {e}") })),
        )
            .into_response(),
    }
}

// ── POST /api/system/prune (Prune unused volumes & networks) ─────────────────

/// System-wide Docker volume and network prune.
pub async fn prune_system_resources(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let engine = state.settings.read().await.container_engine.clone();

    let vol_output = tokio::process::Command::new(&engine)
        .args(["volume", "prune", "-f"])
        .output()
        .await;

    let net_output = tokio::process::Command::new(&engine)
        .args(["network", "prune", "-f"])
        .output()
        .await;

    let mut messages = Vec::new();

    if let Ok(out) = vol_output {
        let txt = String::from_utf8_lossy(&out.stdout).to_string();
        messages.push(format!("Volume prune: {}", txt.trim()));
    }

    if let Ok(out) = net_output {
        let txt = String::from_utf8_lossy(&out.stdout).to_string();
        messages.push(format!("Network prune: {}", txt.trim()));
    }

    (
        StatusCode::OK,
        Json(json!({
            "message": "system volume and network prune completed successfully",
            "details": messages
        })),
    )
        .into_response()
}

// ── PUT /api/stacks/:id ─────────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
pub struct UpdateStackPayload {
    pub source_type: Option<String>,
    pub inline_compose: Option<String>,
    pub repo_url: Option<String>,
    pub branch: Option<String>,
    pub compose_path: Option<String>,
    pub poll_interval_secs: Option<u64>,
    pub pat_token: Option<String>,
    pub env_vars: Option<String>,
    pub registry_host: Option<String>,
    pub registry_user: Option<String>,
    pub registry_pass: Option<String>,
    pub sync_mode: Option<String>,
    pub regenerate_webhook: Option<bool>,
    pub is_protected: Option<bool>,
    pub security_pin: Option<String>,
    pub machine_name: Option<String>,
}

/// Update configuration for an existing stack.
pub async fn update_stack(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateStackPayload>,
) -> impl IntoResponse {
    let stack_id = match StackId::new(&id) {
        Ok(sid) => sid,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": format!("invalid stack id: {e}") })),
            )
                .into_response()
        }
    };

    let existing_config = match state.find_stack_config(&stack_id).await {
        Some(c) => c,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": format!("stack '{id}' not found") })),
            )
                .into_response()
        }
    };

    let mut auth = existing_config.auth.clone();
    if let Some(pat) = payload.pat_token.as_ref().filter(|t| !t.trim().is_empty()) {
        let env_var_name = format!("STACK_{}_PAT", stack_id.as_str().to_uppercase().replace('-', "_"));
        std::env::set_var(&env_var_name, pat.trim());
        auth = Some(domain::entities::stack::AuthRef::Pat {
            pat_env: env_var_name,
        });
    }

    let env_vars = if let Some(ev) = payload.env_vars {
        if ev.trim().is_empty() { None } else { Some(ev) }
    } else {
        existing_config.env_vars
    };

    let registry_host = if let Some(rh) = payload.registry_host {
        if rh.trim().is_empty() { None } else { Some(rh) }
    } else {
        existing_config.registry_host
    };

    let registry_user = if let Some(ru) = payload.registry_user {
        if ru.trim().is_empty() { None } else { Some(ru) }
    } else {
        existing_config.registry_user
    };

    let registry_pass = if let Some(rp) = payload.registry_pass {
        if rp.trim().is_empty() { None } else { Some(rp) }
    } else {
        existing_config.registry_pass
    };

    let sync_mode = payload.sync_mode.unwrap_or(existing_config.sync_mode);

    let webhook_secret = if payload.regenerate_webhook.unwrap_or(false) || existing_config.webhook_secret.is_none() {
        Some(uuid::Uuid::new_v4().simple().to_string())
    } else {
        existing_config.webhook_secret
    };

    let is_protected = payload.is_protected.unwrap_or(existing_config.is_protected);

    let security_pin = if let Some(sp) = payload.security_pin {
        if sp.trim().is_empty() { None } else { Some(sp.trim().to_string()) }
    } else {
        existing_config.security_pin
    };

    let machine_name = if let Some(m) = payload.machine_name {
        if m.trim().is_empty() { None } else { Some(m.trim().to_string()) }
    } else {
        existing_config.machine_name
    };

    let new_config = domain::entities::stack::StackConfig {
        id: stack_id.clone(),
        source_type: payload.source_type.unwrap_or(existing_config.source_type),
        inline_compose: payload.inline_compose.or(existing_config.inline_compose),
        repo_url: payload.repo_url.unwrap_or(existing_config.repo_url),
        branch: payload.branch.unwrap_or(existing_config.branch),
        compose_path: payload.compose_path.unwrap_or(existing_config.compose_path),
        poll_interval_secs: payload.poll_interval_secs.unwrap_or(existing_config.poll_interval_secs),
        auth,
        env_vars,
        registry_host,
        registry_user,
        registry_pass,
        sync_mode,
        webhook_secret,
        is_protected,
        security_pin,
        machine_name,
    };

    // Update in-memory AppState
    state.remove_stack(&stack_id).await;
    let _ = state.add_stack(new_config.clone()).await;

    // Persist to SQLite
    let pat_val = payload.pat_token.as_deref();
    let _ = state.store.save_stack_config(&new_config, pat_val).await;

    let updated_stack = state.load_stack(&stack_id).await.unwrap_or_else(|| {
        domain::entities::stack::Stack::new_from_config(new_config)
    });

    (
        StatusCode::OK,
        Json(json!({
            "message": "stack configuration updated successfully",
            "stack": updated_stack
        })),
    )
        .into_response()
}

// ── POST /api/stacks/:id/services/:service/limits ─────────────────────────────

#[derive(serde::Deserialize)]
pub struct UpdateServiceLimitsPayload {
    pub cpus: Option<String>,
    pub memory: Option<String>,
}

/// Dynamically update CPU and RAM limits for a running container service via `docker update`.
pub async fn update_service_limits(
    State(state): State<AppState>,
    Path((id, service)): Path<(String, String)>,
    Json(payload): Json<UpdateServiceLimitsPayload>,
) -> impl IntoResponse {
    let stack_id = match StackId::new(&id) {
        Ok(sid) => sid,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": format!("invalid stack id: {e}") })),
            )
                .into_response()
        }
    };

    if state.find_stack_config(&stack_id).await.is_none() {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": format!("stack '{id}' not found") })),
        )
            .into_response();
    }

    let mut args = vec!["update".to_string()];

    if let Some(ref cpus) = payload.cpus {
        if !cpus.trim().is_empty() {
            args.push("--cpus".to_string());
            args.push(cpus.trim().to_string());
        }
    }

    if let Some(ref mem) = payload.memory {
        if !mem.trim().is_empty() {
            args.push("--memory".to_string());
            args.push(mem.trim().to_string());
        }
    }

    if args.len() == 1 {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "neither cpus nor memory limit provided" })),
        )
            .into_response();
    }

    // Target container ID / name: e.g. <stack_id>-<service>-1 or service name
    let container_target = format!("{}-{}-1", stack_id.as_str(), service);
    args.push(container_target.clone());

    let engine = state.settings.read().await.container_engine.clone();

    let output = tokio::process::Command::new(&engine)
        .args(&args)
        .output()
        .await;

    match output {
        Ok(out) if out.status.success() => (
            StatusCode::OK,
            Json(json!({
                "message": format!("Successfully updated limits for service '{}'", service),
                "target": container_target,
                "cpus": payload.cpus,
                "memory": payload.memory,
            })),
        )
            .into_response(),
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            // Fallback: try updating by service name directly
            args.pop();
            args.push(service.clone());
            if let Ok(out2) = tokio::process::Command::new(&engine).args(&args).output().await {
                if out2.status.success() {
                    return (
                        StatusCode::OK,
                        Json(json!({
                            "message": format!("Successfully updated limits for service '{}'", service),
                            "target": service,
                            "cpus": payload.cpus,
                            "memory": payload.memory,
                        })),
                    )
                        .into_response();
                }
            }

            (
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(json!({ "error": format!("docker update failed: {}", stderr) })),
            )
                .into_response()
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": format!("failed to execute docker update: {}", e) })),
        )
            .into_response(),
    }
}

// ── POST /api/stacks/:id/verify-pin ──────────────────────────────────────────

#[derive(serde::Deserialize)]
pub struct VerifyPinPayload {
    pub pin: String,
}

/// Verify security PIN for a protected stack.
pub async fn verify_stack_pin(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<VerifyPinPayload>,
) -> impl IntoResponse {
    let stack_id = match StackId::new(&id) {
        Ok(sid) => sid,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": format!("invalid stack id: {e}") })),
            )
                .into_response()
        }
    };

    let config = match state.find_stack_config(&stack_id).await {
        Some(c) => c,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": format!("stack '{id}' not found") })),
            )
                .into_response()
        }
    };

    if !config.is_protected {
        return (StatusCode::OK, Json(json!({ "valid": true, "message": "stack is not protected" }))).into_response();
    }

    let expected_pin = config.security_pin.as_deref().unwrap_or("1234");
    if payload.pin.trim() == expected_pin {
        (StatusCode::OK, Json(json!({ "valid": true }))).into_response()
    } else {
        (StatusCode::UNAUTHORIZED, Json(json!({ "valid": false, "error": "Invalid Security PIN code" }))).into_response()
    }
}



