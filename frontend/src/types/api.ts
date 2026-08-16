import { Stack } from './stack';
import { SyncEvent } from './event';

export interface StacksResponse {
  stacks: Stack[];
}

export interface HistoryResponse {
  events: SyncEvent[];
}

export interface ActionResponse {
  message: string;
  stack: Stack;
}

export interface ApiErrorResponse {
  error: string;
}

export interface CreateStackInput {
  id: string;
  source_type?: string;
  inline_compose?: string;
  repo_url?: string;
  branch?: string;
  compose_path?: string;
  poll_interval_secs?: number;
  pat_token?: string;
  env_vars?: string;
  registry_host?: string;
  registry_user?: string;
  registry_pass?: string;
  sync_mode?: 'poll' | 'webhook' | 'both';
  is_protected?: boolean;
  security_pin?: string;
}

export type UpdateStackInput = Partial<Omit<CreateStackInput, 'id'>> & {
  regenerate_webhook?: boolean;
};
