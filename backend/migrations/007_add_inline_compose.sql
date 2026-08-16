-- Add source_type to support 'git' or 'inline' modes
ALTER TABLE stack_config ADD COLUMN source_type TEXT NOT NULL DEFAULT 'git';

-- Add inline_compose to store manual YAML when source_type = 'inline'
ALTER TABLE stack_config ADD COLUMN inline_compose TEXT;
