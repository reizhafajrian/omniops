//! Axum router assembly.
//!
//! All routes are protected by the bearer-token middleware.  There is no
//! unauthenticated route in v1 — not even a health check — because the engine
//! is intended to run on a private network behind a reverse proxy.

use axum::{
    middleware::from_fn_with_state,
    routing::{delete, get, post},
    Router,
};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

use crate::{
    app_state::AppState,
    handlers::{
        logs::{ws_exec, ws_logs},
        stacks::{clean_stack_volumes, create_stack, delete_stack, get_stack_history, get_stack_services, get_stack_compose, list_stacks, prune_system_resources, trigger_rollback, trigger_sync, update_service_limits, update_stack, verify_stack_pin, stop_stack},
        system::{get_docker_status, start_docker_daemon, list_machines, create_machine, start_machine, stop_machine, delete_machine, get_system_metrics, inspect_machine, inspect_container, start_container, stop_container, restart_container, remove_container, get_container_logs, get_container_stats, ws_machine_project_logs},
        webhooks::{handle_webhook_by_secret, handle_webhook_by_stack_id},
        settings::{get_settings, update_settings},
    },
    middleware::auth::auth_middleware,
};

/// Build and return the complete Axum router.
///
/// The `auth_middleware` layer is added **last** (outermost in tower's layer
/// order, which means it runs first on every request) to guarantee every
/// route — including the WS upgrade — is authenticated before any handler
/// is invoked.
pub fn build_router(state: AppState) -> Router {
    Router::new()
        // ── Webhook triggers (Unauthenticated by Bearer token, authenticated by secret) ──
        .route("/api/webhooks/:secret", post(handle_webhook_by_secret))
        .route("/api/stacks/:id/webhook", post(handle_webhook_by_stack_id))
        // ── Settings ─────────────────────────────────────────────────────────
        .route("/api/settings", get(get_settings).put(update_settings))
        // ── Stack REST endpoints ─────────────────────────────────────────────
        .route("/api/stacks", get(list_stacks).post(create_stack))
        .route("/api/stacks/:id", delete(delete_stack).put(update_stack))
        .route("/api/stacks/:id/verify-pin", post(verify_stack_pin))
        .route("/api/stacks/:id/services", get(get_stack_services))
        .route("/api/stacks/:id/compose", get(get_stack_compose))
        .route("/api/stacks/:id/services/:service/limits", post(update_service_limits))
        .route("/api/stacks/:id/clean", post(clean_stack_volumes))
        .route("/api/stacks/:id/history", get(get_stack_history))
        .route("/api/stacks/:id/sync", post(trigger_sync))
        .route("/api/stacks/:id/stop", post(stop_stack))
        .route("/api/stacks/:id/rollback", post(trigger_rollback))
        .route("/api/system/prune", post(prune_system_resources))
        .route("/api/system/metrics", get(get_system_metrics))
        .route("/api/system/docker/status", get(get_docker_status))
        .route("/api/system/docker/start", post(start_docker_daemon))
        .route("/api/system/machines", get(list_machines).post(create_machine))
        .route("/api/system/machines/:name/start", post(start_machine))
        .route("/api/system/machines/:name/stop", post(stop_machine))
        .route("/api/system/machines/:name", delete(delete_machine))
        .route("/api/system/machines/:name/inspect", get(inspect_machine))
        .route("/api/system/containers/:name/inspect", get(inspect_container))
        .route("/api/system/containers/:name/start", post(start_container))
        .route("/api/system/containers/:name/stop", post(stop_container))
        .route("/api/system/containers/:name/restart", post(restart_container))
        .route("/api/system/containers/:name", delete(remove_container))
        .route("/api/system/containers/:name/logs", get(get_container_logs))
        .route("/api/system/containers/:name/stats", get(get_container_stats))
        .route("/api/system/machines/:machine/projects/:project/logs", get(ws_machine_project_logs))
        // ── WebSocket log & shell exec streaming ─────────────────────────────
        .route("/api/logs/:id", get(ws_logs))
        .route("/api/exec/:id/:service", get(ws_exec))
        // ── State ────────────────────────────────────────────────────────────
        .with_state(state.clone())
        // ── Middleware stack (applied in reverse registration order) ─────────
        // TraceLayer adds structured HTTP request/response spans.
        .layer(TraceLayer::new_for_http())
        // CorsLayer — permissive for dev; tighten for production.
        .layer(
            CorsLayer::new()
                .allow_origin(tower_http::cors::Any)
                .allow_methods(tower_http::cors::Any)
                .allow_headers(tower_http::cors::Any),
        )
        // Auth middleware — outermost layer, runs first on every request.
        .layer(from_fn_with_state(state, auth_middleware))
        // Serve embedded static frontend files for all unknown routes
        .fallback(axum::routing::get(crate::static_files::static_handler))
}
