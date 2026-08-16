import { useMemo } from 'react';
import { ServiceInfo } from '@/types';
import { parseBytes, formatBytes } from '@/lib/formatters';

export function useProjectContainers(machineDetails: any, projectName: string) {
  return useMemo(() => {
    if (!machineDetails) return [];
    
    return machineDetails.containers.filter((container: any) => {
      const p = container.labels?.['com.docker.compose.project'] 
             || container.labels?.['io.podman.compose.project'];
      
      if (projectName === 'Standalone') {
        return !p;
      }
      return p === projectName;
    });
  }, [machineDetails, projectName]);
}

export function useProjectMetrics(machineDetails: any, projectContainers: any[]) {
  return useMemo(() => {
    let cpu = 0;
    let memPerc = 0;
    let memBytes = 0;
    let running = 0;
    const uniqueVolumes = new Set<string>();
    
    projectContainers.forEach((c: any) => {
      if (c.mounts) {
        c.mounts.forEach((m: string) => uniqueVolumes.add(m));
      }

      if (c.state === 'running') {
        running++;
        if (c.cpu_perc) {
          cpu += parseFloat(c.cpu_perc.replace('%', '')) || 0;
        }
        if (c.mem_perc) {
          memPerc += parseFloat(c.mem_perc.replace('%', '')) || 0;
        }
        if (c.mem_usage) {
          const usedStr = c.mem_usage.split(' / ')[0].trim();
          memBytes += parseBytes(usedStr);
        }
      }
    });

    let volumesSizeTotalBytes = 0;
    uniqueVolumes.forEach(v => {
      if (machineDetails?.volume_sizes && machineDetails.volume_sizes[v]) {
        volumesSizeTotalBytes += parseBytes(machineDetails.volume_sizes[v]);
      }
    });

    return {
      cpu,
      memPerc,
      memBytes: formatBytes(memBytes),
      runningCount: running,
      totalCount: projectContainers.length,
      volumesCount: uniqueVolumes.size,
      volumesSize: formatBytes(volumesSizeTotalBytes)
    };
  }, [projectContainers, machineDetails]);
}

export function useMappedServices(projectContainers: any[]): ServiceInfo[] {
  return useMemo(() => {
    return projectContainers.map((c: any) => {
      const serviceName = c.labels?.['com.docker.compose.service'] 
                       || c.labels?.['io.podman.compose.service'] 
                       || c.names[0] 
                       || c.id;
      
      let portsStr = '';
      if (c.ports) {
        portsStr = c.ports.map((p: any) => {
          const hostPort = p.hostPort || p.host_port;
          const containerPort = p.containerPort || p.container_port;
          return `${hostPort ? hostPort + '->' : ''}${containerPort}`;
        }).join(', ');
      }

      return {
        name: c.names[0] || c.id,
        service: serviceName,
        status: c.status,
        ports: portsStr,
        container_id: c.id,
        cpu_perc: c.cpu_perc || '0.00%',
        mem_usage: c.mem_usage || '0B / 0B',
        mem_perc: c.mem_perc || '0.00%',
        volumes: c.mounts || [],
        networks: [],
        depends_on: []
      };
    });
  }, [projectContainers]);
}

export function useGroupedContainers(machineDetails: any) {
  return useMemo(() => {
    if (!machineDetails) return {};
    const groups: Record<string, typeof machineDetails.containers> = {
      'Standalone': []
    };
    
    for (const container of machineDetails.containers) {
      const project = container.labels?.['com.docker.compose.project'] 
                   || container.labels?.['io.podman.compose.project'];
                   
      if (project) {
        if (!groups[project]) groups[project] = [];
        groups[project].push(container);
      } else {
        groups['Standalone'].push(container);
      }
    }
    
    // Remove Standalone if empty
    if (groups['Standalone'].length === 0) {
      delete groups['Standalone'];
    }
    
    return groups;
  }, [machineDetails]);
}
