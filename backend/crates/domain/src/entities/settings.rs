use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub container_engine: String,
    pub admin_password: Option<String>,
    pub github_token: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            container_engine: "podman".to_string(),
            admin_password: None,
            github_token: None,
        }
    }
}
