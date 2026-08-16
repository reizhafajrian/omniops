-- Migration 001: initial stack state table
-- Stores the persisted runtime state for each configured stack.
-- The `id` column matches `StackConfig.id` from stacks.yml.

CREATE TABLE IF NOT EXISTS stack_state (
    id                      TEXT    NOT NULL PRIMARY KEY,   -- StackId
    state                   TEXT    NOT NULL DEFAULT 'unknown',
    last_synced_commit      TEXT,
    last_known_good_commit  TEXT,
    last_updated_at         TEXT    -- ISO 8601 / RFC 3339
);
