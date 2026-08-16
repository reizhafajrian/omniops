import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const STATUS_FILTERS = ['all', 'synced', 'out_of_sync', 'deploying', 'failed'] as const;

export interface DashboardFiltersProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  selectedStateFilter: string;
  setSelectedStateFilter: (val: string) => void;
}

export const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  searchQuery, setSearchQuery,
  selectedStateFilter, setSelectedStateFilter,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
      <div className="relative flex-1 max-w-sm">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          placeholder="Search stack ID, repo URL, or branch…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 text-xs transition-colors focus-visible:ring-1 focus-visible:ring-primary/50"
          aria-label="Search stacks"
          spellCheck={false}
        />
      </div>

      <Tabs value={selectedStateFilter} onValueChange={setSelectedStateFilter} className="w-full sm:w-auto">
        <TabsList className="w-full sm:w-auto overflow-x-auto justify-start sm:justify-center p-1 bg-muted/50 border border-border">
          {STATUS_FILTERS.map((filter) => (
            <TabsTrigger
              key={filter}
              value={filter}
              className="capitalize text-xs whitespace-nowrap px-4 py-1.5"
            >
              {filter.replace(/_/g, ' ')}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
};
