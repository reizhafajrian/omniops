use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ServiceInfo {
    pub name: String,
    pub service: String,
    pub status: String,
    pub ports: String,
    pub container_id: String,
    pub cpu_perc: String,
    pub mem_usage: String,
    pub mem_perc: String,
    pub volumes: Vec<String>,
    pub networks: Vec<String>,
    pub depends_on: Vec<String>,
}
