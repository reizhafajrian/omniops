export interface PodmanMachine {
  Name: string;
  Default: boolean;
  Created: string;
  Running: boolean;
  Starting: boolean;
  LastUp: string;
  Stream: string;
  VMType: string;
  CPUs: number;
  Memory: string;
  Swap: string;
  DiskSize: string;
  Port: number;
  RemoteUsername: string;
  IdentityPath: string;
  UserModeNetworking: boolean;
}

export interface CreateMachineInput {
  name: string;
  cpus: number;
  memory: number; // in MB
  disk_size: number; // in GB
}

export interface MachineContainer {
  id: string;
  image: string;
  command?: string[];
  created_at: string;
  state: string;
  status: string;
  ports?: any[];
  names: string[];
  labels?: Record<string, string>;
  cpu_perc?: string;
  mem_perc?: string;
  mem_usage?: string;
  mounts?: string[];
  size?: string;
}

export interface MachineDetailsResponse {
  name: string;
  state: string;
  cpus: number;
  memory: number;
  disk_size: number;
  rootful: boolean;
  containers: MachineContainer[];
  cpu_percent: number;
  ram_percent: number;
  total_networks: number;
  total_volumes: number;
  total_apps: number;
  volume_sizes?: Record<string, string>;
}
