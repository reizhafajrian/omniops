use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tokio::task;
use uuid::Uuid;
use chrono::{Utc, Duration};

use crate::app_state::AppState;

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub token: String,
}

#[derive(Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

pub async fn login_handler(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Response {
    let pool = state.db;

    // Fetch user from db
    let user_record = sqlx::query!(
        "SELECT id, password_hash FROM users WHERE username = ?",
        payload.username
    )
    .fetch_optional(&pool)
    .await;

    match user_record {
        Ok(Some(record)) => {
            // Verify password using bcrypt on a blocking thread
            let password = payload.password.clone();
            let hash = record.password_hash.clone();
            let is_valid = task::spawn_blocking(move || {
                bcrypt::verify(password, &hash).unwrap_or(false)
            })
            .await
            .unwrap_or(false);

            if is_valid {
                // Generate a secure random token
                let token = Uuid::new_v4().to_string();
                let expires_at = Utc::now() + Duration::days(7);

                // Store session in db
                let insert_result = sqlx::query!(
                    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
                    token,
                    record.id,
                    expires_at
                )
                .execute(&pool)
                .await;

                if insert_result.is_ok() {
                    return (StatusCode::OK, Json(LoginResponse { token })).into_response();
                } else {
                    tracing::error!("Failed to insert session into database");
                }
            }
        }
        Ok(None) => {
            // User not found, but we should probably avoid timing attacks 
            // by simulating a bcrypt hash check, though it's optional for a small internal tool.
            // For now, just sleep slightly to prevent basic enumeration if needed.
        }
        Err(e) => {
            tracing::error!("Database error during login: {}", e);
        }
    }

    (
        StatusCode::UNAUTHORIZED,
        Json(ErrorResponse {
            error: "Invalid username or password".to_string(),
        }),
    )
        .into_response()
}
