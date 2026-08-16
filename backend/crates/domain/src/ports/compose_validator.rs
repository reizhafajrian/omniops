//! `ComposeValidator` port — validates a compose file before applying.
//!
//! The domain defines WHAT must be validated (security rules, unknown keys).
//! The infrastructure adapter decides HOW (using `docker-compose-types`).

use std::path::Path;


/// Reasons a compose file may be rejected.
#[derive(Debug, thiserror::Error)]
pub enum ValidationError {
    #[error("compose file not found at path: {0}")]
    FileNotFound(String),
    #[error("compose file parse error: {0}")]
    ParseError(String),
    #[error("compose file contains unknown top-level keys: {keys:?}")]
    UnknownTopLevelKeys { keys: Vec<String> },
    #[error(
        "compose file contains privileged-mode services: {services:?}. \
         Start the engine with --allow-privileged to override."
    )]
    PrivilegedModeNotAllowed { services: Vec<String> },
    #[error("validation error: {0}")]
    Other(String),
}

/// Port for compose-file validation.
///
/// Implementors must:
/// 1. Parse the file with `docker-compose-types` (or equivalent).
/// 2. Reject any top-level YAML keys outside the Compose V3 schema.
/// 3. Reject any service with `privileged: true` unless `allow_privileged` is set.
pub trait ComposeValidator: Send + Sync {
    /// Validate the compose file at `compose_path` and return `Ok(())` if safe.
    ///
    /// `allow_privileged` mirrors the `--allow-privileged` engine flag.
    fn validate<'a>(
        &'a self,
        compose_path: &'a Path,
        allow_privileged: bool,
    ) -> crate::ports::state_store::BoxFuture<'a, Result<(), ValidationError>>;
}
