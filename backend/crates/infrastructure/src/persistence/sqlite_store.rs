//! `SqliteStateStore` — SQLite-backed implementation of the `StateStore` port.
//!
//! Uses `sqlx` with the SQLite driver (runtime queries — no compile-time
//! DATABASE_URL needed). Migrations are embedded via `sqlx::migrate!` and run
//! at construction time.
//!
//! # Security notes
//!
//! * The database file is local and file-system protected. Do NOT store
//!   credentials in any column — auth references are env-var names only.
//! * SQLite WAL mode is enabled to prevent writer starvation when the
//!   reconcile loop and the HTTP layer access the DB concurrently.

use std::str::FromStr;

use anyhow::Context;
use chrono::{DateTime, Utc};
use sqlx::{sqlite::SqliteConnectOptions, Row, SqlitePool};
use tracing::instrument;

use domain::{
    entities::{
        deployment_state::DeploymentState,
        stack::{Stack, StackId},
        sync_event::{EventKind, SyncEvent, SyncEventId},
    },
    ports::state_store::{BoxFuture, StackStateRow, StateStore, StoreError},
};

// ── Constructor ────────────────────────────────────────────────────────────────

/// SQLite-backed state store.
///
/// Obtain an instance via [`SqliteStateStore::connect`] which runs migrations
/// before returning.
pub struct SqliteStateStore {
    pub pool: SqlitePool,
}

impl SqliteStateStore {
    /// Open (or create) the SQLite database at `database_url` and run all
    /// embedded migrations.
    ///
    /// `database_url` must be in the form `sqlite:./path/to/file.db`.
    pub async fn connect(database_url: &str) -> Result<Self, anyhow::Error> {
        let options = SqliteConnectOptions::from_str(database_url)
            .context("invalid DATABASE_URL")?
            .create_if_missing(true)
            // WAL mode: readers don't block writers and vice-versa.
            .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
            .pragma("foreign_keys", "ON");

        let pool = SqlitePool::connect_with(options)
            .await
            .context("failed to open SQLite pool")?;

        // Run embedded migrations from the `migrations/` directory at compile time.
        sqlx::migrate!("../../migrations")
            .run(&pool)
            .await
            .context("failed to run SQLite migrations")?;

        tracing::info!(database_url, "SQLite state store connected and migrations applied");
        Ok(Self { pool })
    }
}

// ── StateStore impl ────────────────────────────────────────────────────────────

impl StateStore for SqliteStateStore {
    fn save_stack_config<'a>(
        &'a self,
        config: &'a domain::entities::stack::StackConfig,
        pat_token: Option<&'a str>,
    ) -> BoxFuture<'a, Result<(), StoreError>> {
        Box::pin(async move {
            let poll_interval = config.poll_interval_secs as i64;
            let is_protected_int = if config.is_protected { 1i64 } else { 0i64 };
            sqlx::query(
                r#"
                INSERT INTO stack_config
                    (id, repo_url, branch, compose_path, poll_interval_secs, pat_token, env_vars, registry_host, registry_user, registry_pass, sync_mode, webhook_secret, is_protected, security_pin, source_type, inline_compose, machine_name)
                VALUES
                    (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
                ON CONFLICT(id) DO UPDATE SET
                    repo_url           = excluded.repo_url,
                    branch             = excluded.branch,
                    compose_path       = excluded.compose_path,
                    poll_interval_secs = excluded.poll_interval_secs,
                    pat_token          = excluded.pat_token,
                    env_vars           = excluded.env_vars,
                    registry_host      = excluded.registry_host,
                    registry_user      = excluded.registry_user,
                    registry_pass      = excluded.registry_pass,
                    sync_mode          = excluded.sync_mode,
                    webhook_secret     = excluded.webhook_secret,
                    is_protected       = excluded.is_protected,
                    security_pin       = excluded.security_pin,
                    source_type        = excluded.source_type,
                    inline_compose     = excluded.inline_compose,
                    machine_name       = excluded.machine_name
                "#,
            )
            .bind(config.id.as_str())
            .bind(&config.repo_url)
            .bind(&config.branch)
            .bind(&config.compose_path)
            .bind(poll_interval)
            .bind(pat_token)
            .bind(&config.env_vars)
            .bind(&config.registry_host)
            .bind(&config.registry_user)
            .bind(&config.registry_pass)
            .bind(&config.sync_mode)
            .bind(&config.webhook_secret)
            .bind(is_protected_int)
            .bind(&config.security_pin)
            .bind(&config.source_type)
            .bind(&config.inline_compose)
            .bind(&config.machine_name)
            .execute(&self.pool)
            .await
            .map_err(|e| StoreError::Database(e.to_string()))?;

            Ok(())
        })
    }

    fn load_all_stack_configs(
        &self,
    ) -> BoxFuture<'_, Result<Vec<(domain::entities::stack::StackConfig, Option<String>)>, StoreError>> {
        Box::pin(async move {
            let rows = sqlx::query(
                r#"
                SELECT id, repo_url, branch, compose_path, poll_interval_secs, pat_token, env_vars, registry_host, registry_user, registry_pass, sync_mode, webhook_secret, is_protected, security_pin, source_type, inline_compose, machine_name
                FROM stack_config
                "#,
            )
            .fetch_all(&self.pool)
            .await
            .map_err(|e| StoreError::Database(e.to_string()))?;

            let mut configs = Vec::new();
            for row in rows {
                let id_str: String = row.get("id");
                let repo_url: String = row.get("repo_url");
                let branch: String = row.get("branch");
                let compose_path: String = row.get("compose_path");
                let poll_interval_secs: i64 = row.get("poll_interval_secs");
                let pat_token: Option<String> = row.get("pat_token");
                let env_vars: Option<String> = row.get("env_vars");
                let registry_host: Option<String> = row.get("registry_host");
                let registry_user: Option<String> = row.get("registry_user");
                let registry_pass: Option<String> = row.get("registry_pass");
                let sync_mode: String = row.get::<Option<String>, _>("sync_mode").unwrap_or_else(|| "poll".to_string());
                let webhook_secret: Option<String> = row.get("webhook_secret");
                let is_protected_int: i64 = row.get::<Option<i64>, _>("is_protected").unwrap_or(0);
                let security_pin: Option<String> = row.get("security_pin");
                let source_type: String = row.get::<Option<String>, _>("source_type").unwrap_or_else(|| "git".to_string());
                let inline_compose: Option<String> = row.get("inline_compose");
                let machine_name: Option<String> = row.get("machine_name");

                let id = domain::entities::stack::StackId::new(&id_str)
                    .map_err(|e| StoreError::Database(e.to_string()))?;

                let auth = if let Some(ref _pat) = pat_token {
                    let env_name = format!("STACK_{}_PAT", id.as_str().to_uppercase().replace('-', "_"));
                    Some(domain::entities::stack::AuthRef::Pat { pat_env: env_name })
                } else {
                    None
                };

                let config = domain::entities::stack::StackConfig {
                    id,
                    source_type,
                    inline_compose,
                    repo_url,
                    branch,
                    compose_path,
                    poll_interval_secs: poll_interval_secs as u64,
                    auth,
                    env_vars,
                    registry_host,
                    registry_user,
                    registry_pass,
                    sync_mode,
                    webhook_secret,
                    is_protected: is_protected_int != 0,
                    security_pin,
                    machine_name,
                };

                configs.push((config, pat_token));
            }

            Ok(configs)
        })
    }

    fn delete_stack_config<'a>(
        &'a self,
        id: &'a domain::entities::stack::StackId,
    ) -> BoxFuture<'a, Result<(), StoreError>> {
        Box::pin(async move {
            sqlx::query("DELETE FROM stack_config WHERE id = ?1")
                .bind(id.as_str())
                .execute(&self.pool)
                .await
                .map_err(|e| StoreError::Database(e.to_string()))?;

            sqlx::query("DELETE FROM stack_state WHERE id = ?1")
                .bind(id.as_str())
                .execute(&self.pool)
                .await
                .map_err(|e| StoreError::Database(e.to_string()))?;

            Ok(())
        })
    }

    // ── App Settings ──────────────────────────────────────────────────────────

    fn save_settings<'a>(
        &'a self,
        settings: &'a domain::entities::settings::AppSettings,
    ) -> BoxFuture<'a, Result<(), StoreError>> {
        Box::pin(async move {
            let mut tx = self.pool.begin().await.map_err(|e| StoreError::Database(e.to_string()))?;

            // UPSERT container_engine
            sqlx::query(
                "INSERT INTO settings (key, value) VALUES ('container_engine', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
            )
            .bind(&settings.container_engine)
            .execute(&mut *tx)
            .await
            .map_err(|e| StoreError::Database(e.to_string()))?;

            // UPSERT or DELETE admin_password
            if let Some(pwd) = &settings.admin_password {
                if pwd.is_empty() {
                    sqlx::query("DELETE FROM settings WHERE key = 'admin_password'").execute(&mut *tx).await.ok();
                } else {
                    sqlx::query("INSERT INTO settings (key, value) VALUES ('admin_password', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
                        .bind(pwd)
                        .execute(&mut *tx)
                        .await
                        .map_err(|e| StoreError::Database(e.to_string()))?;
                }
            } else {
                sqlx::query("DELETE FROM settings WHERE key = 'admin_password'").execute(&mut *tx).await.ok();
            }

            // UPSERT or DELETE github_token
            if let Some(token) = &settings.github_token {
                if token.is_empty() {
                    sqlx::query("DELETE FROM settings WHERE key = 'github_token'").execute(&mut *tx).await.ok();
                } else {
                    sqlx::query("INSERT INTO settings (key, value) VALUES ('github_token', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
                        .bind(token)
                        .execute(&mut *tx)
                        .await
                        .map_err(|e| StoreError::Database(e.to_string()))?;
                }
            } else {
                sqlx::query("DELETE FROM settings WHERE key = 'github_token'").execute(&mut *tx).await.ok();
            }

            tx.commit().await.map_err(|e| StoreError::Database(e.to_string()))?;

            Ok(())
        })
    }

    fn load_settings(&self) -> BoxFuture<'_, Result<domain::entities::settings::AppSettings, StoreError>> {
        Box::pin(async move {
            let rows = sqlx::query("SELECT key, value FROM settings")
                .fetch_all(&self.pool)
                .await
                .map_err(|e| StoreError::Database(e.to_string()))?;

            let mut settings = domain::entities::settings::AppSettings::default();
            for row in rows {
                let key: String = row.get("key");
                let value: String = row.get("value");
                match key.as_str() {
                    "container_engine" => settings.container_engine = value,
                    "admin_password" => settings.admin_password = Some(value),
                    "github_token" => settings.github_token = Some(value),
                    _ => {}
                }
            }

            Ok(settings)
        })
    }

    // ── Stack state ───────────────────────────────────────────────────────────

    #[instrument(skip(self, stack), fields(stack_id = %stack.config.id))]
    fn save_stack_state<'a>(&'a self, stack: &'a Stack) -> BoxFuture<'a, Result<(), StoreError>> {
        Box::pin(async move {
            let state_str = stack.state.to_string();
            let updated_str = stack.last_updated_at.map(|dt| dt.to_rfc3339());

            sqlx::query(
                r#"
                INSERT INTO stack_state
                    (id, state, last_synced_commit, last_known_good_commit, last_updated_at)
                VALUES
                    (?1, ?2, ?3, ?4, ?5)
                ON CONFLICT(id) DO UPDATE SET
                    state                  = excluded.state,
                    last_synced_commit     = excluded.last_synced_commit,
                    last_known_good_commit = excluded.last_known_good_commit,
                    last_updated_at        = excluded.last_updated_at
                "#,
            )
            .bind(stack.config.id.as_str())
            .bind(&state_str)
            .bind(&stack.last_synced_commit)
            .bind(&stack.last_known_good_commit)
            .bind(&updated_str)
            .execute(&self.pool)
            .await
            .map_err(|e| StoreError::Database(e.to_string()))?;

            Ok(())
        })
    }

    #[instrument(skip(self), fields(stack_id = %stack_id))]
    fn load_stack_state<'a>(
        &'a self,
        stack_id: &'a StackId,
    ) -> BoxFuture<'a, Result<Option<StackStateRow>, StoreError>> {
        Box::pin(async move {
            let row = sqlx::query(
                r#"
                SELECT id, state, last_synced_commit, last_known_good_commit, last_updated_at
                FROM stack_state
                WHERE id = ?1
                "#,
            )
            .bind(stack_id.as_str())
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| StoreError::Database(e.to_string()))?;

            match row {
                None => Ok(None),
                Some(r) => {
                    let id: String = r.try_get("id").map_err(|e| StoreError::Database(e.to_string()))?;
                    let state: String = r.try_get("state").map_err(|e| StoreError::Database(e.to_string()))?;
                    let lsc: Option<String> = r.try_get("last_synced_commit").map_err(|e| StoreError::Database(e.to_string()))?;
                    let lgc: Option<String> = r.try_get("last_known_good_commit").map_err(|e| StoreError::Database(e.to_string()))?;
                    let lup: Option<String> = r.try_get("last_updated_at").map_err(|e| StoreError::Database(e.to_string()))?;
                    Ok(Some(row_to_state_row(id, state, lsc, lgc, lup)?))
                }
            }
        })
    }

    #[instrument(skip(self))]
    fn load_all_stack_states(
        &self,
    ) -> BoxFuture<'_, Result<Vec<StackStateRow>, StoreError>> {
        Box::pin(async move {
            let rows = sqlx::query(
                r#"
                SELECT id, state, last_synced_commit, last_known_good_commit, last_updated_at
                FROM stack_state
                "#,
            )
            .fetch_all(&self.pool)
            .await
            .map_err(|e| StoreError::Database(e.to_string()))?;

            rows.into_iter()
                .map(|r| {
                    let id: String = r.try_get("id").map_err(|e| StoreError::Database(e.to_string()))?;
                    let state: String = r.try_get("state").map_err(|e| StoreError::Database(e.to_string()))?;
                    let lsc: Option<String> = r.try_get("last_synced_commit").map_err(|e| StoreError::Database(e.to_string()))?;
                    let lgc: Option<String> = r.try_get("last_known_good_commit").map_err(|e| StoreError::Database(e.to_string()))?;
                    let lup: Option<String> = r.try_get("last_updated_at").map_err(|e| StoreError::Database(e.to_string()))?;
                    row_to_state_row(id, state, lsc, lgc, lup)
                })
                .collect()
        })
    }

    // ── Sync events ───────────────────────────────────────────────────────────

    #[instrument(skip(self, event), fields(stack_id = %event.stack_id, event_id = %event.id))]
    fn append_event<'a>(&'a self, event: &'a SyncEvent) -> BoxFuture<'a, Result<(), StoreError>> {
        Box::pin(async move {
            let kind_str = serde_json::to_string(&event.kind)
                .map(|s| s.trim_matches('"').to_owned())
                .map_err(|e| StoreError::Database(e.to_string()))?;
            let created_str = event.created_at.to_rfc3339();
            let success_int: i64 = if event.success { 1 } else { 0 };
            let id_str = event.id.to_string();

            sqlx::query(
                r#"
                INSERT INTO sync_event
                    (id, stack_id, kind, commit_hash, short_commit, success, error_message, created_at)
                VALUES
                    (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                "#,
            )
            .bind(&id_str)
            .bind(event.stack_id.as_str())
            .bind(&kind_str)
            .bind(&event.commit_hash)
            .bind(&event.short_commit)
            .bind(success_int)
            .bind(&event.error_message)
            .bind(&created_str)
            .execute(&self.pool)
            .await
            .map_err(|e| StoreError::Database(e.to_string()))?;

            Ok(())
        })
    }

    #[instrument(skip(self), fields(stack_id = %stack_id))]
    fn list_events<'a>(
        &'a self,
        stack_id: &'a StackId,
        limit: u32,
    ) -> BoxFuture<'a, Result<Vec<SyncEvent>, StoreError>> {
        Box::pin(async move {
            let limit_i64 = limit as i64;
            let rows = sqlx::query(
                r#"
                SELECT id, stack_id, kind, commit_hash, short_commit,
                       success, error_message, created_at
                FROM sync_event
                WHERE stack_id = ?1
                ORDER BY created_at DESC
                LIMIT ?2
                "#,
            )
            .bind(stack_id.as_str())
            .bind(limit_i64)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| StoreError::Database(e.to_string()))?;

            rows.into_iter()
                .map(|r| {
                    let id_str: String = r.try_get("id").map_err(|e| StoreError::Database(e.to_string()))?;
                    let stack_id_str: String = r.try_get("stack_id").map_err(|e| StoreError::Database(e.to_string()))?;
                    let kind_str: String = r.try_get("kind").map_err(|e| StoreError::Database(e.to_string()))?;
                    let commit_hash: String = r.try_get("commit_hash").map_err(|e| StoreError::Database(e.to_string()))?;
                    let short_commit: String = r.try_get("short_commit").map_err(|e| StoreError::Database(e.to_string()))?;
                    let success_int: i64 = r.try_get("success").map_err(|e| StoreError::Database(e.to_string()))?;
                    let error_message: Option<String> = r.try_get("error_message").map_err(|e| StoreError::Database(e.to_string()))?;
                    let created_at_str: String = r.try_get("created_at").map_err(|e| StoreError::Database(e.to_string()))?;

                    let sid = StackId::new(&stack_id_str)
                        .map_err(|e| StoreError::Database(e.to_string()))?;
                    let kind: EventKind =
                        serde_json::from_str(&format!(r#""{}""#, kind_str))
                            .map_err(|e| StoreError::Database(e.to_string()))?;
                    let created_at = DateTime::parse_from_rfc3339(&created_at_str)
                        .map(|dt| dt.with_timezone(&Utc))
                        .map_err(|e| StoreError::Database(e.to_string()))?;
                    let real_id = uuid::Uuid::parse_str(&id_str)
                        .map(SyncEventId::new_from_uuid)
                        .map_err(|e| StoreError::Database(e.to_string()))?;

                    Ok(SyncEvent {
                        id: real_id,
                        stack_id: sid,
                        kind,
                        commit_hash,
                        short_commit,
                        success: success_int != 0,
                        error_message,
                        created_at,
                    })
                })
                .collect()
        })
    }
}

// ── helpers ────────────────────────────────────────────────────────────────────

fn row_to_state_row(
    id: String,
    state: String,
    last_synced_commit: Option<String>,
    last_known_good_commit: Option<String>,
    last_updated_at: Option<String>,
) -> Result<StackStateRow, StoreError> {
    let stack_id =
        StackId::new(&id).map_err(|e| StoreError::Database(e.to_string()))?;
    let state = DeploymentState::try_from(state.as_str())
        .map_err(|e| StoreError::Database(e.to_string()))?;
    let last_updated_at = last_updated_at
        .as_deref()
        .map(DateTime::parse_from_rfc3339)
        .transpose()
        .map_err(|e| StoreError::Database(e.to_string()))?
        .map(|dt| dt.with_timezone(&Utc));

    Ok(StackStateRow {
        stack_id,
        state,
        last_synced_commit,
        last_known_good_commit,
        last_updated_at,
    })
}
