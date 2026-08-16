use crate::entities::service::ServiceInfo;
use crate::entities::stack::{StackId, StackConfig};
use crate::ports::state_store::BoxFuture;

pub trait DockerInspectorPort: Send + Sync {
    /// Inspects a running compose stack and returns its service topology and stats.
    fn get_services<'a>(
        &'a self,
        stack_id: &'a StackId,
        config: &'a StackConfig,
    ) -> BoxFuture<'a, Result<Vec<ServiceInfo>, String>>;
}
