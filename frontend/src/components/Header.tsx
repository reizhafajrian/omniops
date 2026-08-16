import React from 'react';
import { Layers, RefreshCw, Cpu, LogOut, Plus } from 'lucide-react';
import { DockerDaemonStatus } from './DockerDaemonStatus';

interface HeaderProps {
  onRefresh: () => void;
  isRefetching: boolean;
  onLogout?: () => void;
  onAddStack?: () => void;
  onNavigateToEngine?: (engine: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onRefresh, isRefetching, onLogout, onAddStack, onNavigateToEngine }) => {
  return (
    <header className="sticky top-0 z-40 glass-panel border-b border-slate-800/80 bg-dark-950/80 backdrop-blur-md px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-700 text-white shadow-lg shadow-brand-500/20">
            <Layers size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white font-sans">
                OmniOps
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-brand-500/10 border border-brand-500/30 text-brand-300">
                Control Plane
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Self-Hosted OmniOps Control Plane for Docker Compose Stacks
            </p>
          </div>

          {/* Daemon Status Live Monitor */}
          <div className="hidden sm:block ml-2 border-l border-slate-800 pl-4">
            <DockerDaemonStatus onNavigateToEngine={onNavigateToEngine} />
          </div>
        </div>

        {/* Right Action Toolbar */}
        <div className="flex items-center gap-3">
          {/* Add Stack Button */}
          {onAddStack && (
            <button
              onClick={onAddStack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-600/20 transition-all active:scale-95"
            >
              <Plus size={14} />
              <span>Add Stack</span>
            </button>
          )}

          {/* Server Refresh Indicator */}
          <button
            onClick={onRefresh}
            disabled={isRefetching}
            className="p-2 rounded-lg bg-dark-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors"
            title="Refresh stack states"
          >
            <RefreshCw size={15} className={isRefetching ? 'animate-spin text-brand-400' : ''} />
          </button>

          {/* Global Settings Button */}
          <button
            onClick={() => { window.location.hash = '#/settings'; }}
            className="p-2 rounded-lg bg-dark-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
            title="Global Settings"
          >
            <Cpu size={15} />
          </button>

          {/* Logout Button */}
          {onLogout && (
            <button
              onClick={onLogout}
              className="p-2 rounded-lg bg-dark-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition-colors"
              title="Log Out of Control Plane"
            >
              <LogOut size={15} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

