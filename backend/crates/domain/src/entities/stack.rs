//! `Stack` entity and `StackConfig` — the primary aggregate.
//!
//! `StackConfig` is parsed from `stacks.yml` and is immutable for the lifetime
//! of the engine run. `Stack` is the runtime view, combining config with
//! persisted state from SQLite.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;

use crate::entities::deployment_state::DeploymentState;

// ── Value objects ─────────────────────────────────────────────────────────────

/// Newtype wrapper ensuring `StackId` is never confused with a plain `String`.
///
/// Validated at construction: must be non-empty and alphanumeric-with-hyphens.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct StackId(String);

impl StackId {
    pub fn new(raw: impl Into<String>) -> Result<Self, InvalidStackIdError> {
        let s = raw.into();
        if s.is_empty() {
            return Err(InvalidStackIdError("stack id must not be empty".into()));
        }
        if !s.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
            return Err(InvalidStackIdError(format!(
                "stack id '{s}' contains invalid characters; \
                 only alphanumeric, hyphens, and underscores are allowed"
            )));
        }
        Ok(Self(s))
    }

    /// Returns the inner string slice.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for StackId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[derive(Debug, thiserror::Error)]
#[error("invalid stack id: {0}")]
pub struct InvalidStackIdError(String);

// ── Auth configuration ─────────────────────────────────────────────────────────

/// Authentication reference for a private repository.
///
/// # Security contract
///
/// Values here are **env-var names**, not the secrets themselves.  The engine
/// calls `std::env::var(pat_env)` at startup and uses the result in memory
/// only — it is never written to SQLite, logs, or any persistent store.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum AuthRef {
    /// Personal Access Token stored in the named env var.
    Pat {
        /// Name of the env var whose value is the PAT.
        pat_env: String,
    },
    /// SSH deploy key: env var whose value is the **path** to the PEM file.
    SshKeyPath {
        ssh_key_path_env: String,
    },
}

// ── Stack configuration ────────────────────────────────────────────────────────

/// Static configuration for a single tracked compose stack.
/// Parsed from `stacks.yml`; immutable after startup.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StackConfig {
    /// Unique identifier for this stack (alphanumeric, hyphens, underscores).
    pub id: StackId,

    /// Source type for the stack: "git" or "inline".
    #[serde(default = "default_source_type")]
    pub source_type: String,

    /// Inline raw Docker Compose YAML text (if source_type == "inline").
    #[serde(default)]
    pub inline_compose: Option<String>,

    /// HTTPS or SSH remote URL of the git repository.
    pub repo_url: String,

    /// Branch to track.
    pub branch: String,

    /// Path inside the repo to the Docker Compose file.
    pub compose_path: String,

    /// How often to poll for remote changes, in seconds.
    #[serde(default = "default_poll_interval")]
    pub poll_interval_secs: u64,

    /// Optional credential reference.  `None` implies a public repo.
    #[serde(default)]
    pub auth: Option<AuthRef>,

    /// Optional custom environment variables block (KEY=VALUE).
    #[serde(default)]
    pub env_vars: Option<String>,

    /// Private Container Registry host (e.g. gcr.io, ghcr.io, docker.io).
    #[serde(default)]
    pub registry_host: Option<String>,

    /// Private Container Registry username.
    #[serde(default)]
    pub registry_user: Option<String>,

    /// Private Container Registry password / token / service account key.
    #[serde(default)]
    pub registry_pass: Option<String>,

    /// Sync Trigger Mode: "poll" | "webhook" | "both"
    #[serde(default = "default_sync_mode")]
    pub sync_mode: String,

    /// Unique Secret Token for Webhook URL trigger.
    #[serde(default)]
    pub webhook_secret: Option<String>,

    /// Protected / Sensitive Stack toggle flag.
    #[serde(default)]
    pub is_protected: bool,

    /// Optional Security PIN code required to access protected stack details.
    #[serde(default)]
    pub security_pin: Option<String>,
}

fn default_source_type() -> String {
    "git".to_string()
}

fn default_sync_mode() -> String {
    "poll".to_string()
}

fn default_poll_interval() -> u64 {
    60
}

/// Top-level deserialization wrapper matching the `stacks.yml` schema.
#[derive(Debug, Deserialize)]
pub struct StacksYaml {
    pub stacks: Vec<StackConfig>,
}

// ── Runtime stack aggregate ────────────────────────────────────────────────────

/// Runtime view of a stack: config + persisted state.
///
/// Constructed by merging `StackConfig` with a `StackStateRow` loaded from
/// SQLite. Never persisted as a whole — only the state fields are stored.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stack {
    pub config: StackConfig,

    /// Current synchronisation state.
    pub state: DeploymentState,

    /// The commit hash of the most recently **applied** compose deployment.
    pub last_synced_commit: Option<String>,

    /// The commit hash of the last apply that succeeded — preserved on failure
    /// so the rollback command has a safe target.
    pub last_known_good_commit: Option<String>,

    /// Wall-clock time of the most recent state change.
    pub last_updated_at: Option<DateTime<Utc>>,
}

impl Stack {
    /// Construct a fresh `Stack` from a config, with `Unknown` state and no
    /// history — used when no SQLite row exists for this stack yet.
    pub fn new_from_config(config: StackConfig) -> Self {
        Self {
            config,
            state: DeploymentState::Unknown,
            last_synced_commit: None,
            last_known_good_commit: None,
            last_updated_at: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_stack_id_accepts_hyphens_and_underscores() {
        assert!(StackId::new("webapp-prod_v2").is_ok());
    }

    #[test]
    fn empty_stack_id_is_rejected() {
        assert!(StackId::new("").is_err());
    }

    #[test]
    fn stack_id_with_spaces_is_rejected() {
        assert!(StackId::new("my stack").is_err());
    }

    #[test]
    fn stack_id_display_matches_inner() {
        let id = StackId::new("foo-bar").unwrap();
        assert_eq!(id.to_string(), "foo-bar");
    }
}
