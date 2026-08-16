import React from 'react';
import { MetricCard } from '@/components/MetricCard';
import {
  Server,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  XCircle,
  Monitor,
  Box,
  Network,
  HardDrive,
  Activity,
} from 'lucide-react';

export interface DashboardStatsProps {
  stats: {
    total: number;
    synced: number;
    outOfSync: number;
    deploying: number;
    failed: number;
  };
  metrics?: {
    total_machines?: number;
    total_containers?: number;
    total_networks?: number;
    total_volumes?: number;
    cpu_percent?: number;
    ram_percent?: number;
  };
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ stats, metrics }) => {
  return (
    <div className="space-y-6">
      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard
          title="Total Stacks"
          value={stats.total}
          icon={<Server size={20} />}
          iconColorClass="text-slate-400"
          iconBgClass="bg-slate-500/10"
        />
        <MetricCard
          title="Synced"
          value={stats.synced}
          icon={<CheckCircle2 size={20} />}
          iconColorClass="text-emerald-500"
          iconBgClass="bg-emerald-500/10"
        />
        <MetricCard
          title="Out of Sync"
          value={stats.outOfSync}
          icon={<AlertTriangle size={20} />}
          iconColorClass="text-amber-500"
          iconBgClass="bg-amber-500/10"
        />
        <MetricCard
          title="Deploying"
          value={stats.deploying}
          icon={<Loader2 size={20} className="animate-spin" />}
          iconColorClass="text-brand-500"
          iconBgClass="bg-brand-500/10"
        />
        <MetricCard
          title="Failed"
          value={stats.failed}
          icon={<XCircle size={20} />}
          iconColorClass="text-destructive"
          iconBgClass="bg-destructive/10"
          className="col-span-2 md:col-span-1"
        />
      </div>

      {/* System Resources */}
      <div className="space-y-4 pt-4 border-t border-border">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">System Resources</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {metrics?.total_machines !== undefined && metrics.total_machines > 0 && (
            <MetricCard
              title="Machines"
              value={metrics.total_machines}
              icon={<Monitor size={20} />}
              iconColorClass="text-slate-400"
              iconBgClass="bg-slate-500/10"
            />
          )}
          <MetricCard
            title="Containers"
            value={metrics?.total_containers || 0}
            icon={<Box size={20} />}
            iconColorClass="text-blue-500"
            iconBgClass="bg-blue-500/10"
          />
          <MetricCard
            title="Networks"
            value={metrics?.total_networks || 0}
            icon={<Network size={20} />}
            iconColorClass="text-purple-500"
            iconBgClass="bg-purple-500/10"
          />
          <MetricCard
            title="Volumes"
            value={metrics?.total_volumes || 0}
            icon={<HardDrive size={20} />}
            iconColorClass="text-orange-500"
            iconBgClass="bg-orange-500/10"
          />
          
          {/* CPU Usage */}
          <MetricCard
            title="CPU Usage"
            value={`${(metrics?.cpu_percent || 0).toFixed(1)}%`}
            icon={<Activity size={20} />}
            iconColorClass="text-slate-400"
            iconBgClass="bg-slate-500/10"
            showProgress
            progressValue={metrics?.cpu_percent || 0}
            progressLabel="Overall Load"
            className="col-span-2"
          />

          {/* RAM Usage */}
          <MetricCard
            title="RAM Usage"
            value={`${(metrics?.ram_percent || 0).toFixed(1)}%`}
            icon={<HardDrive size={20} />}
            iconColorClass="text-slate-400"
            iconBgClass="bg-slate-500/10"
            showProgress
            progressValue={metrics?.ram_percent || 0}
            progressLabel="Memory Usage"
            className="col-span-2"
          />
        </div>
      </div>
    </div>
  );
};
