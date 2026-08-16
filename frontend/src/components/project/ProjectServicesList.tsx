import React from 'react';
import { Box, Info } from 'lucide-react';
import { ServiceCard } from '@/components/ServiceCard';
import { ServiceInfo } from '@/types';;
import { useQueryClient } from '@tanstack/react-query';

interface ProjectServicesListProps {
  machineName: string;
  isMachineRunning: boolean;
  projectContainers: any[];
}

export const ProjectServicesList: React.FC<ProjectServicesListProps> = ({
  machineName,
  isMachineRunning,
  projectContainers,
}) => {
  const queryClient = useQueryClient();

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Box size={20} className="text-slate-400" />
          Containers
        </h2>
        <div className="text-sm text-slate-400 bg-dark-900 px-3 py-1 rounded-full border border-slate-800">
          Total: {projectContainers.length}
        </div>
      </div>

      {!isMachineRunning ? (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <Info className="text-amber-400 mb-3" size={32} />
          <h3 className="text-amber-300 font-semibold mb-1">Machine is Stopped</h3>
          <p className="text-amber-400/80 text-sm max-w-md">
            The virtual machine must be running in order to query the containers inside it.
          </p>
        </div>
      ) : projectContainers.length === 0 ? (
        <div className="bg-dark-900 border border-dashed border-slate-700 rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <Box className="text-slate-600 mb-3" size={40} />
          <h3 className="text-slate-300 font-medium mb-1">No Containers Found</h3>
          <p className="text-slate-500 text-sm max-w-md">
            There are currently no containers running or stopped for this project.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {projectContainers.map((container) => {
            const svc: ServiceInfo = {
              name: container.names[0] || container.id,
              service: container.names[0] || container.id,
              status: container.status || (container.state === 'running' ? 'running' : container.state),
              ports: container.ports?.map((p: any) => p.PublicPort ? `${p.PublicPort}:${p.PrivatePort}` : `${p.PrivatePort}`).join(', ') || '',
              container_id: container.id,
              cpu_perc: container.cpu_perc || '0.00%',
              mem_usage: container.mem_usage || '0B',
              mem_perc: container.mem_perc || '0.00%',
              volumes: container.mounts || [],
              networks: [],
            };

            return (
              <ServiceCard 
                key={container.id} 
                svc={svc} 
                onActionSuccess={() => queryClient.invalidateQueries({ queryKey: ['podman', 'machine-details', machineName] })} 
              />
            );
          })}
        </div>
      )}
    </section>
  );
};
