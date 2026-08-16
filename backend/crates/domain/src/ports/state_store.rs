//! `StateStore` port — the primary persistence abstraction.
//!
//! All methods are async so they compose naturally with Tokio. The trait uses
//! explicit lifetime parameters tied to `&self` so that `BoxFuture` can capture
//! the arguments. This avoids the `async-trait` proc-macro dependency while
//! keeping the domain crate infrastructure-free.

use std::future::Future;
use std::pin::Pin;

use crate::entities::{
    deployment_state::DeploymentState,
    stack::{Stack, StackId},
    sync_event::SyncEvent,
};

/// Alias for the boxed, pinned future returned by trait methods to keep
/// signatures readable.
pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

/// Persistence errors surfaced through the port.
#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("stack not found: {0}")]
    NotFound(StackId),
    /// Wraps an opaque database error message without depending on anyhow.
    #[error("database error: {0}")]
    Database(String),
}

/// The single persistence port for stack state and sync event history.
///
/// Every method must be implemented for the unit-test mock and the SQLite
/// adapter. The trait is `Send + Sync` so it can be held in an `Arc<dyn StateStore>`.
///
/// # Lifetime design
///
/// The `'a` lifetime in each method ties the returned `BoxFuture` to `&'a self`
/// **and** any reference arguments for that call, so the future may safely
/// borrow them. Callers see this as a natural `async fn` interface.
pub trait StateStore: Send + Sync {
    // ── Stack state ───────────────────────────────────────────────────────────

    /// Persist (upsert) the runtime state of a stack.
    fn save_stack_state<'a>(&'a self, stack: &'a Stack) -> BoxFuture<'a, Result<(), StoreError>>;

    /// Load the persisted state for one stack. Returns `None` if no row exists.
    fn load_stack_state<'a>(
        &'a self,
        stack_id: &'a StackId,
    ) -> BoxFuture<'a, Result<Option<StackStateRow>, StoreError>>;

    /// Load the persisted state for all stacks in one query (used at startup).
    fn load_all_stack_states(&self) -> BoxFuture<'_, Result<Vec<StackStateRow>, StoreError>>;

    // ── Sync events ───────────────────────────────────────────────────────────

    /// Append a new sync event to the append-only event log.
    fn append_event<'a>(&'a self, event: &'a SyncEvent) -> BoxFuture<'a, Result<(), StoreError>>;

    /// Retrieve the most recent `limit` events for a stack, newest first.
    fn list_events<'a>(
        &'a self,
        stack_id: &'a StackId,
        limit: u32,
    ) -> BoxFuture<'a, Result<Vec<SyncEvent>, StoreError>>;

    // ── Stack config persistence ──────────────────────────────────────────────

    /// Save a stack configuration to storage.
    fn save_stack_config<'a>(
        &'a self,
        _config: &'a crate::entities::stack::StackConfig,
        _pat_token: Option<&'a str>,
    ) -> BoxFuture<'a, Result<(), StoreError>> {
        Box::pin(async move { Ok(()) })
    }

    /// Load all persisted stack configurations from storage.
    fn load_all_stack_configs(
        &self,
    ) -> BoxFuture<'_, Result<Vec<(crate::entities::stack::StackConfig, Option<String>)>, StoreError>> {
        Box::pin(async move { Ok(vec![]) })
    }

    /// Delete a stack configuration from storage.
    fn delete_stack_config<'a>(
        &'a self,
        _stack_id: &'a StackId,
    ) -> BoxFuture<'a, Result<(), StoreError>> {
        Box::pin(async move { Ok(()) })
    }

    // ── App Settings ──────────────────────────────────────────────────────────

    /// Save global application settings to storage.
    fn save_settings<'a>(
        &'a self,
        _settings: &'a crate::entities::settings::AppSettings,
    ) -> BoxFuture<'a, Result<(), StoreError>> {
        Box::pin(async move { Ok(()) })
    }

    /// Load global application settings from storage.
    fn load_settings(&self) -> BoxFuture<'_, Result<crate::entities::settings::AppSettings, StoreError>> {
        Box::pin(async move { Ok(crate::entities::settings::AppSettings::default()) })
    }
}

// ── DTO for reading rows back from storage ─────────────────────────────────────

/// A flat data-transfer row representing the persisted state of a stack.
/// Separate from the `Stack` aggregate so the store can be loaded without
/// requiring a full `StackConfig` at read time.
#[derive(Debug, Clone)]
pub struct StackStateRow {
    pub stack_id: StackId,
    pub state: DeploymentState,
    pub last_synced_commit: Option<String>,
    pub last_known_good_commit: Option<String>,
    pub last_updated_at: Option<chrono::DateTime<chrono::Utc>>,
}
