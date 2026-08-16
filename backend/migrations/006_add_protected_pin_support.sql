-- Migration 006: Add is_protected and security_pin columns to stack_config

ALTER TABLE stack_config ADD COLUMN is_protected INTEGER DEFAULT 0;
ALTER TABLE stack_config ADD COLUMN security_pin TEXT;
