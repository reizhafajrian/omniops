export type EventKind = 'scheduled_sync' | 'manual_sync' | 'rollback' | 'out_of_sync_detected';

export interface SyncEvent {
  id: string;
  stack_id: string;
  kind: EventKind;
  commit_hash: string;
  short_commit: string;
  success: boolean;
  error_message: string | null;
  created_at: string;
}
