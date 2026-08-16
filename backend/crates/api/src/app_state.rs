//! Application state shared across all Axum handlers.
//!
//! `AppState` is wrapped in `Arc` by Axum automatically when registered via
//! `.with_state(state)`. All fields must be `Send + Sync`.

use std::collections::HashMap;
use std::sync::Arc;

use tokio::sync::{Mutex, RwLock};

use domain::{
    entities::stack::{Stack, StackConfig, StackId},
    ports::{
        compose_validator::ComposeValidator,
        git_watcher::GitWatcher,
        reconciler_port::ReconcilerPort,
        state_store::StateStore,
        docker_inspector::DockerInspectorPort,
    },
    use_cases::{
        rollback_stack::RollbackStackUseCase,
        sync_stack::SyncStackUseCase,
    },
};

// ── Per-stack lock ─────────────────────────────────────────────────────────────

/// Each stack has its own async mutex so that concurrent sync/rollback triggers
/// (manual API + scheduled loop) for the **same** stack never race. Different
/// stacks proceed independently.
pub type StackLocks = Arc<RwLock<HashMap<StackId, Arc<Mutex<()>>>>>;

// ── Shared state ───────────────────────────────────────────────────────────────

/// Central shared state injected into every Axum handler.
#[derive(Clone)]
pub struct AppState {
    /// All configured stacks (dynamically updatable via API).
    pub stacks: Arc<RwLock<Vec<StackConfig>>>,

    /// Per-stack mutexes keyed by `StackId`.
    pub stack_locks: StackLocks,

    /// Global application settings.
    pub settings: Arc<RwLock<domain::entities::settings::AppSettings>>,

    /// Persistence port — runtime state + event log.
    pub store: Arc<dyn StateStore>,

    /// Git adapter — used by use-cases.
    pub git: Arc<dyn GitWatcher>,

    /// Compose validator — used by use-cases.
    pub validator: Arc<dyn ComposeValidator>,

    /// Docker reconciler — used by use-cases.
    pub reconciler: Arc<dyn ReconcilerPort>,

    /// Docker inspector — used for querying topology and metrics.
    pub docker_inspector: Arc<dyn DockerInspectorPort>,

    /// Whether privileged-mode services are permitted.
    pub allow_privileged: bool,

    /// The bearer token value (read from env at startup, held in memory only).
    /// Stored as `Arc<str>` to avoid unnecessary clones across requests.
    pub bearer_token: Arc<str>,
}

impl AppState {
    /// Build the use-case for syncing a single stack.
    pub fn sync_use_case(&self) -> SyncStackUseCase {
        SyncStackUseCase::new(
            Arc::clone(&self.git),
            Arc::clone(&self.validator),
            Arc::clone(&self.reconciler),
            Arc::clone(&self.store),
            self.allow_privileged,
        )
    }

    /// Build the use-case for rolling back a single stack.
    pub fn rollback_use_case(&self) -> RollbackStackUseCase {
        RollbackStackUseCase::new(
            Arc::clone(&self.git),
            Arc::clone(&self.validator),
            Arc::clone(&self.reconciler),
            Arc::clone(&self.store),
            self.allow_privileged,
        )
    }

    /// Look up a `StackConfig` by ID.
    pub async fn find_stack_config(&self, id: &StackId) -> Option<StackConfig> {
        let stacks = self.stacks.read().await;
        stacks.iter().find(|s| &s.id == id).cloned()
    }

    /// Get the per-stack mutex for `id`.  Returns `None` if the stack isn't configured.
    pub async fn lock_for(&self, id: &StackId) -> Option<Arc<Mutex<()>>> {
        let locks = self.stack_locks.read().await;
        locks.get(id).cloned()
    }

    /// Register a new stack dynamically.
    pub async fn add_stack(&self, config: StackConfig) -> Result<(), String> {
        let mut stacks = self.stacks.write().await;
        if stacks.iter().any(|s| s.id == config.id) {
            return Err(format!("Stack with ID '{}' already exists", config.id));
        }

        let mut locks = self.stack_locks.write().await;
        locks.insert(config.id.clone(), Arc::new(Mutex::new(())));
        stacks.push(config);

        Ok(())
    }

    /// Remove a stack dynamically.
    pub async fn remove_stack(&self, id: &StackId) -> bool {
        let mut stacks = self.stacks.write().await;
        let pos = stacks.iter().position(|s| &s.id == id);
        if let Some(index) = pos {
            stacks.remove(index);
            let mut locks = self.stack_locks.write().await;
            locks.remove(id);
            true
        } else {
            false
        }
    }

    /// Load the current runtime view of a stack from the store + config.
    pub async fn load_stack(&self, id: &StackId) -> Option<Stack> {
        let config = self.find_stack_config(id).await?;
        match self.store.load_stack_state(id).await {
            Ok(Some(row)) => Some(Stack {
                state: row.state,
                last_synced_commit: row.last_synced_commit,
                last_known_good_commit: row.last_known_good_commit,
                last_updated_at: row.last_updated_at,
                config,
            }),
            _ => Some(Stack::new_from_config(config)),
        }
    }

    /// Load all stacks from config + store.
    pub async fn load_all_stacks(&self) -> Vec<Stack> {
        let configs = self.stacks.read().await.clone();
        let mut result = Vec::with_capacity(configs.len());
        for config in configs.iter() {
            if let Some(stack) = self.load_stack(&config.id).await {
                result.push(stack);
            }
        }
        result
    }
}
