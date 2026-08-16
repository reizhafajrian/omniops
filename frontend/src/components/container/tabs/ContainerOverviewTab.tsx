import React from 'react';
import { Cpu, HardDrive, Network, Database, Info, ChevronRight, Loader2 } from 'lucide-react';
import { RadialGauge } from '../RadialGauge';
import { InfoRow } from '../InfoRow';

export interface ContainerOverviewTabProps {
  containerId: string;
  cpuPct: number | null;
  memPct: number | null;
  stats: any;
  statsLoading: boolean;
  inspectData: any;
  inspectLoading: boolean;
}

export const ContainerOverviewTab: React.FC<ContainerOverviewTabProps> = ({
  containerId,
  cpuPct,
  memPct,
  stats,
  statsLoading,
  inspectData,
  inspectLoading,
}) => {
  return (
    <div className="space-y-6">
      {/* Radial Gauges */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <ActivityIcon /> Live Metrics
          <span className="ml-auto text-xs text-slate-600 font-normal normal-case">Refreshes every 3s</span>
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <RadialGauge
            percent={cpuPct}
            label="CPU Usage"
            value={stats?.cpu_percent || ''}
            color="#6366f1"
            icon={<Cpu size={13} />}
            loading={statsLoading}
          />
          <RadialGauge
            percent={memPct}
            label="Memory"
            value={stats?.mem_usage || ''}
            color="#0ea5e9"
            icon={<HardDrive size={13} />}
            loading={statsLoading}
          />
          <div className="relative flex flex-col items-center justify-center gap-2 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
            <div className="p-3 rounded-xl bg-violet-500/10">
              <Network size={22} className="text-violet-400" />
            </div>
            <div className="text-xs text-slate-500 font-medium">Network I/O</div>
            {statsLoading ? (
              <div className="h-4 w-24 bg-slate-800 animate-pulse rounded" />
            ) : (
              <div className="text-xs text-slate-300 font-mono text-center">{stats?.net_io || '—'}</div>
            )}
          </div>
          <div className="relative flex flex-col items-center justify-center gap-2 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
            <div className="p-3 rounded-xl bg-amber-500/10">
              <Database size={22} className="text-amber-400" />
            </div>
            <div className="text-xs text-slate-500 font-medium">Block I/O</div>
            {statsLoading ? (
              <div className="h-4 w-24 bg-slate-800 animate-pulse rounded" />
            ) : (
              <div className="text-xs text-slate-300 font-mono text-center">{stats?.block_io || '—'}</div>
            )}
          </div>
        </div>
      </div>

      {/* Inspect Details */}
      {inspectLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-600 gap-3">
          <Loader2 size={20} className="animate-spin" /> Loading container details...
        </div>
      ) : inspectData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Container Info */}
          <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Info size={14} className="text-indigo-400" /> Container Info
            </h3>
            <div className="space-y-0">
              <InfoRow label="ID" value={containerId.substring(0, 20) + '...'} mono />
              <InfoRow label="Image" value={inspectData.Config?.Image || inspectData.ImageName} mono />
              <InfoRow label="Status" value={inspectData.State?.Status} />
              <InfoRow label="Platform" value={inspectData.Platform} />
              <InfoRow label="Driver" value={inspectData.Driver} />
              {inspectData.Config?.Cmd && (
                <InfoRow label="Command" value={inspectData.Config.Cmd.join(' ')} mono />
              )}
            </div>
          </div>

          {/* Port Mappings */}
          <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Network size={14} className="text-violet-400" /> Port Mappings
            </h3>
            {inspectData.HostConfig?.PortBindings && Object.keys(inspectData.HostConfig.PortBindings).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(inspectData.HostConfig.PortBindings as Record<string, any[]>).map(([containerPort, bindings]) => (
                  <div key={containerPort} className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2">
                    <span className="font-mono text-sm text-indigo-300">{containerPort}</span>
                    <ChevronRight size={14} className="text-slate-600" />
                    <span className="font-mono text-sm text-slate-300">
                      {bindings?.map((b: any) => `${b.HostIp || '0.0.0.0'}:${b.HostPort}`).join(', ') || '—'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-slate-600">
                <Network size={28} className="mb-2 opacity-30" />
                <span className="text-sm">No ports exposed</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ActivityIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);
