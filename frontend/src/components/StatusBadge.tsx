import React from 'react';
import { DeploymentState } from '../types';
import { CheckCircle2, AlertTriangle, Loader2, XCircle, HelpCircle } from 'lucide-react';
import { clsx } from 'clsx';

interface StatusBadgeProps {
  state: DeploymentState;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  state,
  size = 'md',
  showLabel = true,
}) => {
  const getConfig = () => {
    switch (state) {
      case 'synced':
        return {
          label: 'Synced',
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          icon: CheckCircle2,
          spin: false,
        };
      case 'out_of_sync':
        return {
          label: 'Out of Sync',
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          icon: AlertTriangle,
          spin: false,
        };
      case 'deploying':
        return {
          label: 'Deploying',
          bg: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
          icon: Loader2,
          spin: true,
        };
      case 'failed':
        return {
          label: 'Failed',
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          icon: XCircle,
          spin: false,
        };
      default:
        return {
          label: 'Unknown',
          bg: 'bg-slate-500/10 border-slate-500/30 text-slate-400',
          icon: HelpCircle,
          spin: false,
        };
    }
  };

  const config = getConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-xs font-medium gap-1.5',
    lg: 'px-3 py-1.5 text-sm font-semibold gap-2',
  }[size];

  const iconSize = {
    sm: 12,
    md: 14,
    lg: 16,
  }[size];

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border transition-all duration-200 shrink-0 whitespace-nowrap',
        config.bg,
        sizeClasses
      )}
    >
      <Icon
        size={iconSize}
        className={clsx(config.spin && 'animate-spin', 'shrink-0')}
      />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
};
