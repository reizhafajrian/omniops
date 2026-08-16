use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub container_engine: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            container_engine: "podman".to_string(),
        }
    }
}
