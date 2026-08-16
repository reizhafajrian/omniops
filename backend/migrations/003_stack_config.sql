-- Migration 003: Persist dynamic stack configurations across engine restarts
CREATE TABLE IF NOT EXISTS stack_config (
    id                  TEXT    NOT NULL PRIMARY KEY,
    repo_url            TEXT    NOT NULL,
    branch              TEXT    NOT NULL DEFAULT 'main',
    compose_path        TEXT    NOT NULL DEFAULT 'docker-compose.yml',
    poll_interval_secs  INTEGER NOT NULL DEFAULT 60,
    pat_token           TEXT
);
