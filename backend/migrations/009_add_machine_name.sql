-- Add machine_name column to stack_config for multi-machine support
ALTER TABLE stack_config ADD COLUMN machine_name TEXT DEFAULT NULL;
