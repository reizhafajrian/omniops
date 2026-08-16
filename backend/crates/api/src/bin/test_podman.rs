use tokio::process::Command;
#[tokio::main]
async fn main() {
    let name = "podman-machine-default";
    let out = Command::new("podman").args(["--connection", name, "stats", "--no-stream", "--format", "{{.ID}}|{{.CPUPerc}}|{{.MemPerc}}|{{.MemUsage}}"]).output().await.unwrap();
    println!("{}", String::from_utf8_lossy(&out.stdout));
}
