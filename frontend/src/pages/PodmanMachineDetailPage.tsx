import React from 'react';
import { Server, Loader2 } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useMachineDetails } from '@/hooks/useMachineDetails';
import { useStacks } from '@/hooks/useStacks';
import { useGroupedContainers } from '@/hooks/useProjectStats';
import { BackButton } from '@/components/BackButton';
import { MachineMetricsOverview } from '@/components/machine/MachineMetricsOverview';
import { MachineProjectsList } from '@/components/machine/MachineProjectsList';

interface Props {
  machineName: string;
  onBack: () => void;
  onLogout: () => void;
}

export const PodmanMachineDetailPage: React.FC<Props> = ({
  machineName,
  onBack,
  onLogout
}) => {
  const { data: machineDetails, isLoading, isError, refetch, isRefetching } = useMachineDetails(machineName);
  const { data: stacks } = useStacks();
  
  React.useEffect(() => {
    console.log("machineDetails updated:", machineDetails);
  }, [machineDetails]);

  const groupedContainers = useGroupedContainers(machineDetails);

  const pageTitle = (
    <div className="flex items-center gap-3">
      <BackButton onClick={onBack} />
      <span className="text-sm font-bold text-foreground tracking-tight font-sans flex items-center gap-2">
        <Server className="text-brand-400" size={14} />
        {machineName}
      </span>
    </div>
  );

  return (
    <AppShell 
      onLogout={onLogout}
      onRefresh={refetch}
      isRefetching={isRefetching}
      pageTitle={pageTitle}
    >
      {() => (
        <div className="max-w-7xl mx-auto space-y-6">

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-brand-500" size={40} />
          </div>
        ) : isError || !machineDetails ? (
          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-6 flex flex-col items-center justify-center text-center">
            <Server className="text-rose-400 mb-2" size={32} />
            <h3 className="text-rose-300 font-semibold mb-1">Failed to load machine details</h3>
            <p className="text-rose-400/80 text-sm">Make sure the Podman daemon is running and the machine name is correct.</p>
          </div>
        ) : (
          <div className="space-y-8">
            <MachineMetricsOverview machineDetails={machineDetails} />

            <MachineProjectsList 
              machineName={machineName}
              machineDetails={machineDetails}
              groupedContainers={groupedContainers}
              stacks={stacks || []}
            />
          </div>
        )}
      </div>
      )}
    </AppShell>
  );
};

