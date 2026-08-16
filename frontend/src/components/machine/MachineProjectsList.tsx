import React from 'react';
import { Box, Info, Plus } from 'lucide-react';
import { StackCard } from '@/components/StackCard';
import { ProjectCard } from '@/components/ProjectCard';

interface MachineProjectsListProps {
  machineName: string;
  machineDetails: any;
  groupedContainers: Record<string, any[]>;
  stacks: any[];
}

export const MachineProjectsList: React.FC<MachineProjectsListProps> = ({
  machineName,
  machineDetails,
  groupedContainers,
  stacks,
}) => {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Box size={20} className="text-slate-400" />
            Running Projects
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.location.hash = `#/stacks/new?machine=${encodeURIComponent(machineName)}`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 border border-brand-500/20 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={14} />
            Add Stack
          </button>
          <div className="text-sm text-slate-400 bg-dark-900 px-3 py-1.5 rounded-full border border-slate-800">
            Total Containers: {machineDetails.containers.length}
          </div>
        </div>
      </div>

      {machineDetails.state !== 'running' ? (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <Info className="text-amber-400 mb-3" size={32} />
          <h3 className="text-amber-300 font-semibold mb-1">Machine is Stopped</h3>
          <p className="text-amber-400/80 text-sm max-w-md">
            The virtual machine must be running in order to query the containers inside it. Start the machine from the dashboard and try again.
          </p>
        </div>
      ) : machineDetails.containers.length === 0 ? (
        <div className="bg-dark-900 border border-dashed border-slate-700 rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <Box className="text-slate-600 mb-3" size={40} />
          <h3 className="text-slate-300 font-medium mb-1">No Containers Found</h3>
          <p className="text-slate-500 text-sm max-w-md">
            There are currently no containers running or stopped inside this Podman machine.
          </p>
        </div>
      ) : (
        /* Master View: Grid of Projects */
        <div className="grid grid-cols-1 md:grid-cols-1 xl:grid-cols-2 gap-6">
          {Object.entries(groupedContainers).map(([project, containers]) => {
            const stackMatch = stacks?.find(s => s.config.id === project);
            
            if (stackMatch) {
              return (
                <div key={project}>
                  <StackCard 
                    stack={stackMatch} 
                    onSelect={() => window.location.hash = `#/stacks/${project}`} 
                  />
                </div>
              );
            }
            
            const runningCount = containers.filter(c => c.state === 'running').length;
            return (
              <div key={project}>
                <ProjectCard 
                  projectName={project} 
                  containerCount={containers.length}
                  runningCount={runningCount}
                  onSelect={() => window.location.hash = `#/machines/${encodeURIComponent(machineName)}/projects/${encodeURIComponent(project)}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
