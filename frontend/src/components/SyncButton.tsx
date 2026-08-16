import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useSyncStack } from '../hooks/useStacks';
import { DeploymentState } from '../types';
import { clsx } from 'clsx';

interface SyncButtonProps {
  stackId: string;
  currentState: DeploymentState;
  className?: string;
  size?: 'sm' | 'md';
  label?: string;
}

export const SyncButton: React.FC<SyncButtonProps> = ({
  stackId,
  currentState,
  className,
  size = 'md',
  label = 'Sync Now',
}) => {
  const syncMutation = useSyncStack();

  const isDeploying = currentState === 'deploying';
  const isDisabled = isDeploying || syncMutation.isPending;

  const handleSync = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDisabled) {
      syncMutation.mutate(stackId);
    }
  };

  const buttonSize = {
    sm: 'px-2.5 py-1 text-xs gap-1.5',
    md: 'px-3 py-1.5 text-xs font-medium gap-2',
  }[size];

  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={isDisabled}
      title={isDeploying ? 'Reconciliation already in progress' : 'Trigger manual git pull & compose apply'}
      className={clsx(
        'inline-flex items-center justify-center rounded-lg border transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50',
        isDisabled
          ? 'bg-slate-800/50 text-slate-500 border-slate-700/50 cursor-not-allowed opacity-60'
          : 'bg-brand-600/20 text-brand-300 border-brand-500/40 hover:bg-brand-600/30 hover:border-brand-500/60 active:scale-95',
        buttonSize,
        className
      )}
    >
      <RefreshCw
        size={size === 'sm' ? 12 : 14}
        className={clsx(
          (syncMutation.isPending || isDeploying) && 'animate-spin text-brand-400'
        )}
      />
      <span>{syncMutation.isPending ? 'Syncing...' : isDeploying ? 'Syncing...' : label}</span>
    </button>
  );
};
