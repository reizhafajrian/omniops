//! `gitops-engine` binary entry point.
//!
//! # Startup sequence
//!
//! 1. Initialise structured JSON logging (tracing).
//! 2. Load and validate environment variables.
//! 3. Parse `stacks.yml` into `Vec<StackConfig>`.
//! 4. Connect to SQLite and run migrations.
//! 5. Wire up infrastructure adapters (Git, Compose, Docker).
//! 6. Build `AppState` with per-stack mutex map.
//! 7. Spawn background reconcile loops (one per stack).
//! 8. Start the Axum HTTP server.

use std::{collections::HashMap, sync::Arc};

use anyhow::{bail, Context};
use tokio::{net::TcpListener, sync::Mutex};
use tracing::info;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

use domain::entities::stack::{StackId, StacksYaml};
use domain::ports::state_store::StateStore;
use infrastructure::persistence::SqliteStateStore;

use api::{
    app_state::AppState,
    reconcile_loop::spawn_reconcile_loops,
    router::build_router,
};

// Phase-2 imports (stubbed here so the binary compiles; replace with real impls).
use infrastructure::{
    compose::validator::ComposeValidatorImpl,
    compose::executor::ComposeExecutorImpl,
    docker::inspector::DockerInspectorImpl,
    git::git2_watcher::Git2Watcher,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env file if present
    dotenvy::dotenv().ok();

    // ── 1. Structured JSON logging ─────────────────────────────────────────────
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    tracing_subscriber::registry()
        .with(filter)
        .with(fmt::layer().json())
        .init();

    info!("gitops-engine starting up");

    // ── 2. Environment variables ───────────────────────────────────────────────
    let bearer_token = std::env::var("GITOPS_TOKEN")
        .context("GITOPS_TOKEN env var is required (set a long random secret)")?;
    if bearer_token.is_empty() {
        bail!("GITOPS_TOKEN must not be empty");
    }

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:./gitops.db".into());

    let mut stacks_config_path = std::env::var("STACKS_CONFIG_PATH")
        .unwrap_or_else(|_| "./stacks.yml".into());

    // Smart fallback if running from workspace root instead of backend/ dir
    if !std::path::Path::new(&stacks_config_path).exists() {
        if std::path::Path::new("./backend/stacks.yml").exists() {
            stacks_config_path = "./backend/stacks.yml".into();
        }
    }

    let bind_address = std::env::var("BIND_ADDRESS")
        .unwrap_or_else(|_| "0.0.0.0:8080".into());

    let allow_privileged = std::env::var("ALLOW_PRIVILEGED")
        .map(|v| v == "1" || v.to_lowercase() == "true")
        .unwrap_or(false);

    // ── 3. Parse stacks.yml (Optional) ─────────────────────────────────────────
    let initial_stacks: Vec<domain::entities::stack::StackConfig> = match std::fs::read_to_string(&stacks_config_path) {
        Ok(content) => match serde_yaml::from_str::<StacksYaml>(&content) {
            Ok(parsed) => {
                info!(count = parsed.stacks.len(), "loaded stack configs from {}", stacks_config_path);
                parsed.stacks
            }
            Err(e) => {
                tracing::warn!("failed to parse '{}': {e} — starting with 0 stacks", stacks_config_path);
                Vec::new()
            }
        },
        Err(_) => {
            info!("no stacks config file found at '{}' — starting engine with 0 initial stacks (ready for UI stack creation)", stacks_config_path);
            Vec::new()
        }
    };

    // ── 4. SQLite ──────────────────────────────────────────────────────────────
    let store = Arc::new(
        SqliteStateStore::connect(&database_url)
            .await
            .context("failed to connect to SQLite")?,
    );

    // ── Load persisted stack configs from SQLite ─────────────────────────────
    let mut initial_stacks = initial_stacks;
    if let Ok(persisted) = store.load_all_stack_configs().await {
        for (config, pat_opt) in persisted {
            if !initial_stacks.iter().any(|s| s.id == config.id) {
                if let Some(pat) = pat_opt {
                    let env_var_name = format!("STACK_{}_PAT", config.id.as_str().to_uppercase().replace('-', "_"));
                    std::env::set_var(&env_var_name, pat);
                }
                initial_stacks.push(config);
            }
        }
    }
    info!(count = initial_stacks.len(), "total active stack configurations loaded");

    // ── 5. Infrastructure adapters ─────────────────────────────────────────────
    let settings = store.load_settings().await.unwrap_or_default();
    let settings_arc = Arc::new(tokio::sync::RwLock::new(settings));

    // These stubs will be replaced with real implementations in phase 2.
    let git = Arc::new(Git2Watcher::new());
    let validator = Arc::new(ComposeValidatorImpl::new(settings_arc.clone()));
    let reconciler = Arc::new(ComposeExecutorImpl::new(settings_arc.clone()));
    let docker_inspector = Arc::new(DockerInspectorImpl::new(settings_arc.clone()));

    // ── 6. AppState + per-stack locks ──────────────────────────────────────────
    let mut stack_locks: HashMap<StackId, Arc<Mutex<()>>> = HashMap::new();
    for config in &initial_stacks {
        stack_locks.insert(config.id.clone(), Arc::new(Mutex::new(())));
    }

    let state = AppState {
        stacks: Arc::new(tokio::sync::RwLock::new(initial_stacks)),
        stack_locks: Arc::new(tokio::sync::RwLock::new(stack_locks)),
        settings: settings_arc,
        store,
        git,
        validator,
        reconciler,
        docker_inspector,
        allow_privileged,
        bearer_token: Arc::from(bearer_token.as_str()),
    };

    // ── 7. Background reconcile loops ──────────────────────────────────────────
    spawn_reconcile_loops(state.clone()).await;

    // ── 8. HTTP server ─────────────────────────────────────────────────────────
    let router = build_router(state);
    let listener = TcpListener::bind(&bind_address)
        .await
        .with_context(|| format!("failed to bind to {bind_address}"))?;

    info!(address = %bind_address, "HTTP server listening");
    axum::serve(listener, router).await.context("server error")?;

    Ok(())
}
