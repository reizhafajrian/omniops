use axum::{extract::State, response::IntoResponse, http::StatusCode, Json};
use serde_json::json;
use tokio::process::Command;
use crate::app_state::AppState;

#[derive(serde::Serialize)]
pub struct DockerStatusResponse {
    pub status: String, // "online" | "offline" | "not_installed"
    pub version: Option<String>,
    pub containers: u32,
    pub images: u32,
    pub message: String,
}

/// Check live status of local Container Daemon.
pub async fn get_docker_status(State(state): State<AppState>) -> impl IntoResponse {
    let engine = state.settings.read().await.container_engine.clone();
    let engine_name = engine.as_str();
    let engine_capitalized = format!("{}{}", &engine[..1].to_uppercase(), &engine[1..]);

    // 1. Check if engine CLI executable exists
    let which_output = Command::new("which").arg(engine_name).output().await;
    if which_output.is_err() || !which_output.unwrap().status.success() {
        return (
            StatusCode::OK,
            Json(DockerStatusResponse {
                status: "not_installed".to_string(),
                version: None,
                containers: 0,
                images: 0,
                message: format!("{engine_capitalized} CLI is not installed or not found on PATH."),
            }),
        )
            .into_response();
    }

    // 2. Query engine info to check daemon responsiveness
    let info_output = Command::new(engine_name)
        .args(["info", "--format", "{{.Version.Version}}|{{.Store.ContainerStore.Number}}|{{.Store.ImageStore.Number}}"])
        .output()
        .await;

    match info_output {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let parts: Vec<&str> = stdout.trim().split('|').collect();

            let version = parts.first().map(|s| s.to_string());
            let containers = parts.get(1).and_then(|s| s.parse::<u32>().ok()).unwrap_or(0);
            let images = parts.get(2).and_then(|s| s.parse::<u32>().ok()).unwrap_or(0);

            (
                StatusCode::OK,
                Json(DockerStatusResponse {
                    status: "online".to_string(),
                    version,
                    containers,
                    images,
                    message: format!("{engine_capitalized} daemon is online and operational."),
                }),
            )
                .into_response()
        }
        _ => (
            StatusCode::OK,
            Json(DockerStatusResponse {
                status: "offline".to_string(),
                version: None,
                containers: 0,
                images: 0,
                message: format!("{engine_capitalized} daemon is stopped or unreachable. Click to launch {engine_capitalized} machine."),
            }),
        )
            .into_response(),
    }
}

/// Trigger background launch of Container machine or service daemon.
pub async fn start_docker_daemon(State(state): State<AppState>) -> impl IntoResponse {
    let engine = state.settings.read().await.container_engine.clone();
    let engine_name = engine.as_str();
    let engine_capitalized = format!("{}{}", &engine[..1].to_uppercase(), &engine[1..]);

    let mut launched = false;
    let mut details = Vec::new();

    // 1. Check if engine is installed
    let which_output = Command::new("which").arg(engine_name).output().await;
    let is_installed = which_output.map(|out| out.status.success()).unwrap_or(false);

    if !is_installed {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({
                "error": format!("{engine_capitalized} is not installed on this system. Please run the installation script: curl -fsSL https://raw.githubusercontent.com/.../install.sh | bash"),
                "details": [format!("'which {engine_name}' failed. Executable not found in PATH.")]
            })),
        )
            .into_response();
    }

    // 2. Start Engine
    // First check if it's already running
    let info_output = Command::new(engine_name)
        .args(["info", "--format", "{{.Version.Version}}"])
        .output()
        .await;
        
    if let Ok(out) = info_output {
        if out.status.success() {
            launched = true;
            details.push(format!("{engine_capitalized} is already running."));
        }
    }

    if !launched {
        // macOS: `engine machine start` (assuming podman/docker machine)
        #[cfg(target_os = "macos")]
        {
            let res = Command::new(engine_name).args(["machine", "start"]).output().await;
            if let Ok(out) = res {
                let stderr = String::from_utf8_lossy(&out.stderr);
                if out.status.success() || stderr.contains("already running") {
                    launched = true;
                    details.push(format!("Launched {engine_capitalized} machine via '{engine_name} machine start'"));
                } else {
                    details.push(format!("Failed to start {engine_name} machine. It may need to be initialized with '{engine_name} machine init'."));
                }
            }
        }

        // Linux: `systemctl start engine`
        #[cfg(target_os = "linux")]
        {
            let res = Command::new("systemctl").args(["start", engine_name]).output().await;
            if let Ok(out) = res {
                if out.status.success() {
                    launched = true;
                    details.push(format!("Started {engine_name} daemon via systemctl"));
                } else {
                    details.push(format!("Failed to start {engine_name} via systemctl. You may need root permissions."));
                }
            }
        }

        // Windows fallback or generic fallback
        if !launched {
            let fallback = Command::new(engine_name).args(["machine", "start"]).output().await;
            if let Ok(out) = fallback {
                let stderr = String::from_utf8_lossy(&out.stderr);
                if out.status.success() || stderr.contains("already running") {
                    launched = true;
                    details.push(format!("Launched {engine_name} machine as fallback"));
                }
            }
        }
    }

    if launched {
        (
            StatusCode::OK,
            Json(json!({
                "message": format!("{engine_capitalized} startup command executed successfully. Please allow a few seconds for daemon socket initialization."),
                "details": details
            })),
        )
            .into_response()
    } else {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({
                "error": format!("Failed to automatically launch {engine_capitalized}. Please start {engine_capitalized} machine manually."),
                "details": details
            })),
        )
            .into_response()
    }
}
use axum::extract::Path;

#[derive(serde::Deserialize)]
pub struct CreateMachineInput {
    pub name: String,
    pub cpus: Option<u32>,
    pub memory: Option<u32>, // in MB
    pub disk_size: Option<u32>, // in GB
}

pub async fn list_machines(State(state): State<AppState>) -> impl IntoResponse {
    let engine = state.settings.read().await.container_engine.clone();
    if engine != "podman" {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Machine management is only available when engine is set to podman."}))).into_response();
    }
    
    let res = Command::new("podman").args(["machine", "list", "--format", "json"]).output().await;
    match res {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            match serde_json::from_str::<serde_json::Value>(&stdout) {
                Ok(json) => (StatusCode::OK, Json(json)).into_response(),
                Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to parse podman machine output"}))).into_response(),
            }
        }
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed to list machines: {}", stderr)}))).into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response(),
    }
}

pub async fn create_machine(
    State(state): State<AppState>,
    Json(input): Json<CreateMachineInput>,
) -> impl IntoResponse {
    let engine = state.settings.read().await.container_engine.clone();
    if engine != "podman" {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Machine management is only available when engine is set to podman."}))).into_response();
    }

    let mut args = vec!["machine".to_string(), "init".to_string()];
    if let Some(cpus) = input.cpus {
        args.push("--cpus".to_string());
        args.push(cpus.to_string());
    }
    if let Some(mem) = input.memory {
        args.push("--memory".to_string());
        args.push(mem.to_string());
    }
    if let Some(disk) = input.disk_size {
        args.push("--disk-size".to_string());
        args.push(disk.to_string());
    }
    args.push(input.name.clone());

    let res = Command::new("podman").args(&args).output().await;
    match res {
        Ok(out) if out.status.success() => (StatusCode::OK, Json(json!({"message": format!("Machine '{}' created successfully", input.name)}))).into_response(),
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed to create machine: {}", stderr)}))).into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response(),
    }
}

pub async fn start_machine(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    let engine = state.settings.read().await.container_engine.clone();
    if engine != "podman" {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Machine management is only available when engine is set to podman."}))).into_response();
    }

    let res = Command::new("podman").args(["machine", "start", &name]).output().await;
    match res {
        Ok(out) if out.status.success() => (StatusCode::OK, Json(json!({"message": format!("Machine '{}' started", name)}))).into_response(),
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed to start machine: {}", stderr)}))).into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response(),
    }
}

pub async fn stop_machine(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    let engine = state.settings.read().await.container_engine.clone();
    if engine != "podman" {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Machine management is only available when engine is set to podman."}))).into_response();
    }

    let res = Command::new("podman").args(["machine", "stop", &name]).output().await;
    match res {
        Ok(out) if out.status.success() => (StatusCode::OK, Json(json!({"message": format!("Machine '{}' stopped", name)}))).into_response(),
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed to stop machine: {}", stderr)}))).into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response(),
    }
}

pub async fn delete_machine(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    let engine = state.settings.read().await.container_engine.clone();
    if engine != "podman" {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Machine management is only available when engine is set to podman."}))).into_response();
    }

    let res = Command::new("podman").args(["machine", "rm", "-f", &name]).output().await;
    match res {
        Ok(out) if out.status.success() => (StatusCode::OK, Json(json!({"message": format!("Machine '{}' deleted", name)}))).into_response(),
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed to delete machine: {}", stderr)}))).into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response(),
    }
}

#[derive(serde::Serialize)]
pub struct SystemMetricsResponse {
    pub total_machines: u32,
    pub total_containers: u32,
    pub total_networks: u32,
    pub total_volumes: u32,
    pub cpu_percent: f64,
    pub ram_percent: f64,
}

pub async fn get_system_metrics(State(state): State<AppState>) -> impl IntoResponse {
    let engine = state.settings.read().await.container_engine.clone();
    let engine_name = engine.as_str();

    let networks_fut = async {
        if let Ok(out) = Command::new(engine_name).args(["network", "ls", "-q"]).output().await {
            String::from_utf8_lossy(&out.stdout).lines().count() as u32
        } else { 0 }
    };

    let volumes_fut = async {
        if let Ok(out) = Command::new(engine_name).args(["volume", "ls", "-q"]).output().await {
            String::from_utf8_lossy(&out.stdout).lines().count() as u32
        } else { 0 }
    };

    let containers_fut = async {
        if let Ok(out) = Command::new(engine_name).args(["ps", "-a", "-q"]).output().await {
            String::from_utf8_lossy(&out.stdout).lines().count() as u32
        } else { 0 }
    };

    let machines_fut = async {
        if engine_name == "podman" {
            if let Ok(out) = Command::new(engine_name).args(["machine", "list", "--format", "{{.Name}}"]).output().await {
                return String::from_utf8_lossy(&out.stdout).lines().count() as u32;
            }
        }
        0
    };

    let stats_fut = async {
        let mut cpu = 0.0;
        let mut ram = 0.0;
        if let Ok(out) = Command::new(engine_name).args(["stats", "--no-stream", "--format", "{{.CPUPerc}}|{{.MemPerc}}"]).output().await {
            let stdout = String::from_utf8_lossy(&out.stdout);
            for line in stdout.lines() {
                let parts: Vec<&str> = line.split('|').collect();
                if parts.len() == 2 {
                    let c = parts[0].replace('%', "").trim().parse::<f64>().unwrap_or(0.0);
                    let r = parts[1].replace('%', "").trim().parse::<f64>().unwrap_or(0.0);
                    cpu += c;
                    ram += r;
                }
            }
        }
        
        let mut cores = 1.0;
        if let Ok(out) = Command::new(engine_name).args(["info", "--format", "{{json .}}"]).output().await {
            if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&out.stdout) {
                if let Some(c) = json.get("NCPU").and_then(|v| v.as_f64()) {
                    cores = c;
                } else if let Some(c) = json.pointer("/host/cpus").and_then(|v| v.as_f64()) {
                    cores = c;
                }
            }
        }
        
        if cores > 0.0 {
            cpu = cpu / cores;
        }

        (cpu, ram)
    };

    let (total_networks, total_volumes, total_containers, total_machines, (cpu_percent, ram_percent)) = 
        tokio::join!(networks_fut, volumes_fut, containers_fut, machines_fut, stats_fut);

    (
        StatusCode::OK,
        Json(SystemMetricsResponse {
            total_machines,
            total_containers,
            total_networks,
            total_volumes,
            cpu_percent,
            ram_percent,
        })
    ).into_response()
}

#[derive(serde::Serialize)]
pub struct MachineContainer {
    pub id: String,
    pub image: String,
    pub command: Option<Vec<String>>,
    pub created_at: String,
    pub state: String,
    pub status: String,
    pub ports: Option<Vec<serde_json::Value>>,
    pub names: Vec<String>,
    pub labels: Option<std::collections::HashMap<String, String>>,
    pub cpu_perc: Option<String>,
    pub mem_perc: Option<String>,
    pub mem_usage: Option<String>,
    pub mounts: Option<Vec<String>>,
    pub size: Option<String>,
}

#[derive(serde::Serialize)]
pub struct MachineDetailsResponse {
    pub name: String,
    pub state: String,
    pub cpus: u32,
    pub memory: u32,
    pub disk_size: u32,
    pub rootful: bool,
    pub containers: Vec<MachineContainer>,
    pub cpu_percent: f64,
    pub ram_percent: f64,
    pub total_networks: u32,
    pub total_volumes: u32,
    pub total_apps: u32,
    pub volume_sizes: Option<std::collections::HashMap<String, String>>,
}

pub async fn inspect_machine(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> impl IntoResponse {
    let engine = state.settings.read().await.container_engine.clone();
    if engine != "podman" {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Machine management is only available when engine is set to podman."}))).into_response();
    }

    let inspect_res = Command::new("podman").args(["machine", "inspect", &name]).output().await;
    let mut details = MachineDetailsResponse {
        name: name.clone(),
        state: "stopped".to_string(),
        cpus: 0,
        memory: 0,
        disk_size: 0,
        rootful: false,
        containers: vec![],
        cpu_percent: 0.0,
        ram_percent: 0.0,
        total_networks: 0,
        total_volumes: 0,
        total_apps: 0,
        volume_sizes: None,
    };

    match inspect_res {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&stdout) {
                if let Some(machine) = parsed.as_array().and_then(|arr| arr.first()) {
                    if let Some(state) = machine.get("State").and_then(|s| s.as_str()) {
                        details.state = state.to_string();
                    }
                    if let Some(cpus) = machine.pointer("/Resources/CPUs").and_then(|v| v.as_u64()) {
                        details.cpus = cpus as u32;
                    }
                    if let Some(mem) = machine.pointer("/Resources/Memory").and_then(|v| v.as_u64()) {
                        details.memory = mem as u32;
                    }
                    if let Some(disk) = machine.pointer("/Resources/DiskSize").and_then(|v| v.as_u64()) {
                        details.disk_size = disk as u32;
                    }
                    if let Some(rootful) = machine.get("Rootful").and_then(|v| v.as_bool()) {
                        details.rootful = rootful;
                    }
                }
            }
        }
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed to inspect machine: {}", stderr)}))).into_response();
        }
        Err(e) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response();
        }
    }

    if details.state == "running" {
        let ps_res = Command::new("podman").args(["--connection", &name, "ps", "-a", "--format", "json"]).output().await;
        if let Ok(out) = ps_res {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout);
                if let Ok(containers) = serde_json::from_str::<Vec<serde_json::Value>>(&stdout) {
                    for c in containers {
                        let id = c.get("Id").or_else(|| c.get("id")).and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let image = c.get("Image").or_else(|| c.get("image")).and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let state = c.get("State").or_else(|| c.get("state")).and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let status = c.get("Status").or_else(|| c.get("status")).and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let created_at = c.get("CreatedAt").or_else(|| c.get("created")).and_then(|v| v.as_str()).unwrap_or("").to_string();
                        
                        let names = c.get("Names").or_else(|| c.get("names")).and_then(|v| v.as_array()).map(|arr| {
                            arr.iter().filter_map(|n| n.as_str().map(|s| s.to_string())).collect()
                        }).unwrap_or_default();
                        
                        let command = c.get("Command").or_else(|| c.get("command")).and_then(|v| {
                            if let Some(arr) = v.as_array() {
                                Some(arr.iter().filter_map(|n| n.as_str().map(|s| s.to_string())).collect())
                            } else if let Some(s) = v.as_str() {
                                Some(vec![s.to_string()])
                            } else {
                                None
                            }
                        });

                        let ports = c.get("Ports").or_else(|| c.get("ports")).and_then(|v| v.as_array()).map(|arr| arr.clone());

                        let labels = c.get("Labels").or_else(|| c.get("labels")).and_then(|v| {
                            if let Some(obj) = v.as_object() {
                                let mut map = std::collections::HashMap::new();
                                for (k, v) in obj {
                                    if let Some(s) = v.as_str() {
                                        map.insert(k.clone(), s.to_string());
                                    }
                                }
                                Some(map)
                            } else {
                                None
                            }
                        });

                        let mounts = c.get("Mounts").or_else(|| c.get("mounts")).and_then(|v| {
                            if let Some(arr) = v.as_array() {
                                Some(arr.iter().filter_map(|m| {
                                    if let Some(s) = m.as_str() {
                                        Some(s.to_string())
                                    } else if let Some(obj) = m.as_object() {
                                        // docker compose might give object mounts with 'Source' or 'Destination'
                                        obj.get("Source").or_else(|| obj.get("Destination")).and_then(|s| s.as_str().map(|s| s.to_string()))
                                    } else {
                                        None
                                    }
                                }).collect())
                            } else {
                                None
                            }
                        });

                        details.containers.push(MachineContainer {
                            id,
                            image,
                            command,
                            created_at,
                            state,
                            status,
                            ports,
                            names,
                            labels,
                            cpu_perc: None,
                            mem_perc: None,
                            mem_usage: None,
                            mounts,
                            size: None,
                        });
                    }
                }
            }
        }

        let networks_fut = async {
            if let Ok(out) = Command::new("podman").args(["--connection", &name, "network", "ls", "-q"]).output().await {
                String::from_utf8_lossy(&out.stdout).lines().count() as u32
            } else { 0 }
        };

        let volumes_fut = async {
            if let Ok(out) = Command::new("podman").args(["--connection", &name, "volume", "ls", "-q"]).output().await {
                String::from_utf8_lossy(&out.stdout).lines().count() as u32
            } else { 0 }
        };

        let stats_fut = async {
            let mut cpu = 0.0;
            let mut ram = 0.0;
            let mut container_stats = std::collections::HashMap::new();
            if let Ok(out) = Command::new("podman").args(["--connection", &name, "stats", "--no-stream", "--format", "{{.ID}}|{{.CPUPerc}}|{{.MemPerc}}|{{.MemUsage}}"]).output().await {
                let stdout = String::from_utf8_lossy(&out.stdout);
                for line in stdout.lines() {
                    let parts: Vec<&str> = line.split('|').collect();
                    if parts.len() == 4 {
                        let id = parts[0].trim().to_string();
                        let cp = parts[1].trim().to_string();
                        let mp = parts[2].trim().to_string();
                        let mu = parts[3].trim().to_string();
                        
                        let c = cp.replace('%', "").trim().parse::<f64>().unwrap_or(0.0);
                        let r = mp.replace('%', "").trim().parse::<f64>().unwrap_or(0.0);
                        cpu += c;
                        ram += r;
                        
                        container_stats.insert(id, (cp, mp, mu));
                    }
                }
            }

            let mut cores = 1.0;
            if details.cpus > 0 {
                cores = details.cpus as f64;
            }
            if cores > 0.0 {
                cpu = cpu / cores;
            }

            (cpu, ram, container_stats)
        };

        let sizes_fut = async {
            let mut container_sizes = std::collections::HashMap::new();
            if let Ok(out) = Command::new("podman").args(["--connection", &name, "ps", "-a", "--size", "--format", "{{.ID}}|{{.Size}}"]).output().await {
                let stdout = String::from_utf8_lossy(&out.stdout);
                for line in stdout.lines() {
                    let parts: Vec<&str> = line.split('|').collect();
                    if parts.len() == 2 {
                        let id = parts[0].trim().to_string();
                        let size = parts[1].trim().split(" (virtual").next().unwrap_or(parts[1].trim()).to_string();
                        container_sizes.insert(id, size);
                    }
                }
            }
            container_sizes
        };

        let df_fut = async {
            let mut volume_sizes = std::collections::HashMap::new();
            if let Ok(out) = Command::new("podman").args(["--connection", &name, "system", "df", "-v"]).output().await {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let mut in_volumes = false;
                for line in stdout.lines() {
                    if line.starts_with("Local Volumes space usage:") {
                        in_volumes = true;
                        continue;
                    }
                    if in_volumes {
                        if line.trim().is_empty() {
                            break;
                        }
                        if line.starts_with("VOLUME NAME") {
                            continue;
                        }
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 3 {
                            let vol_name = parts[0].to_string();
                            let vol_size = parts.last().unwrap().to_string();
                            volume_sizes.insert(vol_name, vol_size);
                        }
                    }
                }
            }
            volume_sizes
        };

        let (total_networks, total_volumes, (cpu_percent, ram_percent, container_stats), container_sizes, volume_sizes) = tokio::join!(networks_fut, volumes_fut, stats_fut, sizes_fut, df_fut);
        details.total_networks = total_networks;
        details.total_volumes = total_volumes;
        details.cpu_percent = cpu_percent;
        details.ram_percent = ram_percent;
        details.volume_sizes = Some(volume_sizes);

        for c in &mut details.containers {
            let short_id = &c.id[..std::cmp::min(12, c.id.len())];
            if let Some((cp, mp, mu)) = container_stats.get(short_id) {
                c.cpu_perc = Some(cp.clone());
                c.mem_perc = Some(mp.clone());
                c.mem_usage = Some(mu.clone());
            }
            if let Some(sz) = container_sizes.get(short_id) {
                c.size = Some(sz.clone());
            }
        }

        let mut apps = std::collections::HashSet::new();
        for c in &details.containers {
            if let Some(labels) = &c.labels {
                if let Some(project) = labels.get("com.docker.compose.project").or_else(|| labels.get("io.podman.compose.project")) {
                    apps.insert(project.clone());
                }
            }
        }
        details.total_apps = apps.len() as u32;
    }

    (StatusCode::OK, Json(details)).into_response()
}

pub async fn inspect_container(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let engine = state.settings.read().await.container_engine.clone();
    let inspect_res = Command::new(&engine).args(["inspect", &id]).output().await;

    match inspect_res {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&stdout) {
                if let Some(container) = parsed.as_array().and_then(|arr| arr.first()) {
                    return (StatusCode::OK, Json(container.clone())).into_response();
                }
            }
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to parse inspect output"}))).into_response()
        }
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed to inspect container: {}", stderr)}))).into_response()
        }
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
    }
}

pub async fn start_container(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let engine = state.settings.read().await.container_engine.clone();
    let res = Command::new(&engine).args(["start", &id]).output().await;

    match res {
        Ok(out) if out.status.success() => (StatusCode::OK, Json(json!({"message": format!("Container {} started", id)}))).into_response(),
        Ok(out) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": String::from_utf8_lossy(&out.stderr).to_string()}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response(),
    }
}

pub async fn stop_container(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let engine = state.settings.read().await.container_engine.clone();
    let res = Command::new(&engine).args(["stop", &id]).output().await;

    match res {
        Ok(out) if out.status.success() => (StatusCode::OK, Json(json!({"message": format!("Container {} stopped", id)}))).into_response(),
        Ok(out) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": String::from_utf8_lossy(&out.stderr).to_string()}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response(),
    }
}

pub async fn restart_container(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let engine = state.settings.read().await.container_engine.clone();
    let res = Command::new(&engine).args(["restart", &id]).output().await;

    match res {
        Ok(out) if out.status.success() => (StatusCode::OK, Json(json!({"message": format!("Container {} restarted", id)}))).into_response(),
        Ok(out) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": String::from_utf8_lossy(&out.stderr).to_string()}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response(),
    }
}

pub async fn remove_container(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let engine = state.settings.read().await.container_engine.clone();
    let res = Command::new(&engine).args(["rm", "-f", &id]).output().await;

    match res {
        Ok(out) if out.status.success() => (StatusCode::OK, Json(json!({"message": format!("Container {} removed", id)}))).into_response(),
        Ok(out) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": String::from_utf8_lossy(&out.stderr).to_string()}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response(),
    }
}

pub async fn get_container_logs(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let engine = state.settings.read().await.container_engine.clone();
    let res = Command::new(&engine).args(["logs", "--tail", "1000", "-t", &id]).output().await;

    match res {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            // Docker logs sometimes splits stdout and stderr
            let mut logs = stdout;
            if !stderr.is_empty() {
                logs.push_str("\n");
                logs.push_str(&stderr);
            }
            (StatusCode::OK, Json(json!({"logs": logs}))).into_response()
        }
        Ok(out) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": String::from_utf8_lossy(&out.stderr).to_string()}))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response(),
    }
}

#[derive(serde::Serialize)]
pub struct ContainerStats {
    pub cpu_percent: String,
    pub mem_usage: String,
    pub net_io: String,
    pub block_io: String,
}

pub async fn get_container_stats(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let engine = state.settings.read().await.container_engine.clone();
    let res = Command::new(&engine)
        .args(["stats", "--no-stream", "--format", "{{.CPUPerc}}|{{.MemUsage}}|{{.NetIO}}|{{.BlockIO}}", &id])
        .output()
        .await;

    match res {
        Ok(out) if out.status.success() => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let line = stdout.lines().next().unwrap_or("");
            let parts: Vec<&str> = line.split('|').collect();
            
            if parts.len() >= 4 {
                let stats = ContainerStats {
                    cpu_percent: parts[0].trim().to_string(),
                    mem_usage: parts[1].trim().to_string(),
                    net_io: parts[2].trim().to_string(),
                    block_io: parts[3].trim().to_string(),
                };
                (StatusCode::OK, Json(stats)).into_response()
            } else {
                (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to parse stats output"}))).into_response()
            }
        }
        Ok(out) => {
            let stderr = String::from_utf8_lossy(&out.stderr);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("Failed to get stats: {}", stderr)}))).into_response()
        }
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
    }
}

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use tokio::io::AsyncBufReadExt;

pub async fn ws_machine_project_logs(
    State(state): State<AppState>,
    Path((machine, project)): Path<(String, String)>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    let engine = state.settings.read().await.container_engine.clone();
    let container_filter = params.get("container").cloned();
    ws.on_upgrade(move |socket| handle_ws_project_logs(socket, machine, project, engine, container_filter))
}

async fn handle_ws_project_logs(
    mut socket: WebSocket,
    machine: String,
    project: String,
    engine: String,
    container_filter: Option<String>,
) {
    // 1. Find all containers for this project
    let ps_res = Command::new(&engine)
        .args(["--connection", &machine, "ps", "-a", "--format", "json"])
        .output()
        .await;

    let mut container_names = Vec::new();

    if let Ok(out) = ps_res {
        if out.status.success() {
            let stdout = String::from_utf8_lossy(&out.stdout);
            if let Ok(containers) = serde_json::from_str::<Vec<serde_json::Value>>(&stdout) {
                for c in containers {
                    let mut belongs_to_project = false;
                    if let Some(labels) = c.get("Labels").or_else(|| c.get("labels")).and_then(|v| v.as_object()) {
                        if let Some(p) = labels.get("com.docker.compose.project").or_else(|| labels.get("io.podman.compose.project")) {
                            if p.as_str() == Some(&project) {
                                belongs_to_project = true;
                            }
                        }
                    }
                    if belongs_to_project {
                        // get container name or id
                        let name = c.get("Names").or_else(|| c.get("names")).and_then(|v| v.as_array().and_then(|a| a.first())).and_then(|v| v.as_str())
                            .or_else(|| c.get("Id").or_else(|| c.get("id")).and_then(|v| v.as_str()));
                        if let Some(n) = name {
                            if let Some(ref filter) = container_filter {
                                // Match container name or ID
                                if n == filter || c.get("Id").or_else(|| c.get("id")).and_then(|v| v.as_str()) == Some(filter) {
                                    container_names.push(n.to_string());
                                }
                            } else {
                                container_names.push(n.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    if container_names.is_empty() {
        let _ = socket.send(Message::Text(format!("error: no containers found for project '{}'", project))).await;
        let _ = socket.close().await;
        return;
    }

    let (tx, mut rx) = tokio::sync::mpsc::channel::<String>(100);
    let mut children = Vec::new();

    for cname in &container_names {
        let mut cmd = Command::new(&engine);
        cmd.args(["--connection", &machine, "logs", "-f", "--tail", "100", "--names", cname]);
        cmd.stdout(std::process::Stdio::piped());
        cmd.stderr(std::process::Stdio::piped());

        if let Ok(mut child) = cmd.spawn() {
            if let Some(stdout) = child.stdout.take() {
                let tx_clone = tx.clone();
                tokio::spawn(async move {
                    let mut lines = tokio::io::BufReader::new(stdout).lines();
                    while let Ok(Some(line)) = lines.next_line().await {
                        if tx_clone.send(line).await.is_err() {
                            break;
                        }
                    }
                });
            }
            if let Some(stderr) = child.stderr.take() {
                let tx_clone = tx.clone();
                tokio::spawn(async move {
                    let mut lines = tokio::io::BufReader::new(stderr).lines();
                    while let Ok(Some(line)) = lines.next_line().await {
                        if tx_clone.send(line).await.is_err() {
                            break;
                        }
                    }
                });
            }
            children.push(child);
        }
    }

    // Drop our reference so the channel closes when all tasks exit
    drop(tx);

    let mut stream_ended = false;
    loop {
        tokio::select! {
            line_opt = rx.recv(), if !stream_ended => {
                match line_opt {
                    Some(text) => {
                        if socket.send(Message::Text(text)).await.is_err() {
                            break;
                        }
                    }
                    None => {
                        let _ = socket.send(Message::Text("--- log stream ended, waiting for reconnect ---".into())).await;
                        let _ = socket.send(Message::Close(Some(axum::extract::ws::CloseFrame {
                            code: 1011,
                            reason: "Stream ended".into()
                        }))).await;
                        break;
                    }
                }
            }
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(Message::Ping(payload))) => {
                        let _ = socket.send(Message::Pong(payload)).await;
                    }
                    Some(Ok(Message::Text(text))) if text == "PING" => {
                        let _ = socket.send(Message::Text("PONG".into())).await;
                    }
                    _ => {}
                }
            }
        }
    }

    for mut child in children {
        let _ = child.kill().await;
    }
}
