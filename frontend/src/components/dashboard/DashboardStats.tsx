import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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

export interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  colSpanClass?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label, value, icon, colorClass, bgClass, colSpanClass = ''
}) => (
  <Card className={`border ${colorClass} relative overflow-hidden group transition-all duration-300 hover:shadow-lg ${colSpanClass}`}>
    <div className={`absolute inset-0 opacity-5 bg-gradient-to-br ${bgClass} transition-opacity duration-300 group-hover:opacity-15`} />
    <CardContent className="p-5 relative z-10">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">{label}</span>
        {icon}
      </div>
      <div className="text-3xl font-bold font-mono tracking-tight">{value}</div>
    </CardContent>
  </Card>
);

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
        <StatCard
          label="Total Stacks"
          value={stats.total}
          icon={<Server size={16} className="text-muted-foreground" aria-hidden="true" />}
          colorClass="border-border hover:border-muted-foreground/30"
          bgClass="from-slate-400 to-transparent"
        />
        <StatCard
          label="Synced"
          value={stats.synced}
          icon={<CheckCircle2 size={16} className="text-emerald-500" aria-hidden="true" />}
          colorClass="border-emerald-500/20 hover:border-emerald-500/40"
          bgClass="from-emerald-500 to-transparent"
        />
        <StatCard
          label="Out of Sync"
          value={stats.outOfSync}
          icon={<AlertTriangle size={16} className="text-amber-500" aria-hidden="true" />}
          colorClass="border-amber-500/20 hover:border-amber-500/40"
          bgClass="from-amber-500 to-transparent"
        />
        <StatCard
          label="Deploying"
          value={stats.deploying}
          icon={<Loader2 size={16} className="text-primary animate-spin" aria-hidden="true" />}
          colorClass="border-primary/20 hover:border-primary/40"
          bgClass="from-primary to-transparent"
        />
        <StatCard
          label="Failed"
          value={stats.failed}
          icon={<XCircle size={16} className="text-destructive" aria-hidden="true" />}
          colorClass="border-destructive/20 hover:border-destructive/40"
          bgClass="from-destructive to-transparent"
          colSpanClass="col-span-2 md:col-span-1"
        />
      </div>

      {/* System Resources */}
      <div className="space-y-4 pt-4 border-t border-border">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">System Resources</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {metrics?.total_machines !== undefined && metrics.total_machines > 0 && (
            <StatCard
              label="Machines"
              value={metrics.total_machines}
              icon={<Monitor size={16} className="text-muted-foreground" aria-hidden="true" />}
              colorClass="border-border hover:border-muted-foreground/30"
              bgClass="from-slate-400 to-transparent"
            />
          )}
          <StatCard
            label="Containers"
            value={metrics?.total_containers || 0}
            icon={<Box size={16} className="text-blue-500" aria-hidden="true" />}
            colorClass="border-blue-500/20 hover:border-blue-500/40"
            bgClass="from-blue-500 to-transparent"
          />
          <StatCard
            label="Networks"
            value={metrics?.total_networks || 0}
            icon={<Network size={16} className="text-purple-500" aria-hidden="true" />}
            colorClass="border-purple-500/20 hover:border-purple-500/40"
            bgClass="from-purple-500 to-transparent"
          />
          <StatCard
            label="Volumes"
            value={metrics?.total_volumes || 0}
            icon={<HardDrive size={16} className="text-orange-500" aria-hidden="true" />}
            colorClass="border-orange-500/20 hover:border-orange-500/40"
            bgClass="from-orange-500 to-transparent"
          />
          
          {/* CPU Usage */}
          <Card className="col-span-2 border border-border">
            <CardContent className="p-4 flex flex-col justify-center h-full">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">CPU Usage</span>
                <Activity size={14} className="text-muted-foreground" />
              </div>
              <Progress value={metrics ? Math.min(metrics.cpu_percent || 0, 100) : 0} className="h-2 mb-2" />
              <div className="text-right text-xs font-mono text-muted-foreground">
                {(metrics?.cpu_percent || 0).toFixed(1)}%
              </div>
            </CardContent>
          </Card>

          {/* RAM Usage */}
          <Card className="col-span-2 border border-border">
            <CardContent className="p-4 flex flex-col justify-center h-full">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">RAM Usage</span>
                <HardDrive size={14} className="text-muted-foreground" />
              </div>
              <Progress value={metrics ? Math.min(metrics.ram_percent || 0, 100) : 0} className="h-2 mb-2" />
              <div className="text-right text-xs font-mono text-muted-foreground">
                {(metrics?.ram_percent || 0).toFixed(1)}%
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
