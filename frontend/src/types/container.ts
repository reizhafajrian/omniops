export interface ServiceInfo {
  name: string;
  service: string;
  status: string;
  ports: string;
  container_id: string;
  cpu_perc: string;
  mem_usage: string;
  mem_perc: string;
  volumes: string[];
  networks: string[];
  depends_on?: string[];
}

export interface ServicesResponse {
  services: ServiceInfo[];
}
