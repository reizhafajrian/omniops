-- Migration 002: sync event log
-- Append-only. Rows are never updated or deleted.

CREATE TABLE IF NOT EXISTS sync_event (
    id            TEXT    NOT NULL PRIMARY KEY,  -- SyncEventId (UUID v4)
    stack_id      TEXT    NOT NULL,               -- FK → stack_state.id
    kind          TEXT    NOT NULL,               -- EventKind (snake_case)
    commit_hash   TEXT    NOT NULL,
    short_commit  TEXT    NOT NULL,
    success       INTEGER NOT NULL,               -- 0 = false, 1 = true
    error_message TEXT,
    created_at    TEXT    NOT NULL,               -- ISO 8601
    FOREIGN KEY (stack_id) REFERENCES stack_state(id)
);

-- Index on stack_id for history queries (newest-first via ORDER BY created_at DESC).
CREATE INDEX IF NOT EXISTS idx_sync_event_stack_id ON sync_event(stack_id, created_at DESC);
