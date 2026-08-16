//! Bearer-token authentication middleware.
//!
//! # Design
//!
//! Every endpoint, including WebSocket upgrades, is protected.  There are
//! **no** unauthenticated routes (v1 requirement).
//!
//! The token is a single static secret stored in the `GITOPS_TOKEN` env var
//! and loaded once at startup into `AppState::bearer_token`.  It is compared
//! via constant-time equality to prevent timing attacks.
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
/// header on every incoming request.
///
/// Returns `401 Unauthorized` with a JSON body on any failure:
/// - Missing header
/// - Malformed header (not `Bearer <token>`)
/// - Token value doesn't match `GITOPS_TOKEN`
pub async fn auth_middleware(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    match extract_bearer_token(&request) {
        Some(token) if constant_time_eq(token, &state.bearer_token) => {
            // Token is valid — let the request proceed.
            next.run(request).await
        }
        Some(_) => {
            // Token present but wrong.
            tracing::warn!(
                method = %request.method(),
                uri    = %request.uri(),
                "rejected request: invalid bearer token"
            );
            unauthorized_response("invalid token")
        }
        None => {
            // No Authorization header or wrong scheme.
            tracing::warn!(
                method = %request.method(),
                uri    = %request.uri(),
                "rejected request: missing Authorization header"
            );
            unauthorized_response("missing Authorization header")
        }
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

/// Constant-time string equality to mitigate timing-based side-channel attacks.
/// `std::cmp::PartialEq` on `str` is NOT guaranteed to be constant-time.
fn constant_time_eq(a: &str, b: &str) -> bool {
    // Use an XOR-accumulate pattern so the compiler cannot short-circuit.
    // For production deployments consider the `subtle` crate for hardware
    // constant-time guarantees if the threat model requires it.
    if a.len() != b.len() {
        return false;
    }
    a.bytes()
        .zip(b.bytes())
        .fold(0u8, |acc, (x, y)| acc | (x ^ y))
        == 0
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

    #[test]
    fn constant_time_eq_matching_tokens() {
        assert!(constant_time_eq("correct-horse-battery-staple", "correct-horse-battery-staple"));
    }

    #[test]
    fn constant_time_eq_different_tokens() {
        assert!(!constant_time_eq("abc", "xyz"));
    }

    #[test]
    fn constant_time_eq_different_lengths() {
        assert!(!constant_time_eq("short", "much-longer-string"));
    }
}
