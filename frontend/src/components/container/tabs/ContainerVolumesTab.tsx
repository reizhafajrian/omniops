import React from 'react';
import { Database, Loader2 } from 'lucide-react';

export interface ContainerVolumesTabProps {
  inspectData: any;
  inspectLoading: boolean;
}

export const ContainerVolumesTab: React.FC<ContainerVolumesTabProps> = ({
  inspectData,
  inspectLoading,
}) => {
  if (inspectLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-600 gap-3">
        <Loader2 size={20} className="animate-spin" /> Loading volumes...
      </div>
    );
  }

  if (!inspectData?.Mounts || inspectData.Mounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-600">
        <Database size={40} className="mb-3 opacity-30" />
        <p className="text-sm">No volumes mounted</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {inspectData.Mounts.map((mount: any, i: number) => (
        <div key={i} className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5 hover:border-white/[0.12] transition-all">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-amber-500/10 rounded-lg">
              <Database size={14} className="text-amber-400" />
            </div>
            <span className="text-sm font-semibold text-slate-300 capitalize">{mount.Type || mount.type || 'volume'}</span>
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-mono ${
              (mount.Mode || mount.mode || 'rw') === 'ro'
                ? 'bg-rose-500/10 text-rose-400'
                : 'bg-emerald-500/10 text-emerald-400'
            }`}>
              {mount.Mode || mount.mode || 'rw'}
            </span>
          </div>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex gap-2">
              <span className="text-slate-600 shrink-0 w-20">Host</span>
              <span className="text-slate-300 break-all">{mount.Source || mount.source}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-slate-600 shrink-0 w-20">Container</span>
              <span className="text-slate-300 break-all">{mount.Destination || mount.destination}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
