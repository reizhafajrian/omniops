//! `GitWatcher` port — polls a remote repository for new commits.
//!
//! Implementations must perform a **shallow fetch** (fetch only, no full
//! checkout) to minimise disk I/O and network bandwidth. The commit hash
//! comparison is the sole out-of-sync trigger — file-content diffing is
//! explicitly out of scope.

use crate::entities::stack::StackConfig;

/// Error type for git operations.
#[derive(Debug, thiserror::Error)]
pub enum GitError {
    #[error("authentication failed for repo: {0}")]
    AuthFailure(String),
    #[error("remote ref not found: branch '{0}' on '{1}'")]
    RefNotFound(String, String),
    #[error("git operation failed: {0}")]
    Operation(String),
}

/// Port for checking the latest commit on a remote branch.
///
/// The concrete adapter (`git2_watcher.rs`) uses `git2` to open (or create)
/// a bare clone in a temp directory, fetch, and resolve the HEAD commit of the
/// configured branch — without writing a working tree.
pub trait GitWatcher: Send + Sync {
    /// Fetch the latest commit hash for the branch configured in `config`.
    ///
    /// This must NOT perform a full checkout. Implementations should use a
    /// bare clone + remote fetch or equivalent minimal network operation.
    fn latest_commit_hash<'a>(
        &'a self,
        config: &'a StackConfig,
    ) -> crate::ports::state_store::BoxFuture<'a, Result<String, GitError>>;

    /// Checkout (or update) the repo worktree to the given `commit_hash`,
    /// returning the local path to the directory containing the compose file.
    /// Called only when a sync is actually being applied.
    fn checkout_commit<'a>(
        &'a self,
        config: &'a StackConfig,
        commit_hash: &'a str,
    ) -> crate::ports::state_store::BoxFuture<'a, Result<std::path::PathBuf, GitError>>;
}
