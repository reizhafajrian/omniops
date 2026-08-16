import React from 'react';
import { Server, Loader2, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/button';
import { ServiceCard } from '@/components/ServiceCard';
import { useSyncStack } from '@/hooks/useStacks';

interface StackServicesTabProps {
  stackId: string;
  state: string;
  services: any[];
  servicesQuery: any;
}

export const StackServicesTab: React.FC<StackServicesTabProps> = ({
  stackId,
  state,
  services,
  servicesQuery,
}) => {
  const syncMutation = useSyncStack();

  const handleSyncStack = () => {
    if (state !== 'deploying' && !syncMutation.isPending) {
      syncMutation.mutate(stackId);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Server size={18} className="text-primary" />
            Compose Applications
          </h3>
          <p className="text-sm text-muted-foreground">Live CPU, RAM usage, storage volumes, and networks</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => servicesQuery.refetch()} disabled={servicesQuery.isFetching} className="gap-2">
          <RefreshCw size={14} className={clsx(servicesQuery.isFetching && 'animate-spin')} />
          Refresh Stats
        </Button>
      </div>

      {servicesQuery.isLoading ? (
        <div className="py-12 flex justify-center text-muted-foreground"><Loader2 className="animate-spin" /></div>
      ) : services.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground border rounded-xl border-dashed">
          <Server size={32} className="mx-auto mb-3 opacity-50" />
          <p className="mb-4">No running containers detected.</p>
          <Button variant="outline" onClick={handleSyncStack} disabled={state === 'deploying' || syncMutation.isPending}>
            {syncMutation.isPending || state === 'deploying' ? <Loader2 className="animate-spin mr-2" size={16} /> : <RefreshCw className="mr-2" size={16} />}
            Sync Now
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {services.map((svc) => (
            <ServiceCard key={svc.name} svc={svc} stackId={stackId} />
          ))}
        </div>
      )}
    </div>
  );
};
