import React, { useState } from 'react';
import { useStacks, useStackHistory, useStackServices, useStackCompose } from '../hooks/useStacks';
import { StatusBadge } from '../components/StatusBadge';
import { PollCountdown } from '../components/PollCountdown';
import { AppShell } from '../components/AppShell';
import { StackMetadataCard } from '@/components/stack/StackMetadataCard';
import { Server, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BackButton } from '../components/BackButton';
import { StackHeaderActions } from '@/components/stack/StackHeaderActions';
import { StackTabs } from '@/components/stack/StackTabs';
import { StackLimitsModal } from '@/components/stack/StackLimitsModal';

interface StackDetailPageProps {
  stackId: string;
  onBack: () => void;
  onLogout?: () => void;
}

export const StackDetailPage: React.FC<StackDetailPageProps> = ({
  stackId,
  onBack,
  onLogout,
}) => {
  const { data: stacks = [], isLoading: isStacksLoading, refetch } = useStacks(3000);
  const stack = stacks.find((s) => s.config.id === stackId);

  const getTabFromHash = () => {
    const hashSplit = window.location.hash.split('?');
    if (hashSplit.length > 1) {
      const params = new URLSearchParams(hashSplit[1]);
      const tab = params.get('tab');
      if (['services', 'topology', 'compose', 'logs', 'exec', 'history', 'edit'].includes(tab || '')) {
        return tab as 'services' | 'topology' | 'compose' | 'logs' | 'exec' | 'history' | 'edit';
      }
    }
    return 'services';
  };

  const [activeTab, setActiveTab] = useState<'services' | 'topology' | 'compose' | 'logs' | 'exec' | 'history' | 'edit'>(getTabFromHash());

  const handleTabChange = (tab: string) => {
    const typedTab = tab as 'services' | 'topology' | 'compose' | 'logs' | 'exec' | 'history' | 'edit';
    setActiveTab(typedTab);
    const hashPath = window.location.hash.split('?')[0];
    window.history.replaceState(null, '', `${hashPath}?tab=${tab}`);
  };

  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [execService, setExecService] = useState<any | null>(null);
  const [limitService, setLimitService] = useState<string | null>(null);

  const historyQuery = useStackHistory(stackId);
  const servicesQuery = useStackServices(stackId);
  const composeQuery = useStackCompose(stackId);

  const services = servicesQuery.data?.services || [];

  if (isStacksLoading && !stack) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-muted-foreground gap-3">
        <Loader2 size={24} className="animate-spin text-primary" aria-hidden="true" />
        <span>Loading stack details...</span>
      </div>
    );
  }

  if (!stack) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 rounded-full bg-destructive/10 text-destructive mb-4 border border-destructive/20">
          <Server size={32} aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Stack Not Found</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6">
          The requested stack <code>{stackId}</code> does not exist or was deleted.
        </p>
        <Button onClick={onBack}>
          Return to Dashboard
        </Button>
      </div>
    );
  }

  const { config, state, last_known_good_commit } = stack;

  const stackPageTitle = (
    <div className="flex items-center gap-3">
      <BackButton onClick={onBack} />
      <span className="text-sm font-bold text-foreground tracking-tight font-sans">
        {config.id}
      </span>
      {config.sync_mode !== 'webhook' && config.poll_interval_secs > 0 && (
        <PollCountdown 
          intervalSecs={config.poll_interval_secs} 
          size="sm" 
          isPaused={state === 'stopped' || services.length === 0}
        />
      )}
      <StatusBadge state={state} size="sm" />
    </div>
  );

  return (
    <AppShell 
      onRefresh={refetch} 
      isRefetching={false} 
      onLogout={onLogout} 
      pageTitle={stackPageTitle}
      headerActions={
        <StackHeaderActions 
          stackId={config.id} 
          state={state} 
          servicesLength={services.length} 
          lastKnownGoodCommit={last_known_good_commit} 
        />
      }
      onAddStack={() => { window.location.hash = '#/stacks/new'; }}
    >
      {() => (
        <div className="flex flex-col h-full relative">
          <main className="flex-1 max-w-7xl w-full mx-auto flex flex-col gap-6">
            <StackMetadataCard stack={stack} />
            <StackTabs 
              stack={stack}
              activeTab={activeTab}
              handleTabChange={handleTabChange}
              services={services}
              servicesQuery={servicesQuery}
              composeQuery={composeQuery}
              historyQuery={historyQuery}
              selectedService={selectedService}
              setSelectedService={setSelectedService}
              execService={execService}
              setExecService={setExecService}
            />
          </main>
          <StackLimitsModal 
            stackId={config.id} 
            limitService={limitService} 
            setLimitService={setLimitService} 
          />
        </div>
      )}
    </AppShell>
  );
};
