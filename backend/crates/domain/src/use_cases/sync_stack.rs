//! `SyncStackUseCase` — the core reconciliation business logic.
//!
//! # Responsibilities
//!
//! 1. Fetch the latest remote commit hash via `GitWatcher`.
//! 2. Compare with the last-synced commit from `StateStore`.
//! 3. If out-of-sync:
//!    a. Transition state → `Deploying`.
//!    b. Checkout the commit via `GitWatcher`.
//!    c. Validate the compose file via `ComposeValidator`.
//!    d. Apply via `ReconcilerPort`.
//!    e. On success → transition to `Synced`, update `last_known_good_commit`.
//!    f. On failure → transition to `Failed`, preserve `last_known_good_commit`.
//! 4. Append a `SyncEvent` to the audit log in every case.
//!
//! # Non-responsibilities
//!
//! * The per-stack mutex is owned by the caller (`reconcile_loop.rs` in the
//!   api crate).  This use-case assumes it is already held.
//! * Logging is the caller's responsibility (use `tracing::info!` spans in
//!   the reconcile loop, not here).

use std::sync::Arc;

use crate::entities::deployment_state::DeploymentState;
use crate::entities::stack::Stack;
use crate::entities::sync_event::{EventKind, SyncEvent};
use crate::ports::compose_validator::ComposeValidator;
use crate::ports::git_watcher::GitWatcher;
use crate::ports::reconciler_port::ReconcilerPort;
use crate::ports::state_store::{StateStore, StoreError};

// ── Error type ─────────────────────────────────────────────────────────────────

#[derive(Debug, thiserror::Error)]
pub enum SyncError {
    #[error("git error: {0}")]
    Git(#[from] crate::ports::git_watcher::GitError),
    #[error("validation error: {0}")]
    Validation(#[from] crate::ports::compose_validator::ValidationError),
    #[error("reconciler error: {0}")]
    Reconciler(#[from] crate::ports::reconciler_port::ReconcilerError),
    #[error("state store error: {0}")]
    Store(#[from] StoreError),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("yaml error: {0}")]
    Yaml(#[from] serde_yaml::Error),
}

// ── Use case ───────────────────────────────────────────────────────────────────

/// Orchestrates a full sync cycle for a single stack.
pub struct SyncStackUseCase {
    git: Arc<dyn GitWatcher>,
    validator: Arc<dyn ComposeValidator>,
    reconciler: Arc<dyn ReconcilerPort>,
    store: Arc<dyn StateStore>,
    /// Whether privileged-mode services are permitted.
    allow_privileged: bool,
}

impl SyncStackUseCase {
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

    /// Execute a sync for `stack`.
    ///
    /// The caller must hold the per-stack mutex before invoking this.
    /// `kind` distinguishes a scheduled poll from a manual API trigger.
    pub async fn execute(
        &self,
        mut stack: Stack,
        kind: EventKind,
    ) -> Result<Stack, SyncError> {
        if stack.state == DeploymentState::Stopped && kind == EventKind::ScheduledSync {
            // Stack was manually stopped. Ignore background syncs until manually restarted.
            return Ok(stack);
        }

        // ── Step 1: resolve latest remote commit or inline hash ──────────────
        let remote_hash = if stack.config.source_type == "inline" {
            use std::hash::{Hash, Hasher};
            let mut hasher = std::collections::hash_map::DefaultHasher::new();
            stack.config.inline_compose.as_deref().unwrap_or("").hash(&mut hasher);
            format!("{:x}", hasher.finish())
        } else {
            match self.git.latest_commit_hash(&stack.config).await {
                Ok(hash) => hash,
                Err(e) => {
                    return self
                        .fail(stack, kind, "unknown".into(), format!("git error: {e}"))
                        .await;
                }
            }
        };

        // ── Step 2: compare against last applied commit & container runtime status ──
        let is_out_of_sync = match kind {
            EventKind::ManualSync => true, // Manual sync ALWAYS forces a re-apply/start!
            _ => {
                let hash_changed = stack
                    .last_synced_commit
                    .as_deref()
                    .map(|h| h != remote_hash)
                    .unwrap_or(true);

                if hash_changed {
                    true
                } else {
                    // Git hash is unchanged, check if containers were stopped in terminal
                    let mut working_dir = None;
                    let mut dir_buf = std::path::PathBuf::new();
                    if stack.config.source_type == "inline" {
                        let dir = std::env::temp_dir().join("gitops_inline").join(stack.config.id.as_str());
                        if dir.exists() {
                            dir_buf = dir;
                            working_dir = Some(dir_buf.as_path());
                        }
                    } else if let Some(ref c) = stack.last_synced_commit {
                        let dir = std::env::temp_dir()
                            .join("gitops_checkouts")
                            .join(stack.config.id.as_str())
                            .join(c);
                        if dir.exists() {
                            dir_buf = dir;
                            working_dir = Some(dir_buf.as_path());
                        }
                    }
                    
                    let running = self.reconciler.is_running(&stack.config.id, working_dir).await.unwrap_or(true);
                    !running
                }
            }
        };

        if !is_out_of_sync {
            // Already up-to-date and containers running — ensure state reflects this.
            stack.state = DeploymentState::Synced;
            self.store.save_stack_state(&stack).await?;
            return Ok(stack);
        }

        // ── Step 3a: transition to Deploying ──────────────────────────────────
        stack.state = DeploymentState::Deploying;
        self.store.save_stack_state(&stack).await?;

        // ── Step 3b: checkout the commit or write inline file ──────────────────
        let compose_path = if stack.config.source_type == "inline" {
            let dir = std::env::temp_dir().join("gitops_inline").join(stack.config.id.as_str());
            if let Err(e) = std::fs::create_dir_all(&dir) {
                return self
                    .fail(stack, kind, remote_hash, format!("failed to create inline dir: {e}"))
                    .await;
            }
            let path = dir.join("docker-compose.yml");
            let content = stack.config.inline_compose.as_deref().unwrap_or("");
            if let Err(e) = std::fs::write(&path, content) {
                return self
                    .fail(stack, kind, remote_hash, format!("failed to write inline compose: {e}"))
                    .await;
            }
            path
        } else {
            let checkout_dir = match self.git.checkout_commit(&stack.config, &remote_hash).await {
                Ok(dir) => dir,
                Err(e) => {
                    return self
                        .fail(stack, kind, remote_hash, format!("checkout failed: {e}"))
                        .await;
                }
            };
            checkout_dir.join(&stack.config.compose_path)
        };

        // ── Step 3b.5: Sandbox volume paths ────────────────────────────────────
        if let Err(e) = self.sandbox_compose_volumes(&compose_path) {
            return self
                .fail(stack, kind, remote_hash, format!("sandboxing volumes failed: {e}"))
                .await;
        }

        // ── Step 3c: validate compose file ────────────────────────────────────
        if let Err(e) = self
            .validator
            .validate(&compose_path, self.allow_privileged)
            .await
        {
            return self
                .fail(stack, kind, remote_hash, format!("validation failed: {e}"))
                .await;
        }

        // ── Step 3d: apply to Docker daemon ───────────────────────────────────
        if let Err(e) = self
            .reconciler
            .apply_config(&stack.config, &compose_path)
            .await
        {
            return self
                .fail(stack, kind, remote_hash, format!("apply failed: {e}"))
                .await;
        }

        // ── Step 3e: success path ─────────────────────────────────────────────
        
        // Persist the compose file to the workspaces directory so that the REST API 
        // can inspect the topology and extract depends_on graph later
        let workspace_dir = std::path::Path::new("workspaces").join(stack.config.id.as_str());
        let workspace_compose_path = workspace_dir.join(stack.config.compose_path.trim_start_matches('/'));
        if let Some(parent) = workspace_compose_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let _ = std::fs::copy(&compose_path, &workspace_compose_path);

        stack.state = DeploymentState::Synced;
        stack.last_known_good_commit = Some(remote_hash.clone());
        stack.last_synced_commit = Some(remote_hash.clone());
        stack.last_updated_at = Some(chrono::Utc::now());
        self.store.save_stack_state(&stack).await?;

        let event = SyncEvent::success(stack.config.id.clone(), kind, remote_hash);
        self.store.append_event(&event).await?;

        Ok(stack)
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    /// Dynamically rewrites absolute volume paths to relative paths (sandboxing)
    /// to avoid permission errors on restricted host OS directories like /opt.
    fn sandbox_compose_volumes(&self, compose_path: &std::path::Path) -> Result<(), SyncError> {
        let content = std::fs::read_to_string(compose_path)?;
        let mut yaml: serde_yaml::Value = serde_yaml::from_str(&content)?;

        let mut modified = false;

        if let Some(services) = yaml.get_mut("services").and_then(|s| s.as_mapping_mut()) {
            for (_svc_name, svc_config) in services.iter_mut() {
                if let Some(volumes) = svc_config.get_mut("volumes").and_then(|v| v.as_sequence_mut()) {
                    for vol in volumes.iter_mut() {
                        // Short syntax (e.g. "/opt/data:/data")
                        if let Some(vol_str) = vol.as_str() {
                            if vol_str.starts_with('/') {
                                *vol = serde_yaml::Value::String(format!(".{}", vol_str));
                                modified = true;
                            }
                        } 
                        // Long syntax
                        else if let Some(vol_map) = vol.as_mapping_mut() {
                            let source_key = serde_yaml::Value::String("source".to_string());
                            if let Some(source) = vol_map.get_mut(&source_key) {
                                if let Some(src_str) = source.as_str() {
                                    if src_str.starts_with('/') {
                                        *source = serde_yaml::Value::String(format!(".{}", src_str));
                                        modified = true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        if modified {
            let modified_content = serde_yaml::to_string(&yaml)?;
            std::fs::write(compose_path, modified_content)?;
        }

        Ok(())
    }

    /// Transition to `Failed`, preserve `last_known_good_commit`, persist state,
    /// append a failure event.  Returns `Err(SyncError::Store)` only if the
    /// persistence itself fails — the apply error is embedded in the event.
    async fn fail(
        &self,
        mut stack: Stack,
        kind: EventKind,
        commit_hash: String,
        reason: String,
    ) -> Result<Stack, SyncError> {
        // Explicit Failed transition — last_known_good_commit is untouched.
        stack.state = DeploymentState::Failed;
        stack.last_updated_at = Some(chrono::Utc::now());
        self.store.save_stack_state(&stack).await?;

        let event = SyncEvent::failure(stack.config.id.clone(), kind, commit_hash, &reason);
        self.store.append_event(&event).await?;

        // Return the updated stack so the caller can surface it via the API.
        Ok(stack)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entities::stack::{StackConfig, StackId};
    use crate::ports::compose_validator::ValidationError;
    use crate::ports::git_watcher::GitError;
    use crate::ports::reconciler_port::ReconcilerError;
    use crate::ports::state_store::{StackStateRow, StoreError};
    use std::path::{Path, PathBuf};
    use std::sync::Mutex as StdMutex;

    // ── Minimal in-memory mocks ───────────────────────────────────────────────

    struct MockGit {
        hash: String,
    }
    impl GitWatcher for MockGit {
        fn latest_commit_hash<'a>(
            &'a self,
            _config: &'a StackConfig,
        ) -> crate::ports::state_store::BoxFuture<'a, Result<String, GitError>> {
            let h = self.hash.clone();
            Box::pin(async move { Ok(h) })
        }
        fn checkout_commit<'a>(
            &'a self,
            _config: &'a StackConfig,
            _hash: &'a str,
        ) -> crate::ports::state_store::BoxFuture<'a, Result<PathBuf, GitError>> {
            Box::pin(async move { Ok(PathBuf::from("/tmp/checkout")) })
        }
    }

    struct AlwaysValidValidator;
    impl ComposeValidator for AlwaysValidValidator {
        fn validate<'a>(
            &'a self,
            _path: &'a Path,
            _allow_privileged: bool,
        ) -> crate::ports::state_store::BoxFuture<'a, Result<(), ValidationError>> {
            Box::pin(async move { Ok(()) })
        }
    }

    struct AlwaysSuccessReconciler;
    impl ReconcilerPort for AlwaysSuccessReconciler {
        fn stop<'a>(
            &'a self,
            _stack_id: &'a StackId,
            _working_dir: Option<&'a std::path::Path>,
        ) -> crate::ports::state_store::BoxFuture<'a, Result<(), ReconcilerError>> {
            Box::pin(async move { Ok(()) })
        }
        fn apply<'a>(
            &'a self,
            _stack_id: &'a StackId,
            _path: &'a Path,
        ) -> crate::ports::state_store::BoxFuture<'a, Result<(), ReconcilerError>> {
            Box::pin(async move { Ok(()) })
        }
        fn is_running<'a>(
            &'a self,
            _stack_id: &'a StackId,
            _working_dir: Option<&'a std::path::Path>,
        ) -> crate::ports::state_store::BoxFuture<'a, Result<bool, ReconcilerError>> {
            Box::pin(async move { Ok(true) })
        }
    }

    #[derive(Default)]
    struct InMemoryStore {
        states: StdMutex<Vec<Stack>>,
        events: StdMutex<Vec<SyncEvent>>,
    }
    impl StateStore for InMemoryStore {
        fn save_stack_state<'a>(
            &'a self,
            stack: &'a Stack,
        ) -> crate::ports::state_store::BoxFuture<'a, Result<(), StoreError>> {
            let s = stack.clone();
            Box::pin(async move {
                let mut g = self.states.lock().unwrap();
                g.retain(|x| x.config.id != s.config.id);
                g.push(s);
                Ok(())
            })
        }
        fn load_stack_state<'a>(
            &'a self,
            _id: &'a StackId,
        ) -> crate::ports::state_store::BoxFuture<'a, Result<Option<StackStateRow>, StoreError>>
        {
            Box::pin(async move { Ok(None) })
        }
        fn load_all_stack_states(
            &self,
        ) -> crate::ports::state_store::BoxFuture<'_, Result<Vec<StackStateRow>, StoreError>>
        {
            Box::pin(async move { Ok(vec![]) })
        }
        fn append_event<'a>(
            &'a self,
            event: &'a SyncEvent,
        ) -> crate::ports::state_store::BoxFuture<'a, Result<(), StoreError>> {
            let e = event.clone();
            Box::pin(async move {
                self.events.lock().unwrap().push(e);
                Ok(())
            })
        }
        fn list_events<'a>(
            &'a self,
            _id: &'a StackId,
            _limit: u32,
        ) -> crate::ports::state_store::BoxFuture<'a, Result<Vec<SyncEvent>, StoreError>> {
            Box::pin(async move { Ok(vec![]) })
        }
    }

    fn make_stack(last_synced: Option<&str>) -> Stack {
        Stack {
            config: StackConfig {
                id: StackId::new("test").unwrap(),
                repo_url: "https://example.com/repo.git".into(),
                branch: "main".into(),
                compose_path: "docker-compose.yml".into(),
                poll_interval_secs: 60,
                auth: None,
                env_vars: None,
                registry_host: None,
                registry_user: None,
                registry_pass: None,
                sync_mode: "poll".into(),
                webhook_secret: None,
                is_protected: false,
                security_pin: None,
            },
            state: DeploymentState::Unknown,
            last_synced_commit: last_synced.map(String::from),
            last_known_good_commit: None,
            last_updated_at: None,
        }
    }

    #[tokio::test]
    async fn syncs_when_out_of_sync() {
        let store = Arc::new(InMemoryStore::default());
        let uc = SyncStackUseCase::new(
            Arc::new(MockGit { hash: "abc1234".into() }),
            Arc::new(AlwaysValidValidator),
            Arc::new(AlwaysSuccessReconciler),
            store.clone(),
            false,
        );
        let result = uc.execute(make_stack(None), EventKind::ScheduledSync).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().state, DeploymentState::Synced);
    }

    #[tokio::test]
    async fn no_op_when_already_synced() {
        let store = Arc::new(InMemoryStore::default());
        let uc = SyncStackUseCase::new(
            Arc::new(MockGit { hash: "abc1234".into() }),
            Arc::new(AlwaysValidValidator),
            Arc::new(AlwaysSuccessReconciler),
            store.clone(),
            false,
        );
        // Stack already at the same hash → should stay Synced, no apply.
        let result = uc
            .execute(make_stack(Some("abc1234")), EventKind::ScheduledSync)
            .await;
        assert_eq!(result.unwrap().state, DeploymentState::Synced);
    }
}
