//! `RollbackStackUseCase` — re-applies the last known-good commit.
//!
//! # Behaviour
//!
//! * If `last_known_good_commit` is `None`, returns `RollbackError::NoPreviousGoodCommit`.
//! * Checks out that specific commit, re-validates, and re-applies.
//! * On success: `DeploymentState::Synced`, `last_synced_commit` is updated.
//!   `last_known_good_commit` is **not** changed (it's still the good commit).
//! * On failure: `DeploymentState::Failed`, `last_known_good_commit` preserved.

use std::sync::Arc;

use crate::entities::deployment_state::DeploymentState;
use crate::entities::stack::Stack;
use crate::entities::sync_event::{EventKind, SyncEvent};
use crate::ports::compose_validator::ComposeValidator;
use crate::ports::git_watcher::GitWatcher;
use crate::ports::reconciler_port::ReconcilerPort;
use crate::ports::state_store::{StateStore, StoreError};

#[derive(Debug, thiserror::Error)]
pub enum RollbackError {
    #[error("no previous known-good commit for stack '{0}' — rollback impossible")]
    NoPreviousGoodCommit(crate::entities::stack::StackId),
    #[error("git error: {0}")]
    Git(#[from] crate::ports::git_watcher::GitError),
    #[error("validation error: {0}")]
    Validation(#[from] crate::ports::compose_validator::ValidationError),
    #[error("reconciler error: {0}")]
    Reconciler(#[from] crate::ports::reconciler_port::ReconcilerError),
    #[error("state store error: {0}")]
    Store(#[from] StoreError),
}

/// Orchestrates re-applying the last known-good commit to a failing stack.
pub struct RollbackStackUseCase {
    git: Arc<dyn GitWatcher>,
    validator: Arc<dyn ComposeValidator>,
    reconciler: Arc<dyn ReconcilerPort>,
    store: Arc<dyn StateStore>,
    allow_privileged: bool,
}

impl RollbackStackUseCase {
    pub fn new(
        git: Arc<dyn GitWatcher>,
        validator: Arc<dyn ComposeValidator>,
        reconciler: Arc<dyn ReconcilerPort>,
        store: Arc<dyn StateStore>,
        allow_privileged: bool,
    ) -> Self {
        Self {
            git,
            validator,
            reconciler,
            store,
            allow_privileged,
        }
    }

    /// Execute rollback. Caller must hold the per-stack mutex.
    pub async fn execute(&self, mut stack: Stack) -> Result<Stack, RollbackError> {
        // ── Guard: must have a known-good target ──────────────────────────────
        let good_commit = stack
            .last_known_good_commit
            .clone()
            .ok_or_else(|| RollbackError::NoPreviousGoodCommit(stack.config.id.clone()))?;

        // ── Transition: Deploying ─────────────────────────────────────────────
        stack.state = DeploymentState::Deploying;
        self.store.save_stack_state(&stack).await?;

        // ── Checkout the known-good commit ────────────────────────────────────
        let checkout_dir = self
            .git
            .checkout_commit(&stack.config, &good_commit)
            .await?;
        let compose_path = checkout_dir.join(&stack.config.compose_path);

        // ── Validate ──────────────────────────────────────────────────────────
        self.validator
            .validate(&compose_path, self.allow_privileged)
            .await?;

        // ── Apply ─────────────────────────────────────────────────────────────
        if let Err(e) = self
            .reconciler
            .apply(&stack.config.id, &compose_path, stack.config.machine_name.as_deref())
            .await
        {
            stack.state = DeploymentState::Failed;
            stack.last_updated_at = Some(chrono::Utc::now());
            self.store.save_stack_state(&stack).await?;
            let event = SyncEvent::failure(
                stack.config.id.clone(),
                EventKind::Rollback,
                good_commit,
                format!("rollback apply failed: {e}"),
            );
            self.store.append_event(&event).await?;
            return Err(RollbackError::Reconciler(e));
        }

        // ── Success ───────────────────────────────────────────────────────────
        stack.state = DeploymentState::Synced;
        stack.last_synced_commit = Some(good_commit.clone());
        stack.last_updated_at = Some(chrono::Utc::now());
        // last_known_good_commit intentionally unchanged.
        self.store.save_stack_state(&stack).await?;

        let event = SyncEvent::success(stack.config.id.clone(), EventKind::Rollback, good_commit);
        self.store.append_event(&event).await?;

        Ok(stack)
    }
}
