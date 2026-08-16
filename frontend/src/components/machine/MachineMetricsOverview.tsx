import React from 'react';
import { Cpu, MemoryStick, HardDrive, Activity, Box, Server } from 'lucide-react';
import { MetricCard } from '@/components/MetricCard';

interface MachineMetricsOverviewProps {
  machineDetails: any;
}

export const MachineMetricsOverview: React.FC<MachineMetricsOverviewProps> = ({ machineDetails }) => {
  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-4">Total Machine Hardware & Metrics</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <MetricCard
          title="CPU Cores"
          value={`${machineDetails.cpus} Core${machineDetails.cpus > 1 ? 's' : ''}`}
          icon={<Cpu size={24} />}
          iconBgClass="bg-blue-500/10"
          iconColorClass="text-blue-400"
          showProgress={machineDetails.state === 'running'}
          progressValue={machineDetails.cpu_percent || 0}
          progressText={`${machineDetails.cpu_percent?.toFixed(2) || '0.00'}%`}
        />

        <MetricCard
          title="Memory"
          value={`${machineDetails.memory} MB`}
          icon={<MemoryStick size={24} />}
          iconBgClass="bg-emerald-500/10"
          iconColorClass="text-emerald-400"
          showProgress={machineDetails.state === 'running'}
          progressValue={machineDetails.ram_percent || 0}
          progressText={`${machineDetails.ram_percent?.toFixed(2) || '0.00'}%`}
          progressColorClass="bg-emerald-500"
        />

        <MetricCard
          title="Disk Size"
          value={`${machineDetails.disk_size} GB`}
          icon={<HardDrive size={24} />}
          iconBgClass="bg-amber-500/10"
          iconColorClass="text-amber-400"
        />

        <MetricCard
          title="Status"
          value={<span className="capitalize">{machineDetails.state}</span>}
          icon={<Activity size={24} />}
          iconBgClass="bg-purple-500/10"
          iconColorClass="text-purple-400"
        />
        
        {machineDetails.state === 'running' && (
          <>
            <MetricCard
              title="Apps (Projects)"
              value={machineDetails.total_apps || 0}
              icon={<Box size={24} />}
              iconBgClass="bg-indigo-500/10"
              iconColorClass="text-indigo-400"
            />
            <MetricCard
              title="Containers (Run/Total)"
              value={`${machineDetails.containers.filter((c: any) => c.state === 'running').length} / ${machineDetails.containers.length}`}
              icon={<Box size={24} />}
              iconBgClass="bg-pink-500/10"
              iconColorClass="text-pink-400"
            />
            <MetricCard
              title="Networks"
              value={machineDetails.total_networks || 0}
              icon={<Server size={24} />}
              iconBgClass="bg-cyan-500/10"
              iconColorClass="text-cyan-400"
            />
            <MetricCard
              title="Volumes"
              value={machineDetails.total_volumes || 0}
              icon={<HardDrive size={24} />}
              iconBgClass="bg-orange-500/10"
              iconColorClass="text-orange-400"
            />
          </>
        )}
      </div>
    </section>
  );
};
