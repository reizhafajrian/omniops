import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Boxes, Network, FileCode, Terminal, Code, History, Settings } from 'lucide-react';
import { StackServicesTab } from '@/components/stack/StackServicesTab';
import { StackComposeTab } from '@/components/stack/StackComposeTab';
import { StackSettingsTab } from '@/components/stack/StackSettingsTab';
import { ServiceTopologyGraph } from '@/components/ServiceTopologyGraph';
import { LogTerminal } from '@/components/LogTerminal';
import { ExecTerminal } from '@/components/ExecTerminal';
import { HistoryTable } from '@/components/HistoryTable';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Stack, ServiceInfo } from '@/types';

interface StackTabsProps {
  stack: Stack;
  activeTab: 'services' | 'topology' | 'compose' | 'logs' | 'exec' | 'history' | 'edit';
  handleTabChange: (tab: string) => void;
  services: ServiceInfo[];
  servicesQuery: any;
  composeQuery: any;
  historyQuery: any;
  selectedService: string | null;
  setSelectedService: (svc: string | null) => void;
  execService: any | null;
  setExecService: (svc: any | null) => void;
}

export const StackTabs: React.FC<StackTabsProps> = ({
  stack,
  activeTab,
  handleTabChange,
  services,
  servicesQuery,
  composeQuery,
  historyQuery,
  selectedService,
  setSelectedService,
  execService,
  setExecService
}) => {
  const { config, state } = stack;

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex-1 flex flex-col">
      <TabsList className="w-full h-14 bg-card/40 border border-border/50 rounded-xl p-1.5 flex justify-between overflow-x-auto shrink-0 gap-1 mb-6 shadow-sm">
        <TabsTrigger value="services" className="flex-1 h-full rounded-lg gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none transition-all font-medium">
          <Boxes size={15} aria-hidden="true" />
          Services ({services.length})
        </TabsTrigger>
        <TabsTrigger value="topology" className="flex-1 h-full rounded-lg gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none transition-all font-medium">
          <Network size={15} aria-hidden="true" />
          Topology
        </TabsTrigger>
        <TabsTrigger value="compose" className="flex-1 h-full rounded-lg gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none transition-all font-medium">
          <FileCode size={15} aria-hidden="true" />
          Source
        </TabsTrigger>
        <TabsTrigger value="logs" className="flex-1 h-full rounded-lg gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none transition-all font-medium">
          <Terminal size={15} aria-hidden="true" />
          Logs
        </TabsTrigger>
        {execService && (
          <TabsTrigger value="exec" className="flex-1 h-full rounded-lg gap-2 data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-500 data-[state=active]:shadow-none transition-all font-medium text-emerald-600/80">
            <Code size={15} aria-hidden="true" />
            Exec ({execService})
          </TabsTrigger>
        )}
        <TabsTrigger value="history" className="flex-1 h-full rounded-lg gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none transition-all font-medium">
          <History size={15} aria-hidden="true" />
          History
        </TabsTrigger>
        <TabsTrigger value="edit" className="flex-1 h-full rounded-lg gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none transition-all font-medium">
          <Settings size={15} aria-hidden="true" />
          Settings
        </TabsTrigger>
      </TabsList>

      <div className="flex-1 flex flex-col min-h-[500px]">
        <TabsContent value="services" className="flex-1 mt-0">
          <StackServicesTab 
            stackId={config.id}
            state={state}
            services={services}
            servicesQuery={servicesQuery}
          />
        </TabsContent>

        <TabsContent value="topology" className="flex-1 mt-0 flex flex-col">
          <div className="flex-1 rounded-xl border bg-card/50 overflow-hidden">
            <ServiceTopologyGraph 
              services={services}
              onOpenLogs={(svc) => { setSelectedService(svc); handleTabChange('logs'); }}
              onOpenExec={(svc) => { setExecService(svc); handleTabChange('exec'); }}
            />
          </div>
        </TabsContent>

        <TabsContent value="compose" className="flex-1 mt-0 flex flex-col gap-4">
          <StackComposeTab composeQuery={composeQuery} />
        </TabsContent>

        <TabsContent value="logs" className="flex-1 mt-0 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Label className="text-muted-foreground shrink-0">Filter Stream:</Label>
            <Select value={selectedService || 'all'} onValueChange={(val) => setSelectedService(val === 'all' ? null : val)}>
              <SelectTrigger className="w-[250px] font-mono text-xs">
                <SelectValue placeholder="All Services (Stack Stream)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services (Stack Stream)</SelectItem>
                {services.map((s) => (
                  <SelectItem key={s.name} value={s.service || s.name}>{s.service || s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-h-[480px]">
            <LogTerminal stackId={config.id} service={selectedService || undefined} />
          </div>
        </TabsContent>

        <TabsContent value="exec" className="flex-1 mt-0 flex flex-col">
          {execService && <ExecTerminal stackId={config.id} service={execService} />}
        </TabsContent>

        <TabsContent value="history" className="flex-1 mt-0">
          <HistoryTable events={historyQuery.data || []} isLoading={historyQuery.isLoading} />
        </TabsContent>

        <TabsContent value="edit" className="flex-1 mt-0">
          <StackSettingsTab stack={stack} />
        </TabsContent>
      </div>
    </Tabs>
  );
};
