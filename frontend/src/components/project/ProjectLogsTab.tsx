import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { LogTerminal } from '@/components/LogTerminal';
import { ServiceInfo } from '@/types';;

interface ProjectLogsTabProps {
  machineName: string;
  projectName: string;
  mappedServices: ServiceInfo[];
  selectedLogContainer: string;
  setSelectedLogContainer: (val: string) => void;
}

export const ProjectLogsTab: React.FC<ProjectLogsTabProps> = ({
  machineName,
  projectName,
  mappedServices,
  selectedLogContainer,
  setSelectedLogContainer,
}) => {
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3">
        <Label className="text-muted-foreground shrink-0">Filter Stream:</Label>
        <Select value={selectedLogContainer} onValueChange={(val) => { if (val) setSelectedLogContainer(val) }}>
          <SelectTrigger className="w-[250px] font-mono text-xs">
            <SelectValue placeholder="All Containers">
              {selectedLogContainer === 'all' 
                ? "All Containers" 
                : mappedServices.find(s => s.container_id === selectedLogContainer)?.service || "All Containers"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Containers</SelectItem>
              {mappedServices.map(svc => (
                <SelectItem key={svc.container_id} value={svc.container_id}>
                  {svc.service}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
      </div>

      <div className="flex-1 min-h-[480px]">
        <LogTerminal 
          stackId={`${projectName}-${selectedLogContainer}`} 
          customWsUrl={`/api/system/machines/${encodeURIComponent(machineName)}/projects/${encodeURIComponent(projectName)}/logs${selectedLogContainer !== 'all' ? `?container=${encodeURIComponent(selectedLogContainer)}` : ''}`} 
        />
      </div>
    </div>
  );
};
