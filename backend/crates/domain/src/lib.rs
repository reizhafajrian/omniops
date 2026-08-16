//! Domain crate — pure business logic, zero infra dependencies.
//!
//! Layer hierarchy (dependency arrows point inward):
//!
//!   api  →  infrastructure  →  domain
//!
//! Nothing in this crate may import from `infrastructure` or `api`.

pub mod entities;
pub mod ports;
pub mod use_cases;

// Re-export the most commonly needed items at the crate root for ergonomics.
pub use entities::{
    deployment_state::DeploymentState,
    stack::{AuthRef, Stack, StackConfig, StackId},
    sync_event::{EventKind, SyncEvent, SyncEventId},
};
