//! `DeploymentState` — the exhaustive, explicit state machine for a stack.
//!
//! # Design contract
//!
//! * Every variant is **intentional** — there is no implicit "success" fallthrough.
//! * The only way to transition between states is through the use-case layer,
//!   which calls `DeploymentState::transition_to(next)` and logs the reason.
//! * Serialized as lowercase strings in both SQLite (`TEXT`) and JSON API
//!   responses so frontend consumers don't need to know Rust enum variants.

use serde::{Deserialize, Serialize};
use std::fmt;

/// The complete lifecycle of a stack's sync state.
///
/// State machine:
///
/// ```text
///  Unknown ──► OutOfSync ──► Deploying ──► Synced
///                │               │
///                │               └──► Failed
///                └──────────────────► Failed
/// ```
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeploymentState {
    /// Initial state before the engine has run a sync check.
    Unknown,

    /// The remote commit hash differs from the last applied hash (OutOfSync trigger).
    /// This is the ONLY trigger for a reconciliation cycle; file-content diff is
    /// NOT used — see the design doc for rationale.
    OutOfSync,

    /// A reconciliation is actively running against the Docker daemon.
    /// The per-stack mutex is held while the stack is in this state.
    Deploying,

    /// The last apply completed successfully and commit hashes match.
    Synced,

    /// The last apply failed. `last_known_good_commit` is preserved for rollback.
    /// The error message is stored in the associated `SyncEvent`.
    Failed,

    /// The stack was explicitly stopped by the user. Background reconciliation is paused.
    Stopped,
}

impl fmt::Display for DeploymentState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // Keep in sync with serde rename_all = "snake_case"
        match self {
            Self::Unknown => write!(f, "unknown"),
            Self::OutOfSync => write!(f, "out_of_sync"),
            Self::Deploying => write!(f, "deploying"),
            Self::Synced => write!(f, "synced"),
            Self::Failed => write!(f, "failed"),
            Self::Stopped => write!(f, "stopped"),
        }
    }
}

impl TryFrom<&str> for DeploymentState {
    type Error = InvalidStateError;

    fn try_from(s: &str) -> Result<Self, Self::Error> {
        match s {
            "unknown" => Ok(Self::Unknown),
            "out_of_sync" => Ok(Self::OutOfSync),
            "deploying" => Ok(Self::Deploying),
            "synced" => Ok(Self::Synced),
            "failed" => Ok(Self::Failed),
            "stopped" => Ok(Self::Stopped),
            other => Err(InvalidStateError(other.to_owned())),
        }
    }
}

/// Error produced when deserialising an unrecognised state string from SQLite.
#[derive(Debug, thiserror::Error)]
#[error("unrecognised DeploymentState value: {0}")]
pub struct InvalidStateError(String);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_serde() {
        let state = DeploymentState::OutOfSync;
        let json = serde_json::to_string(&state).unwrap();
        assert_eq!(json, r#""out_of_sync""#);
        let back: DeploymentState = serde_json::from_str(&json).unwrap();
        assert_eq!(back, DeploymentState::OutOfSync);
    }

    #[test]
    fn try_from_str_roundtrips_all_variants() {
        let variants = [
            ("unknown", DeploymentState::Unknown),
            ("out_of_sync", DeploymentState::OutOfSync),
            ("deploying", DeploymentState::Deploying),
            ("synced", DeploymentState::Synced),
            ("failed", DeploymentState::Failed),
            ("stopped", DeploymentState::Stopped),
        ];
        for (s, expected) in variants {
            assert_eq!(DeploymentState::try_from(s).unwrap(), expected);
            assert_eq!(expected.to_string(), s);
        }
    }

    #[test]
    fn try_from_unknown_str_is_error() {
        assert!(DeploymentState::try_from("gibberish").is_err());
    }
}
