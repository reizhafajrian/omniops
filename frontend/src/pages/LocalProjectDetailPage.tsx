import React from 'react';
import { Server, Box, Loader2, Boxes, Network, Terminal } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useMachineDetails } from '@/hooks/useMachineDetails';
import { useProjectContainers, useProjectMetrics, useMappedServices } from '@/hooks/useProjectStats';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceTopologyGraph } from '@/components/ServiceTopologyGraph';
import { BackButton } from '@/components/BackButton';
import { ProjectMetricsOverview } from '@/components/project/ProjectMetricsOverview';
import { ProjectServicesList } from '@/components/project/ProjectServicesList';
import { ProjectLogsTab } from '@/components/project/ProjectLogsTab';

interface Props {
  machineName: string;
  projectName: string;
  onBack: () => void;
  onLogout: () => void;
}

export const LocalProjectDetailPage: React.FC<Props> = ({
  machineName,
  projectName,
  onBack,
  onLogout
}) => {
  const { data: machineDetails, isLoading, isError, refetch, isRefetching } = useMachineDetails(machineName);
  
  const [activeTab, setActiveTab] = React.useState('services');
  const [selectedLogContainer, setSelectedLogContainer] = React.useState<string>("all");

  const projectContainers = useProjectContainers(machineDetails, projectName);
  const projectMetrics = useProjectMetrics(machineDetails, projectContainers);
  const mappedServices = useMappedServices(projectContainers);

  const pageTitle = (
    <div className="flex items-center gap-3">
      <BackButton onClick={onBack} />
      <span className="text-sm font-bold text-foreground tracking-tight font-sans flex items-center gap-2">
        <Box className="text-primary" size={14} />
        {projectName}
      </span>
    </div>
  );

  const headerActions = (
    <div className="text-xs text-slate-400 bg-dark-900 px-2.5 py-1 rounded-full border border-slate-800 flex items-center gap-1.5">
      <Server size={12} className="text-brand-500" />
      Machine: {machineName}
    </div>
  );

  return (
    <AppShell 
      onLogout={onLogout}
      onRefresh={refetch}
      isRefetching={isRefetching}
      pageTitle={pageTitle}
      headerActions={headerActions}
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
              <h3 className="text-rose-300 font-semibold mb-1">Failed to load details</h3>
              <p className="text-rose-400/80 text-sm">Make sure the Podman daemon is running.</p>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
              <TabsList className="w-full h-14 bg-card/40 border border-border/50 rounded-xl p-1.5 flex justify-between overflow-x-auto shrink-0 gap-1 mb-6 shadow-sm">
                <TabsTrigger value="services" className="flex-1 h-full rounded-lg gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none transition-all font-medium">
                  <Boxes size={15} aria-hidden="true" />
                  Services ({projectContainers.length})
                </TabsTrigger>
                <TabsTrigger value="topology" className="flex-1 h-full rounded-lg gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none transition-all font-medium">
                  <Network size={15} aria-hidden="true" />
                  Topology
                </TabsTrigger>
                <TabsTrigger value="logs" className="flex-1 h-full rounded-lg gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none transition-all font-medium">
                  <Terminal size={15} aria-hidden="true" />
                  Logs
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 flex flex-col min-h-[500px]">
                <TabsContent value="services" className="flex-1 mt-0">
                  <div className="space-y-8">
                    {/* Project Metrics Section */}
                    {machineDetails.state === 'running' && projectContainers.length > 0 && (
                      <ProjectMetricsOverview metrics={projectMetrics} />
                    )}

                    {/* Containers Section */}
                    <ProjectServicesList
                      machineName={machineName}
                      isMachineRunning={machineDetails.state === 'running'}
                      projectContainers={projectContainers}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="topology" className="flex-1 mt-0 flex flex-col">
                  {projectContainers.length > 0 ? (
                    <ServiceTopologyGraph
                      services={mappedServices}
                      onOpenLogs={() => setActiveTab('logs')}
                    />
                  ) : (
                    <div className="bg-dark-900 border border-dashed border-slate-700 rounded-xl p-12 flex flex-col items-center justify-center text-center">
                      <Network className="text-slate-600 mb-3" size={40} />
                      <h3 className="text-slate-300 font-medium mb-1">No Topology Available</h3>
                      <p className="text-slate-500 text-sm max-w-md">
                        There are no containers running in this project.
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="logs" className="flex-1 mt-0 flex flex-col gap-4">
                  <ProjectLogsTab
                    machineName={machineName}
                    projectName={projectName}
                    mappedServices={mappedServices}
                    selectedLogContainer={selectedLogContainer}
                    setSelectedLogContainer={setSelectedLogContainer}
                  />
                </TabsContent>
              </div>
            </Tabs>
          )}
        </div>
      )}
    </AppShell>
  );
};
