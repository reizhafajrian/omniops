use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use domain::entities::sync_event::EventKind;
use serde::Deserialize;
use serde_json::json;

use crate::app_state::AppState;

#[derive(Deserialize)]
pub struct WebhookQuery {
    pub secret: Option<String>,
}

/// Universal Webhook Endpoint (`POST /api/webhooks/:secret`).
///
/// Can be registered directly in GitHub, GitLab, Bitbucket, Gitea, or custom CI/CD pipelines.
/// Does not require Bearer token authentication — authenticated via secret token matching.
pub async fn handle_webhook_by_secret(
    State(state): State<AppState>,
    Path(secret): Path<String>,
) -> impl IntoResponse {
    process_webhook_trigger(&state, &secret).await
}

/// Per-stack Webhook Endpoint (`POST /api/stacks/:id/webhook?secret=<secret>`).
pub async fn handle_webhook_by_stack_id(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(query): Query<WebhookQuery>,
) -> impl IntoResponse {
    let secret = match query.secret {
        Some(s) if !s.trim().is_empty() => s,
        _ => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "missing 'secret' query parameter for stack webhook" })),
            )
                .into_response()
        }
    };

    let configs = state.stacks.read().await.clone();
    let target_config = match configs.into_iter().find(|c| c.id.as_str() == id) {
        Some(c) => c,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": format!("stack '{id}' not found") })),
            )
                .into_response()
        }
    };

    if target_config.webhook_secret.as_deref() != Some(&secret) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": "invalid webhook secret key for this stack" })),
        )
            .into_response();
    }

    process_webhook_trigger(&state, &secret).await
}

async fn process_webhook_trigger(state: &AppState, secret: &str) -> axum::response::Response {
    let configs = state.stacks.read().await.clone();
    let target_config = match configs.into_iter().find(|c| c.webhook_secret.as_deref() == Some(secret)) {
        Some(c) => c,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({ "error": "invalid or unrecognized webhook secret token" })),
            )
                .into_response();
        }
    };

    if target_config.sync_mode == "poll" {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({
                "error": format!("webhook sync is disabled for stack '{}' (sync_mode is set to 'poll')", target_config.id)
            })),
        )
            .into_response();
    }

    let stack_id = target_config.id.clone();
    let stack = match state.load_stack(&stack_id).await {
        Some(s) => s,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": format!("stack '{}' state not found", stack_id) })),
            )
                .into_response();
        }
    };

    let lock = match state.lock_for(&stack_id).await {
        Some(l) => l,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": format!("stack '{}' lock missing", stack_id) })),
            )
                .into_response();
        }
    };

    let guard = match lock.clone().try_lock_owned() {
        Ok(g) => g,
        Err(_) => {
            return (
                StatusCode::CONFLICT,
                Json(json!({ "error": format!("reconciliation already in progress for stack '{}'", stack_id) })),
            )
                .into_response();
        }
    };

    let uc = state.sync_use_case();
    let stack_id_clone = stack_id.clone();
    
    tokio::spawn(async move {
        let _held_guard = guard;
        match uc.execute(stack, EventKind::WebhookSync).await {
            Ok(_) => {
                tracing::info!("Webhook auto-deployment completed successfully for stack '{}'", stack_id_clone);
            }
            Err(e) => {
                tracing::error!("Webhook auto-deployment failed for stack '{}': {}", stack_id_clone, e);
            }
        }
    });

    (
        StatusCode::ACCEPTED,
        Json(json!({
            "message": format!("Webhook payload received. Auto-deployment triggered in background for stack '{}'", stack_id)
        })),
    )
        .into_response()
}
