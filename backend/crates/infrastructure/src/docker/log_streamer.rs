//! `DockerLogStreamer` — stub for Phase 1.
//!
//! Phase 2 will replace the subprocess approach in `handlers/logs.rs` with a
//! direct Docker Engine API call via the Unix socket, streaming
//! `application/vnd.docker.raw-stream` frames.

pub struct DockerLogStreamer;

impl DockerLogStreamer {
    pub fn new() -> Self { Self }
}
