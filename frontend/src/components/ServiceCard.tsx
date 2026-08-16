import React from 'react';
import { Card, CardHeader, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Cpu, HardDrive, Layers, Network, Info, Play, Square, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { MetricCard } from './MetricCard';
import {  containersApi} from '../api';
import { ServiceInfo } from '../types';;
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SERVICES_QUERY_KEY } from '../hooks/useStacks';

interface ServiceCardProps {
  svc: ServiceInfo;
  stackId?: string;
  onActionSuccess?: () => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ svc, stackId, onActionSuccess }) => {
  const queryClient = useQueryClient();

  const handleSuccess = () => {
    if (stackId) {
      queryClient.invalidateQueries({ queryKey: SERVICES_QUERY_KEY(stackId) });
    }
    if (onActionSuccess) {
      onActionSuccess();
    }
  };

  const startMutation = useMutation({
    mutationFn: () => containersApi.startContainer(svc.container_id),
    onSuccess: handleSuccess,
  });

  const stopMutation = useMutation({
    mutationFn: () => containersApi.stopContainer(svc.container_id),
    onSuccess: handleSuccess,
  });

  const restartMutation = useMutation({
    mutationFn: () => containersApi.restartContainer(svc.container_id),
    onSuccess: handleSuccess,
  });

  const deleteMutation = useMutation({
    mutationFn: () => containersApi.deleteContainer(svc.container_id),
    onSuccess: handleSuccess,
  });

  const isRunning = svc.status.toLowerCase().startsWith('up') || svc.status.toLowerCase() === 'running';

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2.5 h-2.5 rounded-full animate-pulse shrink-0 ${isRunning ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <h4 className="font-bold text-foreground font-mono truncate">{svc.service || svc.name}</h4>
          </div>
          <p className="text-xs font-mono text-muted-foreground">Container: {svc.name}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className={`text-[10px] font-mono px-3 py-1 rounded-md border ${isRunning ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-rose-500/10 border-rose-500/30 text-rose-500'}`}>
            {svc.status}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          <MetricCard
            title="CPU Usage"
            value={svc.cpu_perc || '0.00%'}
            icon={<Cpu size={20} />}
            iconBgClass="bg-blue-500/10"
            iconColorClass="text-blue-400"
            showProgress={true}
            progressValue={svc.cpu_perc ? parseFloat(svc.cpu_perc) : 0}
            progressColorClass="bg-blue-400"
            className="p-3 bg-background border rounded-lg shadow-none"
          />
          <MetricCard
            title="RAM Usage"
            value={svc.mem_usage || '0B'}
            icon={<HardDrive size={20} />}
            iconBgClass="bg-emerald-500/10"
            iconColorClass="text-emerald-400"
            showProgress={true}
            progressValue={svc.mem_perc ? parseFloat(svc.mem_perc) : 0}
            progressText={`${svc.mem_perc || '0.00%'}`}
            progressColorClass="bg-emerald-500"
            className="p-3 bg-background border rounded-lg shadow-none"
          />
        </div>

        <div className="text-xs font-mono bg-indigo-500/5 border-indigo-500/30 text-indigo-300 px-4 py-3 rounded-lg flex justify-between items-center border">
          <span className="font-semibold text-indigo-400">Ports:</span>
          <span className="truncate ml-4">{svc.ports || 'None'}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-lg bg-background border text-xs font-mono flex flex-col gap-3">
            <div className="flex items-center gap-2 text-amber-500 font-semibold">
              <Layers size={14} /> Volumes
            </div>
            {svc.volumes && svc.volumes.length > 0 ? (
              <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                {svc.volumes.map((vol, i) => (
                  <div key={i} className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-1.5 rounded truncate border" title={vol}>{vol}</div>
                ))}
              </div>
            ) : <p className="text-[10px] text-muted-foreground italic mt-auto">No volumes</p>}
          </div>
          <div className="p-4 rounded-lg bg-background border text-xs font-mono flex flex-col gap-3">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold">
              <Network size={14} /> Networks
            </div>
            {svc.networks && svc.networks.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {svc.networks.map((net, i) => (
                  <span key={i} className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-1.5 rounded max-w-full truncate">{net}</span>
                ))}
              </div>
            ) : <p className="text-[10px] text-muted-foreground italic mt-auto">Default</p>}
          </div>
        </div>

        <div className="mt-auto pt-4 flex gap-2">
          {!isRunning ? (
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20 hover:text-emerald-400"
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending || stopMutation.isPending || restartMutation.isPending || deleteMutation.isPending}
              title="Start Container"
            >
              {startMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 bg-rose-500/10 text-rose-500 border-rose-500/30 hover:bg-rose-500/20 hover:text-rose-400"
              onClick={() => stopMutation.mutate()}
              disabled={startMutation.isPending || stopMutation.isPending || restartMutation.isPending || deleteMutation.isPending}
              title="Stop Container"
            >
              {stopMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} />}
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="shrink-0 bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20 hover:text-amber-400"
            onClick={() => restartMutation.mutate()}
            disabled={startMutation.isPending || stopMutation.isPending || restartMutation.isPending || deleteMutation.isPending}
            title="Restart Container"
          >
            {restartMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0 bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20 hover:text-red-400"
            onClick={() => {
              if (window.confirm(`Are you sure you want to remove container ${svc.name}?`)) {
                deleteMutation.mutate();
              }
            }}
            disabled={startMutation.isPending || stopMutation.isPending || restartMutation.isPending || deleteMutation.isPending}
            title="Delete Container"
          >
            {deleteMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </Button>
          <Button 
            variant="secondary" 
            className="flex-1 gap-2 bg-background border shadow-sm hover:bg-muted transition-colors text-muted-foreground" 
            onClick={() => window.location.hash = `#/machines/podman-machine-default/containers/${svc.container_id}`}
          >
            <Info size={14} /> View Container Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
