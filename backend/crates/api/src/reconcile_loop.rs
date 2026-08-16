//! Background reconciliation loop.
//!
//! At startup, `spawn_reconcile_loops` launches one Tokio task per configured
//! stack.  Each task:
//!   1. Acquires the per-stack `Mutex` (preventing overlap with manual syncs).
//!   2. Calls `SyncStackUseCase::execute`.
//!   3. Sleeps for `poll_interval_secs`.
//!   4. Repeats.
//!
//! The structured log span includes `stack_id` on every line, making it easy
//! to grep/filter per stack in production log aggregators.

use std::sync::Arc;

use tokio::time::{interval, Duration};
use tracing::{error, info, info_span, Instrument};

use domain::{
    entities::stack::StackConfig,
    entities::sync_event::EventKind,
    use_cases::sync_stack::SyncStackUseCase,
};

use crate::app_state::AppState;

/// Spawn one reconciliation task per configured stack.
/// Call this once from `main.rs` after building `AppState`.
pub async fn spawn_reconcile_loops(state: AppState) {
    let configs = state.stacks.read().await.clone();
    for config in configs {
        spawn_single_reconcile_loop(state.clone(), config);
    }
}

/// Spawn a background reconcile loop for a single stack (used at startup & dynamic creation).
pub fn spawn_single_reconcile_loop(state: AppState, config: StackConfig) {
    let stack_id = config.id.clone();
    let stack_id_span = stack_id.clone();
    let poll_secs = config.poll_interval_secs;

    tokio::spawn(
        async move {
            info!(stack_id = %stack_id, poll_interval_secs = poll_secs, "reconcile loop started");

            let mut ticker = interval(Duration::from_secs(poll_secs));
            ticker.tick().await;

            loop {
                ticker.tick().await;

                let lock = match state.lock_for(&stack_id).await {
                    Some(l) => l,
                    None => {
                        error!(stack_id = %stack_id, "lock not found — stack may have been removed from config");
                        break;
                    }
                };

                let _guard = lock.lock().await;

                let stack = match state.load_stack(&stack_id).await {
                    Some(s) => s,
                    None => {
                        error!(stack_id = %stack_id, "stack config disappeared during reconcile loop");
                        break;
                    }
                };

                let uc = SyncStackUseCase::new(
                    Arc::clone(&state.git),
                    Arc::clone(&state.validator),
                    Arc::clone(&state.reconciler),
                    Arc::clone(&state.store),
                    state.allow_privileged,
                );

                match uc.execute(stack, EventKind::ScheduledSync).await {
                    Ok(updated) => {
                        info!(
                            stack_id = %stack_id,
                            state    = %updated.state,
                            commit   = updated.last_synced_commit.as_deref().unwrap_or("none"),
                            "reconcile cycle complete"
                        );
                    }
                    Err(e) => {
                        error!(
                            stack_id = %stack_id,
                            error    = %e,
                            "reconcile cycle failed"
                        );
                    }
                }
            }
        }
        .instrument(info_span!("reconcile_loop", stack_id = %stack_id_span)),
    );
}
