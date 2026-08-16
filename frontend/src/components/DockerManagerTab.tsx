import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Server, Play, Loader2, AlertTriangle, AlertCircle } from 'lucide-react';
import { systemApi} from '../api';
import { DockerStatusResponse } from '../types';;

export const DockerManagerTab: React.FC = () => {
  const queryClient = useQueryClient();
  const [isStarting, setIsStarting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const { data, isLoading } = useQuery<DockerStatusResponse>({
    queryKey: ['docker', 'status'],
    queryFn: () => systemApi.getDockerStatus(),
    refetchInterval: isStarting ? 2000 : 5000,
  });

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => systemApi.getSettings(),
  });
  
  const isDockerActive = settings?.container_engine === 'docker';

  const startMutation = useMutation({
    mutationFn: () => systemApi.startDockerDaemon(),
    onMutate: () => {
      setIsStarting(true);
      setStatusMsg('Launching Docker Desktop... Please wait.');
    },
    onSuccess: (res) => {
      setStatusMsg(res.message);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['docker', 'status'] });
      }, 3000);
    },
    onError: (err: any) => {
      setIsStarting(false);
      setStatusMsg(err.message || 'Failed to start Docker Desktop automatically.');
    },
  });

  if (data?.status === 'online' && isStarting) {
    setIsStarting(false);
    setStatusMsg(null);
  }

  const status = data?.status || 'offline';

  return (
    <div className="flex flex-col h-full">
      {!isDockerActive && (
        <div className="mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={18} />
          <div>
            <h4 className="text-sm font-medium text-amber-300">Docker Engine is not active</h4>
            <p className="text-xs text-amber-400/80 mt-1">Your current container engine is set to Podman. You can view the Docker daemon status, but it will not be used by the control plane unless you switch the active engine in Settings.</p>
          </div>
        </div>
      )}

      <div className="bg-dark-950 border border-slate-800 rounded-2xl w-full shadow-lg flex flex-col flex-1">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Server className="text-brand-400" size={20} />
              Docker System
            </h2>
            <p className="text-sm text-slate-400 mt-1">View local Docker daemon status</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center">
          
          {isLoading && !data ? (
            <div className="flex items-center gap-3 text-slate-400">
              <Loader2 size={24} className="animate-spin text-brand-400" />
              <span>Checking Docker Daemon...</span>
            </div>
          ) : (
            <div className="max-w-md w-full">
              {status === 'online' && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-8 text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                    <Server size={32} className="text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-emerald-300 mb-1">Docker is Online</h3>
                  <p className="text-sm text-emerald-400/80 mb-6">Connected successfully to the local Docker socket.</p>
                  
                  <div className="grid grid-cols-2 gap-4 w-full">
                    <div className="bg-dark-900 border border-emerald-500/20 rounded-lg p-3 text-center">
                      <div className="text-xs text-emerald-500/70 mb-1">Version</div>
                      <div className="text-sm font-mono text-emerald-300">{data?.version || 'Unknown'}</div>
                    </div>
                    <div className="bg-dark-900 border border-emerald-500/20 rounded-lg p-3 text-center">
                      <div className="text-xs text-emerald-500/70 mb-1">Containers</div>
                      <div className="text-sm font-mono text-emerald-300">{data?.containers || 0}</div>
                    </div>
                  </div>
                </div>
              )}

              {status === 'offline' && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-8 text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
                    <Play size={32} className="text-amber-400 fill-amber-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-amber-300 mb-1">Docker is Offline</h3>
                  <p className="text-sm text-amber-400/80 mb-6">The Docker Desktop daemon is not running.</p>
                  
                  <button
                    onClick={() => startMutation.mutate()}
                    disabled={isStarting}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 text-amber-300 transition-all disabled:opacity-50"
                  >
                    {isStarting ? (
                      <>
                        <Loader2 size={16} className="animate-spin text-amber-400" />
                        Starting Docker...
                      </>
                    ) : (
                      <>
                        Launch Docker Desktop
                      </>
                    )}
                  </button>

                  {statusMsg && (
                    <div className="mt-4 p-3 rounded-lg bg-dark-900 border border-amber-500/30 text-xs text-amber-200">
                      {statusMsg}
                    </div>
                  )}
                </div>
              )}

              {status === 'not_installed' && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-8 text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center mb-4">
                    <AlertTriangle size={32} className="text-rose-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-rose-300 mb-1">Docker Not Installed</h3>
                  <p className="text-sm text-rose-400/80 mb-6">The Docker CLI could not be found on your system.</p>
                  
                  <button
                    onClick={() => window.open('https://www.docker.com/products/docker-desktop/', '_blank')}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-rose-500/20 border border-rose-500/40 hover:bg-rose-500/30 text-rose-300 transition-all"
                  >
                    Download Docker Desktop
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
