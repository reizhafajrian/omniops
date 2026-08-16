use std::collections::HashMap;
use domain::entities::service::ServiceInfo;
use domain::entities::stack::{StackId, StackConfig};
use domain::ports::docker_inspector::DockerInspectorPort;
use domain::ports::state_store::BoxFuture;

use domain::entities::settings::AppSettings;

#[derive(Clone)]
pub struct DockerInspectorImpl {
    settings: std::sync::Arc<tokio::sync::RwLock<AppSettings>>,
}

impl DockerInspectorImpl {
    pub fn new(settings: std::sync::Arc<tokio::sync::RwLock<AppSettings>>) -> Self {
        Self { settings }
    }

    async fn engine(&self) -> String {
        self.settings.read().await.container_engine.clone()
    }

    fn build_cmd(&self, engine: &str, machine_name: Option<&str>) -> tokio::process::Command {
        let mut cmd = tokio::process::Command::new(engine);
        if let Some(m) = machine_name {
            if !m.trim().is_empty() {
                if engine == "podman" {
                    cmd.args(["--connection", m]);
                } else if engine == "docker" {
                    cmd.args(["-c", m]);
                }
            }
        }
        cmd
    }
}

fn parse_ports(item: &serde_json::Value) -> String {
    let mut clean_ports = Vec::new();

    // Podman format: Ports is an array of objects
    if let Some(ports_arr) = item.get("Ports").and_then(|p| p.as_array()) {
        for port_item in ports_arr {
            let container_port = port_item.get("container_port").and_then(|p| p.as_u64());
            let host_port = port_item.get("host_port").and_then(|p| p.as_u64());
            
            if let (Some(cp), Some(hp)) = (container_port, host_port) {
                let formatted = format!("{}:{}", hp, cp);
                if !clean_ports.contains(&formatted) {
                    clean_ports.push(formatted);
                }
            }
        }
        if !clean_ports.is_empty() {
            return clean_ports.join(", ");
        }
    }

    if let Some(publishers) = item.get("Publishers").and_then(|p| p.as_array()) {
        for pub_item in publishers {
            let published = pub_item.get("PublishedPort").and_then(|p| p.as_u64());
            let target = pub_item.get("TargetPort").and_then(|p| p.as_u64());

            if let (Some(pub_port), Some(tgt_port)) = (published, target) {
                let formatted = if pub_port > 0 {
                    format!("{pub_port}:{tgt_port}")
                } else {
                    format!("{tgt_port}")
                };
                if !clean_ports.contains(&formatted) {
                    clean_ports.push(formatted);
                }
            }
        }
    }

    if !clean_ports.is_empty() {
        return clean_ports.join(", ");
    }

    if let Some(ports_str) = item.get("Ports").and_then(|p| p.as_str()) {
        if !ports_str.trim().is_empty() {
            return ports_str.trim().to_string();
        }
    }

    "None".to_string()
}

impl DockerInspectorPort for DockerInspectorImpl {
    fn get_services<'a>(
        &'a self,
        stack_id: &'a StackId,
        config: &'a StackConfig,
    ) -> BoxFuture<'a, Result<Vec<ServiceInfo>, String>> {
        let stack_id_str = stack_id.to_string();
        let compose_path = config.compose_path.clone();

        Box::pin(async move {
            let engine = self.engine().await;

            // 1. Fetch live container CPU & RAM stats via `docker stats --no-stream`
            let mut stats_map: HashMap<String, (String, String, String)> = HashMap::new();
            let mut stats_cmd = self.build_cmd(&engine, config.machine_name.as_deref());
            let stats_output = stats_cmd
                .args([
                    "stats",
                    "--no-stream",
                    "--format",
                    "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}",
                ])
                .output()
                .await;

            if let Ok(out) = stats_output {
                if out.status.success() {
                    let stdout = String::from_utf8_lossy(&out.stdout);
                    for line in stdout.lines() {
                        let parts: Vec<&str> = line.split('|').collect();
                        if parts.len() >= 4 {
                            let c_name = parts[0].trim().to_string();
                            let cpu = parts[1].trim().to_string();
                            let mem_usage = parts[2].trim().to_string();
                            let mem_perc = parts[3].trim().to_string();
                            stats_map.insert(c_name, (cpu, mem_usage, mem_perc));
                        }
                    }
                }
            }

            // 2. Fetch compose configuration specification to extract service dependency DAG (depends_on)
            let mut depends_on_map: HashMap<String, Vec<String>> = HashMap::new();
            let workspace_compose_path = std::path::Path::new("workspaces")
                .join(&stack_id_str)
                .join(&compose_path);

            let mut config_cmd = self.build_cmd(&engine, config.machine_name.as_deref());
            if workspace_compose_path.exists() {
                config_cmd.args([
                    "compose",
                    "-f",
                    workspace_compose_path.to_string_lossy().as_ref(),
                    "-p",
                    &stack_id_str,
                    "config",
                    "--format",
                    "json",
                ]);
            } else {
                config_cmd.args(["compose", "-p", &stack_id_str, "config", "--format", "json"]);
            }

            let config_output = config_cmd.output().await;

            if let Ok(c_out) = config_output {
                if c_out.status.success() {
                    if let Ok(cfg_json) = serde_json::from_slice::<serde_json::Value>(&c_out.stdout) {
                        if let Some(svcs) = cfg_json.get("services").and_then(|s| s.as_object()) {
                            for (svc_name, svc_spec) in svcs {
                                let mut deps = Vec::new();
                                if let Some(dep_val) = svc_spec.get("depends_on") {
                                    if let Some(arr) = dep_val.as_array() {
                                        for d in arr {
                                            if let Some(d_str) = d.as_str() {
                                                deps.push(d_str.to_string());
                                            }
                                        }
                                    } else if let Some(obj) = dep_val.as_object() {
                                        for dep_key in obj.keys() {
                                            deps.push(dep_key.clone());
                                        }
                                    }
                                }
                                depends_on_map.insert(svc_name.clone(), deps);
                            }
                        }
                    }
                }
            }

            // 3. Fetch compose services list
            let mut ps_cmd = self.build_cmd(&engine, config.machine_name.as_deref());
            let output = ps_cmd
                .args([
                    "ps",
                    "--all",
                    "--filter",
                    &format!("label=com.docker.compose.project={}", stack_id_str),
                    "--format",
                    "json",
                ])
                .output()
                .await
                .map_err(|e| format!("Failed to execute {} ps: {}", engine, e))?;

            let mut services = Vec::new();

            if output.status.success() {
                let stdout_str = String::from_utf8_lossy(&output.stdout);
                let items = match serde_json::from_str::<serde_json::Value>(&stdout_str) {
                    Ok(v) => {
                        if v.is_array() {
                            let arr = v.as_array().cloned().unwrap_or_default();
                            tracing::info!("Parsed JSON as array of len {}", arr.len());
                            arr
                        } else if v.is_object() {
                            tracing::info!("Parsed JSON as single object");
                            vec![v.clone()]
                        } else {
                            tracing::info!("Parsed JSON is neither array nor object");
                            vec![]
                        }
                    },
                    Err(e) => {
                        tracing::error!("Failed to parse podman ps JSON: {}", e);
                        vec![]
                    }
                };

                tracing::info!("Number of items to process: {}", items.len());
                for item in items {
                    let name = item.get("Name")
                        .and_then(|x| x.as_str())
                        .or_else(|| {
                            item.get("Names").and_then(|n| n.as_array()).and_then(|arr| arr.first()).and_then(|x| x.as_str())
                        })
                        .or_else(|| item.get("ID").or_else(|| item.get("Id")).and_then(|x| x.as_str()))
                        .unwrap_or("unknown").to_string();
                        
                    let service = item.get("Labels")
                        .and_then(|l| l.get("io.podman.compose.service").or_else(|| l.get("com.docker.compose.service")))
                        .and_then(|x| x.as_str())
                        .unwrap_or(&name)
                        .to_string();
                    let status = item.get("State").or_else(|| item.get("Status")).and_then(|x| x.as_str()).unwrap_or("running").to_string();
                    let ports = parse_ports(&item);
                    let container_id = item.get("ID").or_else(|| item.get("Id")).and_then(|x| x.as_str()).unwrap_or("").to_string();

                    // Get stats
                    let (cpu_perc, mem_usage, mem_perc) = stats_map
                        .get(&name)
                        .cloned()
                        .unwrap_or_else(|| ("0.00%".to_string(), "0B / 0B".to_string(), "0.00%".to_string()));

                    // Get dependencies for this service (from compose file config)
                    let mut depends_on = depends_on_map.get(&service).cloned().unwrap_or_default();

                    // Inspect container for volumes and networks
                    let mut volumes = Vec::new();
                    let mut networks = Vec::new();

                    if !container_id.is_empty() {
                        let mut inspect_cmd = self.build_cmd(&engine, config.machine_name.as_deref());
                        let inspect_out = inspect_cmd
                            .args(["inspect", &container_id])
                            .output()
                            .await;

                        if let Ok(i_out) = inspect_out {
                            if i_out.status.success() {
                                if let Ok(i_json) = serde_json::from_slice::<serde_json::Value>(&i_out.stdout) {
                                    if let Some(c_info) = i_json.get(0) {
                                        // Extract Mounts (Volumes)
                                        if let Some(mounts) = c_info.get("Mounts").and_then(|m| m.as_array()) {
                                            for m in mounts {
                                                let src = m.get("Source").and_then(|s| s.as_str()).unwrap_or("");
                                                let dest = m.get("Destination").and_then(|d| d.as_str()).unwrap_or("");
                                                let name_opt = m.get("Name").and_then(|n| n.as_str());
                                                let display_src = name_opt.unwrap_or(src);
                                                if !display_src.is_empty() && !dest.is_empty() {
                                                    volumes.push(format!("{} ➔ {}", display_src, dest));
                                                }
                                            }
                                        }

                                        // Extract Networks
                                        if let Some(nets) = c_info.get("NetworkSettings").and_then(|n| n.get("Networks")).and_then(|n| n.as_object()) {
                                            for net_name in nets.keys() {
                                                networks.push(net_name.clone());
                                            }
                                        }

                                        // Fallback: Extract depends_on from Labels if missing
                                        if depends_on.is_empty() {
                                            if let Some(labels) = c_info.get("Config").and_then(|c| c.get("Labels")).and_then(|l| l.as_object()) {
                                                if let Some(deps_str) = labels.get("com.docker.compose.depends_on").and_then(|s| s.as_str()) {
                                                    let mut deps_list = Vec::new();
                                                    for part in deps_str.split(',') {
                                                        let s = part.split(':').next().unwrap_or("").trim();
                                                        if !s.is_empty() {
                                                            deps_list.push(s.to_string());
                                                        }
                                                    }
                                                    depends_on = deps_list;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    services.push(ServiceInfo {
                        name,
                        service,
                        status,
                        ports,
                        container_id,
                        cpu_perc,
                        mem_usage,
                        mem_perc,
                        volumes,
                        networks,
                        depends_on,
                    });
                }
                Ok(services)
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Err(format!("podman ps failed: {}", stderr))
            }
        })
    }
}
