import React, { useState } from 'react';
import { Stack } from '../types';
import { StatusBadge } from './StatusBadge';
import { PollCountdown } from './PollCountdown';
import { SyncButton } from './SyncButton';
import { RollbackButton } from './RollbackButton';
import { SecurityPinModal } from './SecurityPinModal';
import { useDeleteStack } from '../hooks/useStacks';
import { GitBranch, GitCommit, FileCode, Clock, ShieldCheck, Terminal, Trash2, AlertTriangle, Lock, Loader2, Server } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface StackCardProps {
  stack: Stack;
  onSelect: (stack: Stack) => void;
}

const CommitHashPill: React.FC<{ hash: string | null | undefined; variant?: 'default' | 'good' }> = ({
  hash,
  variant = 'default',
}) => (
  <span
    className={cn(
      'font-mono px-2 py-0.5 rounded text-xs border',
      hash
        ? variant === 'good'
          ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
          : 'bg-secondary border-border text-foreground'
        : 'bg-muted border-border text-muted-foreground'
    )}
  >
    {hash ? hash.slice(0, 7) : 'None'}
  </span>
);

export const StackCard: React.FC<StackCardProps> = ({ stack, onSelect }) => {
  const { config, state, last_synced_commit, last_known_good_commit, last_updated_at } = stack;
  const deleteMutation = useDeleteStack();
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const handleCardClick = () => {
    const isUnlocked = sessionStorage.getItem(`stack_unlocked_${config.id}`) === 'true';
    if (config.is_protected && !isUnlocked) {
      setIsPinModalOpen(true);
    } else {
      onSelect(stack);
    }
  };

  return (
    <>
      <SecurityPinModal
        isOpen={isPinModalOpen}
        stackId={config.id}
        stackName={config.id}
        onClose={() => setIsPinModalOpen(false)}
        onUnlockSuccess={() => {
          setIsPinModalOpen(false);
          onSelect(stack);
        }}
      />

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-destructive" aria-hidden="true" />
              Delete Stack
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove stack <strong>&apos;{config.id}&apos;</strong>?
              If running, containers will be stopped and cleaned up in the background.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setIsDeleteConfirmOpen(false);
                deleteMutation.mutate(config.id);
              }}
            >
              Delete Stack
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card 
        className="flex flex-col h-full transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 relative group bg-card hover:bg-muted/10 cursor-pointer"
        onClick={handleCardClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCardClick();
          }
        }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3 w-full min-w-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="text-sm font-semibold tracking-tight truncate">{config.id}</h3>
                {config.is_protected && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className="border-amber-500/30 text-amber-300 bg-amber-500/10 animate-pulse shrink-0 gap-1">
                        <Lock size={9} aria-hidden="true" />
                        Sensitive
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>Security PIN required to access</TooltipContent>
                  </Tooltip>
                )}
                {config.auth && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="outline" className="border-primary/20 text-primary/80 bg-primary/5 shrink-0 gap-1">
                        <ShieldCheck size={9} aria-hidden="true" />
                        Private
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>Repository authentication configured</TooltipContent>
                  </Tooltip>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono truncate" title={config.repo_url}>
                {config.repo_url}
              </p>
            </div>

            <div className="flex items-center flex-wrap sm:flex-nowrap gap-2 justify-end shrink-0">
              {config.sync_mode !== 'webhook' && config.poll_interval_secs > 0 && (
                <PollCountdown 
                  intervalSecs={config.poll_interval_secs} 
                  size="sm" 
                  isPaused={state === 'stopped'} 
                />
              )}
              <StatusBadge state={state} size="md" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col flex-1 gap-4">
          {/* Config Pills */}
          <div className="flex flex-wrap gap-2 text-xs font-mono">
            <div className="flex-1 min-w-[120px] flex items-center gap-1.5 p-2 rounded-lg bg-muted/30 border border-border/50 text-muted-foreground transition-colors group-hover:bg-muted/50">
              <Server size={12} className="text-primary/70 shrink-0" aria-hidden="true" />
              <span className="truncate" title={config.machine_name || 'Default Machine'}>
                {config.machine_name || 'Default'}
              </span>
            </div>
            <div className="flex-1 min-w-[100px] flex items-center gap-1.5 p-2 rounded-lg bg-muted/30 border border-border/50 text-muted-foreground transition-colors group-hover:bg-muted/50">
              <GitBranch size={12} className="text-primary shrink-0" aria-hidden="true" />
              <span className="truncate">{config.branch}</span>
            </div>
            <div className="flex-1 min-w-[100px] flex items-center gap-1.5 p-2 rounded-lg bg-muted/30 border border-border/50 text-muted-foreground transition-colors group-hover:bg-muted/50">
              <FileCode size={12} className="text-primary/70 shrink-0" aria-hidden="true" />
              <span className="truncate" title={config.compose_path}>
                {config.compose_path.split('/').pop()}
              </span>
            </div>
          </div>

          {/* Commit Metadata */}
          <div className="space-y-2">
            <Separator />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <GitCommit size={12} aria-hidden="true" /> Last Synced:
              </span>
              <CommitHashPill hash={last_synced_commit} />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ShieldCheck size={12} className="text-emerald-500" aria-hidden="true" /> Known Good:
              </span>
              <CommitHashPill hash={last_known_good_commit} variant="good" />
            </div>
            {last_updated_at && (
              <div className="flex items-center justify-between text-[11px] text-muted-foreground/60 pt-1">
                <span className="flex items-center gap-1">
                  <Clock size={10} aria-hidden="true" /> Updated:
                </span>
                <span>{new Date(last_updated_at).toLocaleTimeString()}</span>
              </div>
            )}
          </div>

          {/* Failed Banner */}
          {state === 'failed' && (
            <Alert variant="destructive" className="py-2.5 bg-destructive/10 border-destructive/20 text-destructive-foreground">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription className="text-xs ml-1">
                <strong>Deployment Failed.</strong> Check the Audit Log for details.
              </AlertDescription>
            </Alert>
          )}

          {/* Actions Footer */}
          <div 
            className="mt-auto pt-2 border-t border-border flex items-center justify-between gap-2"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCardClick}
                className="gap-1.5 text-xs"
              >
                <Terminal size={12} className="text-primary" aria-hidden="true" />
                Details &amp; Shell
              </Button>
              <Tooltip>
                <TooltipTrigger
                  className={buttonVariants({ variant: "outline", size: "sm" }) + " w-8 h-8 p-0 hover:border-destructive/40 hover:text-destructive hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-destructive/50"}
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  disabled={deleteMutation.isPending}
                  aria-label={`Delete stack ${config.id}`}
                >
                  {deleteMutation.isPending
                    ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                    : <Trash2 size={13} aria-hidden="true" />
                  }
                </TooltipTrigger>
                <TooltipContent>Delete stack &amp; clean up containers</TooltipContent>
              </Tooltip>
            </div>

            <div className="flex items-center gap-2">
              <RollbackButton
                stackId={config.id}
                currentState={state}
                lastKnownGoodCommit={last_known_good_commit}
                size="sm"
              />
              <SyncButton stackId={config.id} currentState={state} size="sm" />
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};
