import React from 'react';
import { Box, Layers, PlayCircle, StopCircle, Terminal } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ProjectCardProps {
  projectName: string;
  containerCount: number;
  runningCount: number;
  onSelect: (projectName: string) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  projectName,
  containerCount,
  runningCount,
  onSelect,
}) => {
  const isStandalone = projectName === 'Standalone';
  const hasRunning = runningCount > 0;

  return (
    <Card 
      className="group relative h-full flex flex-col overflow-hidden bg-gradient-to-br from-card to-card/50 border-white/5 shadow-lg transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 cursor-pointer"
      onClick={() => onSelect(projectName)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(projectName);
        }
      }}
    >
      {/* Animated glow background on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Top Border Accent */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] w-full ${hasRunning ? 'bg-gradient-to-r from-emerald-500/50 via-emerald-400 to-transparent' : 'bg-gradient-to-r from-slate-500/50 to-transparent'}`} />

      <CardHeader className="pb-3 relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <div className={`p-1.5 rounded-md ${isStandalone ? 'bg-slate-500/10' : 'bg-primary/10'}`}>
                {isStandalone ? (
                  <Box className="text-slate-400 shrink-0" size={16} />
                ) : (
                  <Layers className="text-primary shrink-0" size={16} />
                )}
              </div>
              <h3 className="text-base font-semibold tracking-tight text-slate-100 truncate">{projectName}</h3>
            </div>
            <p className="text-xs text-slate-400 font-mono truncate">
              {isStandalone ? 'Unmanaged containers' : 'Manual Compose Project'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shadow-inner ${
              hasRunning
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-emerald-500/20' 
                : 'bg-slate-500/10 text-slate-400 border border-slate-500/30'
            }`}>
              {hasRunning ? 'Running' : 'Stopped'}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col flex-1 gap-4 relative z-10">
        {/* Container Stats */}
        <div className="grid grid-cols-2 gap-3 text-xs font-mono mt-2">
          <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-black/20 border border-white/5 backdrop-blur-md min-w-0 transition-colors group-hover:bg-black/30 group-hover:border-white/10">
            <span className="text-slate-500 font-medium">Total</span>
            <div className="flex items-center gap-1.5">
              <Box size={14} className="text-primary/70 shrink-0" aria-hidden="true" />
              <span className="text-slate-200 text-sm">{containerCount}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-black/20 border border-white/5 backdrop-blur-md min-w-0 transition-colors group-hover:bg-black/30 group-hover:border-white/10">
            <span className="text-slate-500 font-medium">Running</span>
            <div className="flex items-center gap-1.5">
              {hasRunning ? (
                <PlayCircle size={14} className="text-emerald-400 shrink-0" aria-hidden="true" />
              ) : (
                <StopCircle size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
              )}
              <span className="text-slate-200 text-sm">{runningCount}</span>
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div 
          className="mt-auto pt-4 flex items-center justify-between gap-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5 w-full">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onSelect(projectName)}
              className="gap-2 text-xs w-full bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 transition-all duration-300 group-hover:border-primary/30 group-hover:text-white"
            >
              <Terminal size={14} className="text-primary/70 group-hover:text-primary transition-colors" aria-hidden="true" />
              Manage Containers
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
