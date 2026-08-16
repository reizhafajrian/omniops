import React, { useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Loader2, RefreshCw, RotateCcw, Square, AlertOctagon, Trash2, Check, X } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCleanStack, useStopStack, usePruneSystem, useSyncStack, useRollbackStack } from '@/hooks/useStacks';

interface StackHeaderActionsProps {
  stackId: string;
  state: string;
  servicesLength: number;
  lastKnownGoodCommit?: string | null;
}

export const StackHeaderActions: React.FC<StackHeaderActionsProps> = ({
  stackId,
  state,
  servicesLength,
  lastKnownGoodCommit
}) => {
  const cleanMutation = useCleanStack();
  const stopMutation = useStopStack();
  const pruneMutation = usePruneSystem();
  const syncMutation = useSyncStack();
  const rollbackMutation = useRollbackStack();

  const [actionMsg, setActionMsg] = useState<string | null>(null);
  
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

  const confirmAction = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm });
  };

  const handleSyncStack = () => {
    if (state !== 'deploying' && !syncMutation.isPending) {
      syncMutation.mutate(stackId);
    }
  };

  const handleRollbackStack = () => {
    if (state !== 'deploying' && lastKnownGoodCommit && !rollbackMutation.isPending) {
      confirmAction(
        'Rollback Stack',
        `Re-apply last known-good commit (${lastKnownGoodCommit.slice(0, 7)}) for stack '${stackId}'?`,
        () => rollbackMutation.mutate(stackId)
      );
    }
  };

  const handleCleanVolumes = () => {
    confirmAction(
      'Clean Volumes',
      `Are you sure you want to clean containers, networks, and persistent volumes for stack '${stackId}'?\n\nThis runs 'docker compose down -v' and will permanently remove container volumes.`,
      () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        cleanMutation.mutate(stackId, {
          onSuccess: () => {
            setActionMsg('Containers, networks, and persistent volumes purged successfully!');
            setTimeout(() => setActionMsg(null), 4000);
          },
        });
      }
    );
  };

  const handlePruneSystem = () => {
    confirmAction(
      'Prune System',
      `Are you sure you want to prune all unused Docker volumes and networks system-wide?`,
      () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        pruneMutation.mutate(undefined, {
          onSuccess: () => {
            setActionMsg('System volume and network prune completed!');
            setTimeout(() => setActionMsg(null), 4000);
          },
        });
      }
    );
  };

  const handleStopStack = () => {
    confirmAction(
      'Stop Stack',
      `Are you sure you want to stop all containers for stack '${stackId}'?\n\nThis will safely stop the containers, keeping them and your persistent volumes intact.`,
      () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        stopMutation.mutate(stackId, {
          onSuccess: () => {
            setActionMsg('Stack containers stopped successfully!');
            setTimeout(() => setActionMsg(null), 4000);
          },
        });
      }
    );
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

      {actionMsg && (
        <div className="absolute top-20 right-4 z-50 shadow-lg">
          <Alert className="bg-emerald-500 text-white border-none w-auto pr-8">
            <Check className="h-4 w-4 text-white" />
            <AlertDescription className="flex items-center justify-between">
              {actionMsg}
              <button onClick={() => setActionMsg(null)} className="absolute right-3 opacity-80 hover:opacity-100">
                <X size={16} />
              </button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 w-8 text-muted-foreground border-dashed">
          <MoreHorizontal size={14} />
          <span className="sr-only">More actions</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem 
            onClick={handleSyncStack}
            disabled={state === 'deploying' || syncMutation.isPending}
            className="text-brand-500 focus:text-brand-500 focus:bg-brand-500/10"
          >
            {syncMutation.isPending || state === 'deploying' ? <Loader2 size={14} className="mr-2 animate-spin" /> : <RefreshCw size={14} className="mr-2" />}
            {servicesLength === 0 ? "Resume / Sync" : "Sync Now"}
          </DropdownMenuItem>

          <DropdownMenuItem 
            onClick={handleRollbackStack}
            disabled={state === 'deploying' || !lastKnownGoodCommit || rollbackMutation.isPending}
            className="text-amber-500 focus:text-amber-500 focus:bg-amber-500/10"
          >
            {rollbackMutation.isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : <RotateCcw size={14} className="mr-2" />}
            Rollback
          </DropdownMenuItem>

          {servicesLength > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={handleStopStack} 
                disabled={stopMutation.isPending}
              >
                {stopMutation.isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Square size={14} className="mr-2 text-muted-foreground" />}
                Stop Stack
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={handlePruneSystem} 
            disabled={pruneMutation.isPending}
            className="text-amber-500 focus:text-amber-500 focus:bg-amber-500/10"
          >
            {pruneMutation.isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : <AlertOctagon size={14} className="mr-2" />}
            Prune System
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={handleCleanVolumes} 
            disabled={cleanMutation.isPending}
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
          >
            {cleanMutation.isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Trash2 size={14} className="mr-2" />}
            Clean Stack & Volumes
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
