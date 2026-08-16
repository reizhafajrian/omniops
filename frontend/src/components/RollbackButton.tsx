import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useRollbackStack } from '../hooks/useStacks';
import { DeploymentState } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { clsx } from 'clsx';

interface RollbackButtonProps {
  stackId: string;
  currentState: DeploymentState;
  lastKnownGoodCommit: string | null;
  className?: string;
  size?: 'sm' | 'md';
}

export const RollbackButton: React.FC<RollbackButtonProps> = ({
  stackId,
  currentState,
  lastKnownGoodCommit,
  className,
  size = 'md',
}) => {
  const rollbackMutation = useRollbackStack();
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const isDeploying = currentState === 'deploying';
  const hasNoGoodCommit = !lastKnownGoodCommit;
  const isDisabled = isDeploying || hasNoGoodCommit || rollbackMutation.isPending;

  const handleRollback = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDisabled) {
      setConfirmModal({
        isOpen: true,
        title: 'Rollback Stack',
        message: `Re-apply last known-good commit (${lastKnownGoodCommit?.slice(0, 7)}) for stack '${stackId}'?`,
        onConfirm: () => {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
          rollbackMutation.mutate(stackId);
        }
      });
    }
  };

  const buttonSize = {
    sm: 'px-2.5 py-1 text-xs gap-1.5',
    md: 'px-3 py-1.5 text-xs font-medium gap-2',
  }[size];

  const getTooltip = () => {
    if (isDeploying) return 'Cannot rollback while deployment is in flight';
    if (hasNoGoodCommit) return 'No previous known-good commit recorded yet';
    return `Rollback to commit ${lastKnownGoodCommit?.slice(0, 7)}`;
  };

  return (
    <>
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
      <button
      type="button"
      onClick={handleRollback}
      disabled={isDisabled}
      title={getTooltip()}
      className={clsx(
        'inline-flex items-center justify-center rounded-lg border transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50',
        isDisabled
          ? 'bg-slate-800/50 text-slate-500 border-slate-700/50 cursor-not-allowed opacity-60'
          : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-500/50 active:scale-95',
        buttonSize,
        className
      )}
    >
      <RotateCcw
        size={size === 'sm' ? 12 : 14}
        className={clsx(rollbackMutation.isPending && 'animate-spin')}
      />
      <span>{rollbackMutation.isPending ? 'Rolling back...' : 'Rollback'}</span>
    </button>
    </>
  );
};
