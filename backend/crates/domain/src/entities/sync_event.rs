//! `SyncEvent` — an immutable record of one reconciliation attempt.
//!
//! Events are append-only in SQLite and are never mutated after insert.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::entities::stack::StackId;

// ── Value objects ─────────────────────────────────────────────────────────────

/// Newtype UUID for a sync event, preventing accidental mix-up with stack IDs.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct SyncEventId(Uuid);

impl SyncEventId {
    /// Generate a fresh random event ID.
    pub fn generate() -> Self {
        Self(Uuid::new_v4())
    }

    /// Reconstruct from a known UUID (e.g., when deserialising from SQLite).
    pub fn new_from_uuid(uuid: Uuid) -> Self {
        Self(uuid)
    }

    pub fn as_uuid(&self) -> &Uuid {
        &self.0
    }
}

impl std::fmt::Display for SyncEventId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

// ── Event kinds ───────────────────────────────────────────────────────────────

/// Discriminant describing what type of reconciliation triggered this event.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EventKind {
    /// Periodic poll detected a new remote commit.
    ScheduledSync,
    /// Operator manually triggered a sync via the REST API.
    ManualSync,
    /// Git provider Webhook triggered an automatic deployment.
    WebhookSync,
    /// Operator triggered a rollback to `last_known_good_commit`.
    Rollback,
    /// Engine detected an out-of-sync condition (emitted before `ScheduledSync`
    /// apply begins, useful for auditing latency).
    OutOfSyncDetected,
}

// ── Event ─────────────────────────────────────────────────────────────────────

/// An immutable record describing one reconciliation cycle.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncEvent {
    /// Unique identifier for this event.
    pub id: SyncEventId,

    /// Which stack this event belongs to.
    pub stack_id: StackId,

    /// What triggered the event.
    pub kind: EventKind,

    /// The remote commit hash that was applied (or attempted).
    pub commit_hash: String,

    /// Short form of the commit hash for display purposes (first 7 chars).
    pub short_commit: String,

    /// Whether the apply succeeded.
    pub success: bool,

    /// Human-readable error message if `success == false`.
    pub error_message: Option<String>,

    /// Wall-clock time the event was created.
    pub created_at: DateTime<Utc>,
}

impl SyncEvent {
    /// Construct a successful sync event.
    pub fn success(
        stack_id: StackId,
        kind: EventKind,
        commit_hash: String,
    ) -> Self {
        let short_commit = commit_hash.chars().take(7).collect();
        Self {
            id: SyncEventId::generate(),
            stack_id,
            kind,
            commit_hash,
            short_commit,
            success: true,
            error_message: None,
            created_at: Utc::now(),
        }
    }

    /// Construct a failed sync event with a captured error message.
    pub fn failure(
        stack_id: StackId,
        kind: EventKind,
        commit_hash: String,
        error: impl Into<String>,
    ) -> Self {
        let short_commit = commit_hash.chars().take(7).collect();
        Self {
            id: SyncEventId::generate(),
            stack_id,
            kind,
            commit_hash,
            short_commit,
            success: false,
            error_message: Some(error.into()),
            created_at: Utc::now(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entities::stack::StackId;

    fn make_stack_id() -> StackId {
        StackId::new("test-stack").unwrap()
    }

    #[test]
    fn success_event_has_no_error() {
        let event = SyncEvent::success(
            make_stack_id(),
            EventKind::ScheduledSync,
            "abc123def456".to_owned(),
        );
        assert!(event.success);
        assert!(event.error_message.is_none());
        assert_eq!(event.short_commit, "abc123d");
    }

    #[test]
    fn failure_event_captures_error() {
        let event = SyncEvent::failure(
            make_stack_id(),
            EventKind::ManualSync,
            "deadbeef".to_owned(),
            "docker compose up failed",
        );
        assert!(!event.success);
        assert_eq!(event.error_message.as_deref(), Some("docker compose up failed"));
    }

    #[test]
    fn short_commit_truncates_to_seven_chars() {
        let event = SyncEvent::success(
            make_stack_id(),
            EventKind::Rollback,
            "1234567890".to_owned(),
        );
        assert_eq!(event.short_commit.len(), 7);
        assert_eq!(event.short_commit, "1234567");
    }

    #[test]
    fn event_ids_are_unique() {
        let id1 = SyncEventId::generate();
        let id2 = SyncEventId::generate();
        assert_ne!(id1, id2);
    }
}
