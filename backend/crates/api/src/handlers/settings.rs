use axum::{
    extract::State,
    Json,
};
use domain::entities::settings::AppSettings;
use crate::app_state::AppState;

pub async fn get_settings(
    State(state): State<AppState>,
) -> Result<Json<AppSettings>, String> {
    let settings = state.settings.read().await;
    Ok(Json(settings.clone()))
}

pub async fn update_settings(
    State(state): State<AppState>,
    Json(payload): Json<AppSettings>,
) -> Result<Json<AppSettings>, String> {
    // Save to database
    state.store.save_settings(&payload).await.map_err(|e| e.to_string())?;

    // Update in-memory state
    let mut settings = state.settings.write().await;
    *settings = payload.clone();

    Ok(Json(payload))
}
