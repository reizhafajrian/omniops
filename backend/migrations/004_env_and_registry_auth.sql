-- Migration 004: Add env_vars and private container registry auth columns to stack_config

ALTER TABLE stack_config ADD COLUMN env_vars TEXT;
ALTER TABLE stack_config ADD COLUMN registry_host TEXT;
ALTER TABLE stack_config ADD COLUMN registry_user TEXT;
ALTER TABLE stack_config ADD COLUMN registry_pass TEXT;
