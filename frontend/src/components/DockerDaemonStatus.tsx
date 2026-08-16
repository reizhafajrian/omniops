import React from 'react';
import { systemApi} from '../api';
import { DockerStatusResponse, AppSettings } from '../types';;
import { useQuery } from '@tanstack/react-query';
import { Server, Play, Loader2, AlertTriangle, Settings } from 'lucide-react';

interface DockerDaemonStatusProps {
  onNavigateToEngine?: (engine: string) => void;
}

export const DockerDaemonStatus: React.FC<DockerDaemonStatusProps> = ({ onNavigateToEngine }) => {
  const { data: settings } = useQuery<AppSettings>({
    queryKey: ['settings'],
    queryFn: () => systemApi.getSettings(),
  });

  const isPodman = settings?.container_engine === 'podman';
  const engineName = isPodman ? 'Podman' : 'Docker';

  const { data, isLoading } = useQuery<DockerStatusResponse>({
    queryKey: ['docker', 'status'],
    queryFn: () => systemApi.getDockerStatus(),
    refetchInterval: 5000,
  });

  if (isLoading && !data) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-dark-950 border border-slate-800 text-slate-400">
        <Loader2 size={12} className="animate-spin text-brand-400" />
        <span>Checking {engineName}...</span>
      </div>
    );
  }

  const status = data?.status || 'offline';

  const handleOfflineClick = () => {
    if (onNavigateToEngine) {
      onNavigateToEngine(isPodman ? 'podman' : 'docker');
    }
  };

  if (status === 'online') {
    return (
      <>
        <button
          onClick={() => onNavigateToEngine && onNavigateToEngine(isPodman ? 'podman' : 'docker')}
          title={`${engineName} Daemon is online. Version: ${data?.version || 'Unknown'}, Running Containers: ${data?.containers || 0}`}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium shadow-sm border transition-colors ${
            isPodman 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 cursor-pointer' 
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 cursor-pointer'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <Server size={13} className="text-emerald-400 shrink-0" />
          <span>{engineName}: Online</span>
          {data?.version && <span className="text-[10px] text-emerald-400/80">({data.version})</span>}
        </button>
      </>
    );
  }

  if (status === 'offline') {
    return (
      <div className="relative inline-flex items-center gap-2">
        <button
          onClick={handleOfflineClick}
          title={`${engineName} daemon is currently stopped. Click to manage!`}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 shadow-sm transition-all"
        >
          {isPodman ? <Settings size={12} className="text-amber-400 shrink-0" /> : <Play size={12} className="text-amber-400 fill-amber-400 shrink-0" />}
          <span>{engineName}: Stopped (Click to Manage)</span>
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => window.open(isPodman ? 'https://podman-desktop.io/' : 'https://www.docker.com/products/docker-desktop/', '_blank')}
      title={`${engineName} CLI is not detected on your machine. Click to download.`}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-rose-500/10 border border-rose-500/30 text-rose-300 shadow-sm cursor-pointer hover:bg-rose-500/20 transition-all"
    >
      <AlertTriangle size={13} className="text-rose-400 shrink-0" />
      <span>{engineName}: Not Installed</span>
    </div>
  );
};
