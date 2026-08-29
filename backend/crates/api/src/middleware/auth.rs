//! Bearer-token authentication middleware using sessions.
//!
//! # Design
//!
//! Every endpoint, including WebSocket upgrades, is protected.  There are
//! **no** unauthenticated routes except for webhooks and the login endpoint itself.
//!
//! The token is a UUID session token stored in the `sessions` table in SQLite.
//!
//! # Usage
//!
//! Apply this middleware to the entire router in `router.rs` so it cannot be
//! accidentally excluded from a new route:
//!
//! ```ignore
//! Router::new()
//!     .route(...)
//!     .layer(from_fn_with_state(state.clone(), auth_middleware))
//! ```
//!
//! # Token format expected in requests
//!
//! ```text
//! Authorization: Bearer <token>
//! ```

use axum::{
    extract::{Request, State},
    http::{header::AUTHORIZATION, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

use crate::app_state::AppState;

/// Axum middleware function that validates the `Authorization: Bearer <token>`
/// header against the `sessions` table on every incoming request.
///
/// Returns `401 Unauthorized` with a JSON body on any failure:
/// - Missing header
/// - Malformed header (not `Bearer <token>`)
/// - Session expired or not found
pub async fn auth_middleware(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    let path = request.uri().path();
    
    // Webhook endpoints authenticate via the secret in the URL or query params.
    if path.starts_with("/api/webhooks/") || (path.starts_with("/api/stacks/") && path.ends_with("/webhook")) {
        return next.run(request).await;
    }

    // Login endpoint does not require authentication
    if path == "/api/auth/login" {
        return next.run(request).await;
    }

    // Static frontend files and non-API routes are not authenticated by this middleware.
    if !path.starts_with("/api/") {
        return next.run(request).await;
    }

    let token = match extract_bearer_token(&request) {
        Some(t) => t,
        None => {
            tracing::warn!(
                method = %request.method(),
                uri    = %request.uri(),
                "rejected request: missing Authorization header"
            );
            return unauthorized_response("missing Authorization header");
        }
    };

    // Validate token against the database
    let pool = state.db.clone();
    let is_valid = match sqlx::query!(
        "SELECT token FROM sessions WHERE token = ? AND expires_at > CURRENT_TIMESTAMP",
        token
    )
    .fetch_optional(&pool)
    .await
    {
        Ok(Some(_)) => true,
        _ => false,
    };

    if is_valid {
        next.run(request).await
    } else {
        tracing::warn!(
            method = %request.method(),
            uri    = %request.uri(),
            "rejected request: invalid or expired session token"
        );
        unauthorized_response("invalid or expired session token")
    }
}

// ── helpers ────────────────────────────────────────────────────────────────────

/// Extract the raw token string from `Authorization: Bearer <token>` or `?token=<token>`.
fn extract_bearer_token(request: &Request) -> Option<&str> {
    if let Some(header_val) = request.headers().get(AUTHORIZATION).and_then(|h| h.to_str().ok()) {
        if let Some(token) = header_val.strip_prefix("Bearer ") {
            return Some(token);
        }
    }

    // Support `?token=<token>` for browser WebSocket connections
    if let Some(query) = request.uri().query() {
        for pair in query.split('&') {
            if let Some((k, v)) = pair.split_once('=') {
                if k == "token" {
                    return Some(v);
                }
            }
        }
    }

    None
}

fn unauthorized_response(reason: &str) -> Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(json!({ "error": reason })),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_bearer_token_happy_path() {
        use axum::http::Request;
        let req = Request::builder()
            .header("Authorization", "Bearer my-secret-token")
            .body(axum::body::Body::empty())
            .unwrap();
        assert_eq!(extract_bearer_token(&req), Some("my-secret-token"));
    }

    #[test]
    fn extract_bearer_token_missing_returns_none() {
        let req = Request::builder()
            .body(axum::body::Body::empty())
            .unwrap();
        assert_eq!(extract_bearer_token(&req), None);
    }

    #[test]
    fn extract_bearer_token_wrong_scheme_returns_none() {
        let req = Request::builder()
            .header("Authorization", "Basic dXNlcjpwYXNz")
            .body(axum::body::Body::empty())
            .unwrap();
        assert_eq!(extract_bearer_token(&req), None);
    }
}
