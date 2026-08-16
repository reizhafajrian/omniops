//! `ComposeExecutorImpl` — applies compose files via Docker CLI commands.
//!
//! Spawns `docker compose -f <path> -p <stack_id> up -d --remove-orphans`.
//! Captures stdout/stderr for structured tracing and detailed failure error messages.

use std::path::Path;
use tokio::process::Command;
use tracing::instrument;

use domain::{
    entities::{
        stack::StackId,
        settings::AppSettings,
    },
    ports::{
        reconciler_port::{ReconcilerError, ReconcilerPort},
        state_store::BoxFuture,
    },
};

/// Executes Podman/Docker Compose CLI commands locally.
#[derive(Clone)]
pub struct ComposeExecutorImpl {
    settings: std::sync::Arc<tokio::sync::RwLock<AppSettings>>,
}

impl ComposeExecutorImpl {
    pub fn new(settings: std::sync::Arc<tokio::sync::RwLock<AppSettings>>) -> Self {
        Self { settings }
    }

    async fn engine(&self) -> String {
        self.settings.read().await.container_engine.clone()
    }
}

impl ReconcilerPort for ComposeExecutorImpl {
    fn apply_config<'a>(
        &'a self,
        config: &'a domain::entities::stack::StackConfig,
        compose_path: &'a Path,
    ) -> BoxFuture<'a, Result<(), ReconcilerError>> {
        let stack_id_str = config.id.to_string();
        let path_buf = compose_path.to_path_buf();
        let reg_host = config.registry_host.clone();
        let reg_user = config.registry_user.clone();
        let reg_pass = config.registry_pass.clone();
        let env_vars = config.env_vars.clone();

        Box::pin(async move {
            // 1. Authenticate with private Container Registry if credentials supplied
            if let (Some(host), Some(pass)) = (reg_host.as_ref(), reg_pass.as_ref()) {
                if !host.trim().is_empty() && !pass.trim().is_empty() {
                    let user = reg_user.as_deref().unwrap_or("_json_key");
                    tracing::info!(stack_id = %stack_id_str, host = %host, "authenticating with private container registry");
                    
                    let engine = self.engine().await;
                    let mut login_cmd = Command::new(&engine);
                    login_cmd.args(["login", host.trim(), "-u", user, "--password-stdin"]);
                    login_cmd.stdin(std::process::Stdio::piped());

                    if let Ok(mut child) = login_cmd.spawn() {
                        if let Some(mut stdin) = child.stdin.take() {
                            use tokio::io::AsyncWriteExt;
                            let _ = stdin.write_all(pass.trim().as_bytes()).await;
                            let _ = stdin.flush().await;
                        }
                        let _ = child.wait().await;
                    }
                }
            }

            // 2. Write custom environment variables to .env in compose directory
            if let Some(ref env_text) = env_vars {
                if !env_text.trim().is_empty() {
                    if let Some(parent_dir) = path_buf.parent() {
                        let env_file_path = parent_dir.join(".env");
                        let _ = tokio::fs::write(&env_file_path, env_text.trim()).await;
                    }
                }
            }

            // 3. Run `docker compose -f <path> -p <stack_id> up -d --remove-orphans --pull always`
            let output = Command::new("podman")
                .args([
                    "compose",
                    "-f",
                    path_buf.to_string_lossy().as_ref(),
                    "-p",
                    &stack_id_str,
                    "up",
                    "-d",
                    "--remove-orphans",
                    "--pull",
                    "always",
                ])
                .output()
                .await
                .map_err(|e| ReconcilerError::DaemonUnavailable(e.to_string()))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let combined = format!("{}\n{}", stderr.trim(), stdout.trim()).trim().to_string();
                return Err(ReconcilerError::ApplyFailed {
                    stack_id: StackId::new(stack_id_str).unwrap(),
                    reason: if combined.is_empty() {
                        "Docker compose exited with non-zero code".to_string()
                    } else {
                        combined
                    },
                });
            }

            tracing::info!(stack_id = %stack_id_str, "Successfully applied docker compose stack");
            Ok(())
        })
    }

    #[instrument(skip(self), fields(stack_id = %stack_id, compose_path = %compose_path.display()))]
    fn apply<'a>(
        &'a self,
        stack_id: &'a StackId,
        compose_path: &'a Path,
    ) -> BoxFuture<'a, Result<(), ReconcilerError>> {
        let stack_id_str = stack_id.to_string();
        let path_buf = compose_path.to_path_buf();

        Box::pin(async move {
            let output = Command::new("podman")
                .args([
                    "compose",
                    "-f",
                    path_buf.to_string_lossy().as_ref(),
                    "-p",
                    &stack_id_str,
                    "up",
                    "-d",
                    "--remove-orphans",
                ])
                .output()
                .await
                .map_err(|e| ReconcilerError::DaemonUnavailable(e.to_string()))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                return Err(ReconcilerError::ApplyFailed {
                    stack_id: StackId::new(stack_id_str).unwrap(),
                    reason: if stderr.is_empty() {
                        "Docker compose exited with non-zero code".to_string()
                    } else {
                        stderr
                    },
                });
            }

            tracing::info!(stack_id = %stack_id_str, "Successfully applied docker compose stack");
            Ok(())
        })
    }

    fn is_running<'a>(
        &'a self,
        stack_id: &'a StackId,
        working_dir: Option<&'a std::path::Path>,
    ) -> BoxFuture<'a, Result<bool, ReconcilerError>> {
        let stack_id_str = stack_id.to_string();
        let working_dir_buf = working_dir.map(|p| p.to_path_buf());
        let settings = self.settings.clone();

        Box::pin(async move {
            let engine = settings.read().await.container_engine.clone();
            let mut command = Command::new(&engine);
            command.args([
                "compose",
                "-p",
                &stack_id_str,
                "ps",
                "-q",
                "--filter",
                "status=running",
            ]);

            if let Some(dir) = working_dir_buf {
                command.current_dir(dir);
            }

            let output = command
                .output()
                .await;

            match output {
                Ok(out) if out.status.success() => {
                    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    let is_active = !stdout.is_empty();
                    Ok(is_active)
                }
                _ => Ok(false),
            }
        })
    }

    #[instrument(skip(self), fields(stack_id = %stack_id))]
    fn stop<'a>(
        &'a self,
        stack_id: &'a StackId,
        working_dir: Option<&'a std::path::Path>,
    ) -> BoxFuture<'a, Result<(), ReconcilerError>> {
        let stack_id_str = stack_id.to_string();
        let working_dir_buf = working_dir.map(|p| p.to_path_buf());
        let settings = self.settings.clone();

        Box::pin(async move {
            let engine = settings.read().await.container_engine.clone();
            let mut command = Command::new(&engine);
            command.args([
                "compose",
                "-p",
                &stack_id_str,
                "stop",
            ]);

            if let Some(dir) = working_dir_buf {
                command.current_dir(dir);
            }

            let output = command
                .output()
                .await
                .map_err(|e| ReconcilerError::DaemonUnavailable(e.to_string()))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                return Err(ReconcilerError::ApplyFailed {
                    stack_id: StackId::new(stack_id_str).unwrap(),
                    reason: if stderr.is_empty() {
                        "Docker compose stop exited with non-zero code".to_string()
                    } else {
                        stderr
                    },
                });
            }

            tracing::info!(stack_id = %stack_id_str, "Successfully stopped docker compose stack");
            Ok(())
        })
    }
}
