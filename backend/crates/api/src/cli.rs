use clap::{Parser, Subcommand};
use std::process::Command;
use tracing::{info, error, warn};

#[derive(Parser)]
#[command(name = "omniops", version, about = "Self-Hosted GitOps Engine for Podman & Docker")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Starts the OmniOps backend server (default)
    Serve,
    /// Installs a container engine (podman or docker)
    Install {
        /// The engine to install (podman, docker, or both)
        #[arg(long, default_value = "podman")]
        engine: String,
    },
    /// Uninstalls and deep cleans a container engine
    Uninstall {
        /// Also uninstall the underlying container engine (deep clean)
        #[arg(short, long)]
        deep_clean: bool,
        /// The engine to deep clean (podman, docker, or both) if --deep-clean is set
        #[arg(long, default_value = "podman")]
        engine: String,
    },
    /// Starts the OmniOps server in the background (daemon mode)
    Start,
    /// Stops the background OmniOps server
    Stop,
    /// Shows the status of the background OmniOps server
    Status,
}

pub fn handle_cli() -> Option<Commands> {
    let cli = Cli::parse();
    cli.command
}

pub fn run_install_command(engine: &str) {
    println!("==================================================");
    println!("    OmniOps Engine Installation                   ");
    println!("==================================================");
    println!();
    println!("Selected Engine: {}", engine);

    let os = std::env::consts::OS;
    println!("[1/2] Detected operating system: {}", os);

    let install_podman = engine == "podman" || engine == "both";
    let install_docker = engine == "docker" || engine == "both";

    println!("[2/2] Installing Engine(s)...");

    if install_podman {
        install_podman_logic(os);
    }

    if install_docker {
        install_docker_logic(os);
    }

    println!();
    println!("Installation complete!");
    println!("Run 'omni serve' to start the server.");
    println!("==================================================");
}

pub fn run_uninstall_command(deep_clean: bool, engine: &str) {
    println!("==================================================");
    if deep_clean {
        println!("    OmniOps & Engine Uninstallation (Deep Clean)  ");
    } else {
        println!("    OmniOps Uninstallation                        ");
    }
    println!("==================================================");
    println!();

    // 1. Uninstall OmniOps data and binary
    println!("[1/2] Removing OmniOps data and binary...");
    
    // Remove database
    let db_path = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:./omniops.db".into())
        .replace("sqlite:", "");
    if std::path::Path::new(&db_path).exists() {
        println!("Removing database: {}", db_path);
        let _ = std::fs::remove_file(&db_path);
    }

    // Remove stacks config
    let stacks_path = std::env::var("STACKS_CONFIG_PATH")
        .unwrap_or_else(|_| "./stacks.yml".into());
    if std::path::Path::new(&stacks_path).exists() {
        println!("Removing stacks config: {}", stacks_path);
        let _ = std::fs::remove_file(&stacks_path);
    }

    // Remove temp checkout dirs
    let temp_dir = std::env::temp_dir();
    let checkouts_dir = temp_dir.join("gitops_checkouts");
    let inline_dir = temp_dir.join("gitops_inline");
    
    if checkouts_dir.exists() {
        println!("Removing temporary checkouts...");
        let _ = std::fs::remove_dir_all(checkouts_dir);
    }
    if inline_dir.exists() {
        println!("Removing temporary inline configs...");
        let _ = std::fs::remove_dir_all(inline_dir);
    }

    // 2. Uninstall Engine (if requested)
    if deep_clean {
        println!();
        println!("[2/2] Deep cleaning engine: {}", engine);
        let os = std::env::consts::OS;
        
        let uninstall_podman = engine == "podman" || engine == "both";
        let uninstall_docker = engine == "docker" || engine == "both";

        if uninstall_podman {
            uninstall_podman_logic(os);
        }

        if uninstall_docker {
            uninstall_docker_logic(os);
        }
    } else {
        println!();
        println!("[2/2] Skipping engine removal (run with --deep-clean to remove Podman/Docker).");
    }

    println!();
    println!("Uninstallation complete!");

    // Self-delete binary (best effort)
    if let Ok(exe_path) = std::env::current_exe() {
        if cfg!(windows) {
            println!("Note: On Windows, the executable cannot delete itself while running.");
            println!("Please manually delete: {}", exe_path.display());
        } else {
            println!("Removing executable: {}", exe_path.display());
            let _ = std::fs::remove_file(&exe_path);
        }
    }
    
    println!("==================================================");
}

pub fn run_start_command() {
    let home = std::env::var("HOME").unwrap_or_else(|_| "~".to_string());
    let log_path = format!("{}/.omniops.log", home);
    let pid_path = format!("{}/.omniops.pid", home);

    // Check if already running
    if std::path::Path::new(&pid_path).exists() {
        let pid_str = std::fs::read_to_string(&pid_path).unwrap_or_default();
        if !pid_str.trim().is_empty() {
            println!("OmniOps is already running (PID: {})", pid_str.trim());
            return;
        }
    }

    println!("Starting OmniOps in the background...");
    
    let exe_path = std::env::current_exe().expect("Failed to get current executable path");
    
    let log_file = std::fs::File::create(&log_path).expect("Failed to create log file");
    let log_file_err = log_file.try_clone().expect("Failed to clone log file handle");

    #[cfg(unix)]
    let child = std::process::Command::new("nohup")
        .arg(exe_path)
        .arg("serve")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::from(log_file))
        .stderr(std::process::Stdio::from(log_file_err))
        .spawn();

    #[cfg(windows)]
    let child = std::process::Command::new("cmd")
        .arg("/C")
        .arg("start")
        .arg("/B")
        .arg(exe_path)
        .arg("serve")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::from(log_file))
        .stderr(std::process::Stdio::from(log_file_err))
        .spawn();

    match child {
        Ok(child) => {
            let pid = child.id();
            std::fs::write(&pid_path, pid.to_string()).expect("Failed to write PID file");
            println!("Server started successfully! (PID: {})", pid);
            println!("Logs are being written to: {}", log_path);
        }
        Err(e) => {
            eprintln!("Failed to start server: {}", e);
        }
    }
}

pub fn run_stop_command() {
    let home = std::env::var("HOME").unwrap_or_else(|_| "~".to_string());
    let pid_path = format!("{}/.omniops.pid", home);

    if !std::path::Path::new(&pid_path).exists() {
        println!("OmniOps is not currently running in the background.");
        return;
    }

    let pid_str = std::fs::read_to_string(&pid_path).unwrap_or_default();
    let pid = pid_str.trim();

    if pid.is_empty() {
        println!("Invalid PID file. Cleaning up...");
        let _ = std::fs::remove_file(&pid_path);
        return;
    }

    println!("Stopping OmniOps (PID: {})...", pid);

    #[cfg(unix)]
    let status = std::process::Command::new("kill").arg(pid).status();

    #[cfg(windows)]
    let status = std::process::Command::new("taskkill").arg("/F").arg("/PID").arg(pid).status();

    match status {
        Ok(s) if s.success() => {
            println!("Server stopped successfully.");
            let _ = std::fs::remove_file(&pid_path);
        }
        _ => {
            // Process might already be dead
            println!("Process not found or already stopped. Cleaning up PID file...");
            let _ = std::fs::remove_file(&pid_path);
        }
    }
}

pub fn run_status_command() {
    let home = std::env::var("HOME").unwrap_or_else(|_| "~".to_string());
    let pid_path = format!("{}/.omniops.pid", home);

    if !std::path::Path::new(&pid_path).exists() {
        println!("OmniOps Status: STOPPED");
        return;
    }

    let pid_str = std::fs::read_to_string(&pid_path).unwrap_or_default();
    let pid = pid_str.trim();

    if pid.is_empty() {
        println!("OmniOps Status: STOPPED (stale PID file)");
        let _ = std::fs::remove_file(&pid_path);
        return;
    }

    // Check if process exists
    #[cfg(unix)]
    let is_running = std::process::Command::new("kill").arg("-0").arg(pid).output().map(|o| o.status.success()).unwrap_or(false);

    #[cfg(windows)]
    let is_running = std::process::Command::new("tasklist").arg("/FI").arg(format!("PID eq {}", pid)).output()
        .map(|o| String::from_utf8_lossy(&o.stdout).contains(pid))
        .unwrap_or(false);

    if is_running {
        println!("OmniOps Status: RUNNING (PID: {})", pid);
    } else {
        println!("OmniOps Status: STOPPED (stale PID file)");
        let _ = std::fs::remove_file(&pid_path);
    }
}

fn install_podman_logic(os: &str) {
    if is_command_available("podman") {
        println!("Podman is already installed!");
        return;
    }

    println!("Installing Podman...");
    match os {
        "linux" => {
            if is_command_available("apt-get") {
                run_cmd_with_output("sudo", &["apt-get", "update"]);
                run_cmd_with_output("sudo", &["apt-get", "install", "-y", "podman", "podman-compose"]);
            } else if is_command_available("dnf") {
                run_cmd_with_output("sudo", &["dnf", "install", "-y", "podman", "podman-compose"]);
            } else if is_command_available("pacman") {
                run_cmd_with_output("sudo", &["pacman", "-S", "--noconfirm", "podman", "podman-compose"]);
            } else {
                println!("Unsupported Linux package manager. Please install podman manually.");
            }
        }
        "macos" => {
            if is_command_available("brew") {
                run_cmd_with_output("brew", &["install", "podman", "podman-compose"]);
                println!("Initializing Podman machine...");
                // Ignore errors for init and start, as they might already exist
                let _ = Command::new("podman").arg("machine").arg("init").status();
                let _ = Command::new("podman").arg("machine").arg("start").status();
            } else {
                println!("Homebrew is not installed. Please install Podman manually.");
            }
        }
        _ => {
            println!("Automatic installation for OS '{}' is not supported. Please install Podman manually.", os);
        }
    }
}

fn install_docker_logic(os: &str) {
    if is_command_available("docker") {
        println!("Docker is already installed!");
        return;
    }

    println!("Installing Docker...");
    match os {
        "linux" => {
            if is_command_available("apt-get") {
                run_cmd_with_output("sudo", &["apt-get", "update"]);
                run_cmd_with_output("sudo", &["apt-get", "install", "-y", "docker.io", "docker-compose-v2"]);
            } else if is_command_available("dnf") {
                run_cmd_with_output("sudo", &["dnf", "install", "-y", "docker", "docker-compose"]);
            } else if is_command_available("pacman") {
                run_cmd_with_output("sudo", &["pacman", "-S", "--noconfirm", "docker", "docker-compose"]);
            } else {
                println!("Unsupported Linux package manager. Please install docker manually.");
            }
        }
        "macos" => {
            if is_command_available("brew") {
                run_cmd_with_output("brew", &["install", "--cask", "docker"]);
                println!("Please open Docker Desktop to start the daemon.");
            } else {
                println!("Homebrew is not installed. Please install Docker manually.");
            }
        }
        _ => {
            println!("Automatic installation for OS '{}' is not supported. Please install Docker manually.", os);
        }
    }
}

fn uninstall_podman_logic(os: &str) {
    println!("Uninstalling Podman...");
    match os {
        "linux" => {
            if is_command_available("apt-get") {
                run_cmd_with_output("sudo", &["apt-get", "purge", "-y", "podman", "podman-compose"]);
                run_cmd_with_output("sudo", &["apt-get", "autoremove", "-y"]);
            } else if is_command_available("dnf") {
                run_cmd_with_output("sudo", &["dnf", "remove", "-y", "podman", "podman-compose"]);
            } else if is_command_available("pacman") {
                run_cmd_with_output("sudo", &["pacman", "-Rns", "--noconfirm", "podman", "podman-compose"]);
            }
        }
        "macos" => {
            println!("Stopping and removing Podman machines...");
            let _ = Command::new("podman").arg("machine").arg("stop").status();
            let _ = Command::new("podman").arg("machine").arg("rm").arg("-f").status();
            
            if is_command_available("brew") {
                run_cmd_with_output("brew", &["uninstall", "podman", "podman-compose"]);
            }
        }
        _ => {
            println!("Automatic uninstallation for OS '{}' is not supported.", os);
        }
    }

    println!("Performing Deep Clean for Podman...");
    let home = std::env::var("HOME").unwrap_or_else(|_| "~".to_string());
    
    // Deep clean paths
    let paths_to_remove = vec![
        format!("{}/.config/containers", home),
        format!("{}/.local/share/containers", home),
        format!("{}/.ssh/podman-machine-default", home),
        format!("{}/.ssh/podman-machine-default.pub", home),
    ];

    for path in paths_to_remove {
        if std::path::Path::new(&path).exists() {
            println!("Removing {}...", path);
            let _ = std::fs::remove_dir_all(&path);
            let _ = std::fs::remove_file(&path); // In case it's a file
        }
    }
}

fn uninstall_docker_logic(os: &str) {
    println!("Uninstalling Docker...");
    match os {
        "linux" => {
            if is_command_available("apt-get") {
                run_cmd_with_output("sudo", &["apt-get", "purge", "-y", "docker.io", "docker-compose-v2"]);
                run_cmd_with_output("sudo", &["apt-get", "autoremove", "-y"]);
            } else if is_command_available("dnf") {
                run_cmd_with_output("sudo", &["dnf", "remove", "-y", "docker", "docker-compose"]);
            } else if is_command_available("pacman") {
                run_cmd_with_output("sudo", &["pacman", "-Rns", "--noconfirm", "docker", "docker-compose"]);
            }
        }
        "macos" => {
            if is_command_available("brew") {
                run_cmd_with_output("brew", &["uninstall", "--cask", "docker"]);
            }
        }
        _ => {
            println!("Automatic uninstallation for OS '{}' is not supported.", os);
        }
    }

    println!("Performing Deep Clean for Docker...");
    let home = std::env::var("HOME").unwrap_or_else(|_| "~".to_string());
    
    let path = format!("{}/.docker", home);
    if std::path::Path::new(&path).exists() {
        println!("Removing {}...", path);
        let _ = std::fs::remove_dir_all(&path);
    }
}

fn is_command_available(cmd: &str) -> bool {
    let check_cmd = if cfg!(windows) { "where" } else { "command" };
    let check_arg = if cfg!(windows) { cmd } else { "-v" };
    
    let mut command = Command::new(check_cmd);
    if !cfg!(windows) {
        command.arg(check_arg).arg(cmd);
    } else {
        command.arg(check_arg);
    }

    command.output().map(|out| out.status.success()).unwrap_or(false)
}

fn run_cmd_with_output(program: &str, args: &[&str]) {
    println!("Running: {} {}", program, args.join(" "));
    let status = Command::new(program)
        .args(args)
        .status();
        
    match status {
        Ok(s) if !s.success() => {
            println!("Command failed with exit code: {}", s.code().unwrap_or(-1));
        }
        Err(e) => {
            println!("Failed to execute command: {}", e);
        }
        _ => {}
    }
}
