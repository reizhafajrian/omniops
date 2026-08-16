export type DeploymentState = 'unknown' | 'out_of_sync' | 'deploying' | 'synced' | 'failed' | 'stopped';

export type AuthRef =
  | { pat_env: string }
  | { ssh_key_path_env: string };

export type SyncMode = 'poll' | 'webhook' | 'both';

export interface StackConfig {
  id: string;
  source_type?: string;
  inline_compose?: string;
  repo_url: string;
  branch: string;
  compose_path: string;
  poll_interval_secs: number;
  auth?: AuthRef | null;
  env_vars?: string | null;
  registry_host?: string | null;
  registry_user?: string | null;
  registry_pass?: string | null;
  sync_mode: SyncMode;
  webhook_secret?: string | null;
  is_protected?: boolean;
  security_pin?: string | null;
  machine_name?: string | null;
}

export interface Stack {
  config: StackConfig;
  state: DeploymentState;
  last_synced_commit: string | null;
  last_known_good_commit: string | null;
  last_updated_at: string | null;
}
