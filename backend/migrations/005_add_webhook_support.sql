-- Migration 005: Add sync_mode and webhook_secret columns to stack_config

ALTER TABLE stack_config ADD COLUMN sync_mode TEXT DEFAULT 'poll';
ALTER TABLE stack_config ADD COLUMN webhook_secret TEXT;
