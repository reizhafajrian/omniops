//! `ReconcilerPort` port — applies a validated compose file to Docker.
//!
//! Separated from the use-case layer so the Docker side can be swapped
//! (e.g., for a dry-run adapter in tests) without touching business logic.

use std::path::Path;

use crate::entities::stack::StackId;

/// Errors produced during compose apply / Docker interaction.
#[derive(Debug, thiserror::Error)]
pub enum ReconcilerError {
    #[error("docker daemon unavailable: {0}")]
    DaemonUnavailable(String),
    #[error("compose apply failed for stack '{stack_id}': {reason}")]
    ApplyFailed { stack_id: StackId, reason: String },
    #[error("reconciler error: {0}")]
    Other(String),
}

/// Port for applying a compose file to the Docker daemon.
pub trait ReconcilerPort: Send + Sync {
    /// Apply (docker compose up -d --remove-orphans) the validated compose file.
    ///
    /// Returns `Ok(())` on success, `Err(ReconcilerError::ApplyFailed)` on
    /// non-zero exit. The use-case layer handles all state transitions.
    fn apply<'a>(
        &'a self,
        stack_id: &'a StackId,
        compose_path: &'a Path,
    ) -> crate::ports::state_store::BoxFuture<'a, Result<(), ReconcilerError>>;

    /// Apply compose file with full stack configuration context (including registry credentials and env vars).
    fn apply_config<'a>(
        &'a self,
        config: &'a crate::entities::stack::StackConfig,
        compose_path: &'a Path,
    ) -> crate::ports::state_store::BoxFuture<'a, Result<(), ReconcilerError>> {
        self.apply(&config.id, compose_path)
    }

    /// Check if Docker Compose containers for `stack_id` are currently running.
    fn is_running<'a>(
        &'a self,
        _stack_id: &'a StackId,
        _working_dir: Option<&'a std::path::Path>,
    ) -> crate::ports::state_store::BoxFuture<'a, Result<bool, ReconcilerError>> {
        Box::pin(async move { Ok(true) })
    }

    /// Bring down all containers and networks for a given stack.
    /// Executes `docker compose -p <stack_id> down`.
    fn stop<'a>(
        &'a self,
        _stack_id: &'a StackId,
        _working_dir: Option<&'a Path>,
    ) -> crate::ports::state_store::BoxFuture<'a, Result<(), ReconcilerError>> {
        Box::pin(async move { Ok(()) })
    }
}
