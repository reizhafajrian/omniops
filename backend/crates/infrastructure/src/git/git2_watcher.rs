//! `Git2Watcher` — `git2`-backed implementation of `GitWatcher`.
//!
//! Performs shallow fetch (fetch-only, no full checkout) for remote commit hash
//! inspection, and sparse checkout to `/tmp/gitops/<stack_id>/<hash>` when
//! an apply is needed. Supports PAT and SSH key credentials via `AuthRef`.

use std::fs;
use std::path::PathBuf;

use git2::{Cred, FetchOptions, RemoteCallbacks, Repository};
use tracing::instrument;

use domain::{
    entities::stack::{AuthRef, StackConfig},
    ports::{
        git_watcher::{GitError, GitWatcher},
        state_store::BoxFuture,
    },
};

pub struct Git2Watcher;

impl Git2Watcher {
    pub fn new() -> Self {
        Self
    }

    /// Construct `RemoteCallbacks` configured with credentials resolved from `AuthRef`.
    fn create_callbacks<'a>(config: &'a StackConfig) -> RemoteCallbacks<'a> {
        let mut callbacks = RemoteCallbacks::new();

        if let Some(auth) = &config.auth {
            match auth {
                AuthRef::Pat { pat_env } => {
                    let pat_token = std::env::var(pat_env).unwrap_or_default();
                    callbacks.credentials(move |_url, _username_from_url, _allowed_types| {
                        Cred::userpass_plaintext("git", &pat_token)
                    });
                }
                AuthRef::SshKeyPath { ssh_key_path_env } => {
                    let key_path_str = std::env::var(ssh_key_path_env).unwrap_or_default();
                    let key_path = PathBuf::from(key_path_str);
                    callbacks.credentials(move |_url, username_from_url, _allowed_types| {
                        let user = username_from_url.unwrap_or("git");
                        Cred::ssh_key(user, None, &key_path, None)
                    });
                }
            }
        }

        callbacks
    }
}

impl GitWatcher for Git2Watcher {
    #[instrument(skip(self, config), fields(stack_id = %config.id, repo_url = %config.repo_url))]
    fn latest_commit_hash<'a>(
        &'a self,
        config: &'a StackConfig,
    ) -> BoxFuture<'a, Result<String, GitError>> {
        let config_clone = config.clone();
        Box::pin(async move {
            tokio::task::spawn_blocking(move || {
                let temp_dir = std::env::temp_dir()
                    .join("gitops_cache")
                    .join(config_clone.id.as_str());

                if !temp_dir.exists() {
                    fs::create_dir_all(&temp_dir)
                        .map_err(|e| GitError::Operation(anyhow::anyhow!(e).to_string()))?;
                }

                // Open existing repo or init bare cache
                let repo = match Repository::open(&temp_dir) {
                    Ok(r) => r,
                    Err(_) => Repository::init_bare(&temp_dir)
                        .map_err(|e| GitError::Operation(anyhow::anyhow!(e).to_string()))?,
                };

                let callbacks = Self::create_callbacks(&config_clone);
                let mut fetch_opts = FetchOptions::new();
                fetch_opts.remote_callbacks(callbacks);
                fetch_opts.depth(1);

                let mut remote = repo
                    .remote_anonymous(&config_clone.repo_url)
                    .map_err(|e| GitError::Operation(anyhow::anyhow!(e).to_string()))?;

                let refspec = format!("refs/heads/{}:refs/heads/{}", config_clone.branch, config_clone.branch);

                remote
                    .fetch(&[&refspec], Some(&mut fetch_opts), None)
                    .map_err(|e| GitError::AuthFailure(e.to_string()))?;

                let ref_name = format!("refs/heads/{}", config_clone.branch);
                let reference = repo
                    .find_reference(&ref_name)
                    .map_err(|_| GitError::RefNotFound(config_clone.branch.clone(), config_clone.repo_url.clone()))?;

                let target_oid = reference
                    .target()
                    .ok_or_else(|| GitError::RefNotFound(config_clone.branch.clone(), config_clone.repo_url.clone()))?;

                Ok(target_oid.to_string())
            })
            .await
            .map_err(|e| GitError::Operation(anyhow::anyhow!(e).to_string()))?
        })
    }

    #[instrument(skip(self, config), fields(stack_id = %config.id, commit = %commit_hash))]
    fn checkout_commit<'a>(
        &'a self,
        config: &'a StackConfig,
        commit_hash: &'a str,
    ) -> BoxFuture<'a, Result<PathBuf, GitError>> {
        let config_clone = config.clone();
        let commit_hash_str = commit_hash.to_owned();

        Box::pin(async move {
            tokio::task::spawn_blocking(move || {
                let target_dir = std::env::temp_dir()
                    .join("gitops_checkouts")
                    .join(config_clone.id.as_str())
                    .join(&commit_hash_str);

                if target_dir.exists() {
                    return Ok(target_dir);
                }

                fs::create_dir_all(&target_dir)
                    .map_err(|e| GitError::Operation(anyhow::anyhow!(e).to_string()))?;

                // Perform repository clone / checkout into target worktree
                let callbacks = Self::create_callbacks(&config_clone);
                let mut fetch_opts = FetchOptions::new();
                fetch_opts.remote_callbacks(callbacks);
                fetch_opts.depth(1);

                let mut builder = git2::build::RepoBuilder::new();
                builder.fetch_options(fetch_opts);
                builder.branch(&config_clone.branch);

                builder
                    .clone(&config_clone.repo_url, &target_dir)
                    .map_err(|e| GitError::Operation(anyhow::anyhow!(e).to_string()))?;

                Ok(target_dir)
            })
            .await
            .map_err(|e| GitError::Operation(anyhow::anyhow!(e).to_string()))?
        })
    }
}
