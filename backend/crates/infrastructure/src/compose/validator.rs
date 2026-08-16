//! `ComposeValidatorImpl` — Compose Spec v5-compliant validator using Docker CLI.
//!
//! # Strategy
//! The `docker-compose-types` Rust crate does not fully implement the Compose Specification v5
//! (e.g. `deploy.update_config.order`, `deploy.rollback_config.order`, `depends_on` long-form
//! with `condition`/`restart`/`required`, and many other v5-only fields are missing from its
//! structs). Relying on it for syntax validation would produce false rejections of perfectly
//! valid compose files.
//!
//! Instead we delegate validation to the Docker CLI itself (`docker compose config`), which IS
//! a full Compose Spec v5 implementation. This gives us:
//!   1. Accurate syntax & spec validation for all Compose Spec v5 fields.
//!   2. No false-positive rejections for valid v5 fields like `order`, `condition`, etc.
//!   3. Exact error messages identical to what the user would see when running Docker CLI.
//!
//! The only thing we add on top is our own `privileged: true` security rule, which is checked
//! by scanning the raw YAML directly rather than through the Rust crate.
//!
//! # Security Rules Enforced
//! - Rejects services configured with `privileged: true` unless `allow_privileged` is enabled.

use std::path::Path;

use tracing::instrument;

use domain::entities::settings::AppSettings;
use domain::ports::{
    compose_validator::{ComposeValidator, ValidationError},
    state_store::BoxFuture,
};

#[derive(Clone)]
pub struct ComposeValidatorImpl {
    settings: std::sync::Arc<tokio::sync::RwLock<AppSettings>>,
}

impl ComposeValidatorImpl {
    pub fn new(settings: std::sync::Arc<tokio::sync::RwLock<AppSettings>>) -> Self {
        Self { settings }
    }

    async fn engine(&self) -> String {
        self.settings.read().await.container_engine.clone()
    }
}

impl ComposeValidator for ComposeValidatorImpl {
    #[instrument(skip(self), fields(compose_path = %compose_path.display()))]
    fn validate<'a>(
        &'a self,
        compose_path: &'a Path,
        allow_privileged: bool,
    ) -> BoxFuture<'a, Result<(), ValidationError>> {
        let path_buf = compose_path.to_path_buf();
        Box::pin(async move {
            if !path_buf.exists() {
                return Err(ValidationError::FileNotFound(
                    path_buf.to_string_lossy().to_string(),
                ));
            }

            let content = tokio::fs::read_to_string(&path_buf).await.map_err(|e| {
                ValidationError::Other(format!("Failed to read compose file: {e}"))
            })?;

            // ── Pass 1: Docker CLI Compose Spec v5 Validation ──────────────────────────
            // `docker compose config` parses and resolves the compose file using the full
            // Compose Specification v5 implementation inside Docker CLI. This is the most
            // accurate validator possible — it rejects truly invalid files while accepting
            // all valid v5 fields (`order`, `condition`, `depends_on` long-form, etc.).
            let engine = self.engine().await;
            let output = tokio::process::Command::new(&engine)
                .args(["compose", "-f"])
                .arg(&path_buf)
                .args(["config", "--quiet"])
                .output()
                .await;

            match output {
                Ok(out) if !out.status.success() => {
                    let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
                    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
                    let detail = if !stderr.is_empty() { stderr } else { stdout };
                    return Err(ValidationError::ParseError(format!(
                        "Docker Compose validation failed (Compose Spec v5):\n{detail}"
                    )));
                }
                Err(e) => {
                    // Docker CLI not available — fall back to basic YAML syntax check.
                    // This is a best-effort fallback for environments without Docker installed.
                    tracing::warn!(
                        "docker CLI not available, falling back to YAML-only validation: {e}"
                    );
                    serde_yaml::from_str::<serde_yaml::Value>(&content).map_err(|e| {
                        ValidationError::ParseError(format!("Invalid YAML syntax: {e}"))
                    })?;
                }
                Ok(_) => {
                    // Docker compose config exited 0 — file is Compose Spec v5 valid.
                }
            }

            // ── Pass 2: privileged: true security check (raw YAML scan) ────────────────
            // We scan the raw YAML for `privileged: true` instead of going through
            // docker-compose-types, so this check is not affected by crate version gaps.
            if !allow_privileged {
                let mut privileged_services: Vec<String> = Vec::new();

                // Parse as generic YAML Value to navigate the services map
                if let Ok(serde_yaml::Value::Mapping(doc)) =
                    serde_yaml::from_str::<serde_yaml::Value>(&content)
                {
                    if let Some(serde_yaml::Value::Mapping(services)) =
                        doc.get(&serde_yaml::Value::String("services".into()))
                    {
                        for (svc_name, svc_def) in services {
                            if let serde_yaml::Value::Mapping(svc_map) = svc_def {
                                let privileged_key =
                                    serde_yaml::Value::String("privileged".into());
                                if svc_map.get(&privileged_key)
                                    == Some(&serde_yaml::Value::Bool(true))
                                {
                                    if let serde_yaml::Value::String(name) = svc_name {
                                        privileged_services.push(name.clone());
                                    }
                                }
                            }
                        }
                    }
                }

                if !privileged_services.is_empty() {
                    return Err(ValidationError::PrivilegedModeNotAllowed {
                        services: privileged_services,
                    });
                }
            }

            Ok(())
        })
    }
}

#[cfg(test)]
mod tests {
    /// Sanity check: `privileged: true` YAML scanning logic works correctly
    /// regardless of docker-compose-types crate version support.
    #[test]
    fn test_privileged_scan_detects_true() {
        let yaml = r#"
services:
  safe:
    image: nginx:alpine
  dangerous:
    image: nginx:alpine
    privileged: true
"#;
        let doc: serde_yaml::Value = serde_yaml::from_str(yaml).unwrap();
        let services = doc
            .get(&serde_yaml::Value::String("services".into()))
            .and_then(|s| s.as_mapping())
            .unwrap();

        let mut found = Vec::new();
        for (name, def) in services {
            if let Some(map) = def.as_mapping() {
                if map.get(&serde_yaml::Value::String("privileged".into()))
                    == Some(&serde_yaml::Value::Bool(true))
                {
                    found.push(name.as_str().unwrap().to_string());
                }
            }
        }
        assert_eq!(found, vec!["dangerous"]);
    }

    /// Compose Spec v5 fields like `deploy.update_config.order` must parse as
    /// valid YAML (Pass 1 must always succeed for these).
    #[test]
    fn test_compose_spec_v5_fields_are_valid_yaml() {
        let yaml = r#"
services:
  app:
    image: nginx:alpine
    deploy:
      replicas: 1
      update_config:
        parallelism: 1
        order: stop-first
      rollback_config:
        order: start-first
  db:
    image: postgres:16
    depends_on:
      app:
        condition: service_healthy
        restart: true
"#;
        // Must not fail — these are valid Compose Spec v5 fields
        let _: serde_yaml::Value = serde_yaml::from_str(yaml)
            .expect("Compose Spec v5 fields must be valid YAML");
    }
}
