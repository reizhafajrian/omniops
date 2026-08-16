import React from 'react';
import { Cpu, MemoryStick, Box, Layers } from 'lucide-react';
import { MetricCard } from '@/components/MetricCard';

interface ProjectMetricsOverviewProps {
  metrics: {
    cpu: number;
    memPerc: number;
    memBytes: string;
    runningCount: number;
    totalCount: number;
    volumesCount: number;
    volumesSize: string;
  };
}

export const ProjectMetricsOverview: React.FC<ProjectMetricsOverviewProps> = ({ metrics }) => (
  <section>
    <h2 className="text-lg font-semibold text-white mb-4">Total Project Hardware & Metrics</h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
      <MetricCard
        title="Total CPU Usage"
        value={`${metrics.cpu.toFixed(2)}%`}
        icon={<Cpu size={24} />}
        iconBgClass="bg-blue-500/10"
        iconColorClass="text-blue-400"
        showProgress={true}
        progressValue={metrics.cpu}
        progressText={`${metrics.cpu.toFixed(2)}%`}
        progressColorClass="bg-blue-400"
      />
      <MetricCard
        title="Total RAM Usage"
        value={metrics.memBytes}
        icon={<MemoryStick size={24} />}
        iconBgClass="bg-emerald-500/10"
        iconColorClass="text-emerald-400"
        showProgress={true}
        progressValue={metrics.memPerc}
        progressText={`${metrics.memPerc.toFixed(2)}% of Machine`}
        progressColorClass="bg-emerald-500"
      />
      <MetricCard
        title="Project Containers"
        value={metrics.totalCount}
        icon={<Box size={24} />}
        iconBgClass="bg-indigo-500/10"
        iconColorClass="text-indigo-400"
        showProgress={true}
        progressValue={metrics.totalCount ? (metrics.runningCount / metrics.totalCount) * 100 : 0}
        progressText={`${metrics.runningCount} Active • ${metrics.totalCount - metrics.runningCount} Off`}
        progressColorClass="bg-indigo-500"
      />
      <MetricCard
        title="Total Volumes"
        value={metrics.volumesSize}
        icon={<Layers size={24} />}
        iconBgClass="bg-amber-500/10"
        iconColorClass="text-amber-400"
        showProgress={true}
        progressValue={100}
        progressText={`${metrics.volumesCount} Volumes Attached`}
        progressColorClass="bg-amber-500"
      />
    </div>
  </section>
);
