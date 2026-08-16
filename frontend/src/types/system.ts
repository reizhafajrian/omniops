export interface AppSettings {
  container_engine: string;
  admin_password?: string;
  github_token?: string;
}

export interface DockerStatusResponse {
  status: 'online' | 'offline' | 'not_installed';
  version?: string;
  containers: number;
  images: number;
  message: string;
}

export interface SystemMetricsResponse {
  total_machines: number;
  total_containers: number;
  total_networks: number;
  total_volumes: number;
  cpu_percent: number;
  ram_percent: number;
}
