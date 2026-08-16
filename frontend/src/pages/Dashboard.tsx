import React, { useState, useMemo } from 'react';
import { useStacks } from '@/hooks/useStacks';
import { useSystemMetrics } from '@/hooks/useSystemMetrics';
import { StackCard } from '@/components/StackCard';
import { AppShell } from '@/components/AppShell';
import { PodmanManagerTab } from '@/components/PodmanManagerTab';
import { DockerManagerTab } from '@/components/DockerManagerTab';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { Stack } from '@/types';
import { Server, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DashboardProps {
  onLogout?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const { data: stacks = [], isLoading, isError, error, refetch, isRefetching } = useStacks(3000);
  const { data: metrics } = useSystemMetrics(5000);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('all');

  const stats = useMemo(() => ({
    total: stacks.length,
    synced: stacks.filter((s) => s.state === 'synced').length,
    outOfSync: stacks.filter((s) => s.state === 'out_of_sync').length,
    deploying: stacks.filter((s) => s.state === 'deploying').length,
    failed: stacks.filter((s) => s.state === 'failed').length,
  }), [stacks]);

  const filteredStacks = useMemo(() => stacks.filter((s: Stack) => {
    const matchesSearch =
      s.config.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.config.repo_url.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.config.branch.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = selectedStateFilter === 'all' || s.state === selectedStateFilter;
    return matchesSearch && matchesFilter;
  }), [stacks, searchQuery, selectedStateFilter]);

  const handleOpenDetail = (stack: Stack) => {
    window.location.hash = `#/stacks/${encodeURIComponent(stack.config.id)}`;
  };

  const pageTitle = 'OmniOps';

  return (
    <AppShell
      onRefresh={refetch}
      isRefetching={isRefetching}
      onLogout={onLogout}
      onAddStack={() => { window.location.hash = '#/stacks/new'; }}
      pageTitle={pageTitle}
    >
      {(activeTab) => (
        <>
          {activeTab === 'podman' && <PodmanManagerTab />}
          {activeTab === 'docker' && <DockerManagerTab />}

          {activeTab === 'stacks' && (
            <div className="space-y-6">
              {/* KPI Stats & System Resources */}
              <DashboardStats stats={stats} metrics={metrics} />

              {/* Search & Filter */}
              <DashboardFilters
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                selectedStateFilter={selectedStateFilter}
                setSelectedStateFilter={setSelectedStateFilter}
              />

              {/* Loading State */}
              {isLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true" aria-label="Loading stacks">
                  {[1, 2, 3].map((n) => (
                    <Card key={n}>
                      <CardContent className="p-6 space-y-3">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-3/4" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Error State */}
              {isError && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  <AlertDescription>
                    <strong>Failed to connect to OmniOps Engine API.</strong>{' '}
                    {error?.message || 'Check your OMNIOPS_TOKEN configuration or ensure the engine backend is running.'}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => refetch()}
                      className="ml-3 mt-1"
                    >
                      Retry Connection
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Stack Grid */}
              {!isLoading && !isError && filteredStacks.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-1 xl:grid-cols-2 gap-6">
                  {filteredStacks.map((stack: Stack) => (
                    <StackCard key={stack.config.id} stack={stack} onSelect={handleOpenDetail} />
                  ))}
                </div>
              )}

              {/* Empty State */}
              {!isLoading && !isError && filteredStacks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border rounded-2xl bg-muted/20">
                  <div className="p-4 rounded-full bg-muted/50 mb-4">
                    <Server className="text-muted-foreground opacity-60" size={32} aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">No matching stacks found</h3>
                  <p className="text-sm text-muted-foreground/80 mt-1 max-w-sm">
                    We couldn't find any stacks matching your current search and filter criteria.
                  </p>
                  {(searchQuery !== '' || selectedStateFilter !== 'all') && (
                    <Button 
                      variant="outline" 
                      onClick={() => { setSearchQuery(''); setSelectedStateFilter('all'); }} 
                      className="mt-6"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
};

