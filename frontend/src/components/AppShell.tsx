import React, { useState, useEffect, useCallback } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppSidebar } from './AppSidebar';
import { DockerDaemonStatus } from './DockerDaemonStatus';

interface AppShellProps {
  children?: React.ReactNode | ((activeTab: 'stacks' | 'docker' | 'podman', onNavigateToEngine: (engine: string) => void) => React.ReactNode);
  onLogout?: () => void;
  onAddStack?: () => void;
  onRefresh?: () => void;
  isRefetching?: boolean;
  pageTitle: React.ReactNode;
  headerActions?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  onLogout,
  onAddStack,
  onRefresh = () => {},
  isRefetching = false,
  pageTitle,
  headerActions,
}) => {
  const getInitialTab = (): 'stacks' | 'docker' | 'podman' => {
    const hashSplit = window.location.hash.split('?');
    if (hashSplit.length > 1) {
      const params = new URLSearchParams(hashSplit[1]);
      const tab = params.get('mainTab');
      if (tab === 'docker' || tab === 'podman') return tab;
    }
    return 'stacks';
  };

  const [activeTab, setActiveTab] = useState<'stacks' | 'docker' | 'podman'>(getInitialTab());

  const updateUrlParams = useCallback((updates: Record<string, string | null>, newPath?: string) => {
    const hashSplit = window.location.hash.split('?');
    const path = newPath ?? (hashSplit[0] || '#/');
    const params = new URLSearchParams(hashSplit[1] || '');
    
    let changed = false;
    if (newPath && newPath !== hashSplit[0]) {
      changed = true;
    }

    for (const [key, value] of Object.entries(updates)) {
      if (value === null) {
        if (params.has(key)) {
          params.delete(key);
          changed = true;
        }
      } else {
        if (params.get(key) !== value) {
          params.set(key, value);
          changed = true;
        }
      }
    }
    
    if (changed) {
      const newHash = `${path}${params.toString() ? '?' + params.toString() : ''}`;
      window.history.pushState(null, '', newHash);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const tab = getInitialTab();
      if (tab !== activeTab) setActiveTab(tab);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeTab]);

  const handleTabChange = (tab: 'stacks' | 'docker' | 'podman') => {
    setActiveTab(tab);
    updateUrlParams({ mainTab: tab === 'stacks' ? null : tab }, '#/');
  };

  const handleNavigateToEngine = (engine: string) => {
    if (engine === 'docker' || engine === 'podman') {
      handleTabChange(engine);
    }
  };

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onOpenSettings={() => { window.location.hash = '#/settings'; }}
          onLogout={onLogout}
          onAddStack={onAddStack}
          onRefresh={onRefresh}
          isRefetching={isRefetching}
        />

        <SidebarInset className="flex flex-col min-h-screen">
          {/* Top Bar */}
          <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 backdrop-blur-md px-4">
            <SidebarTrigger aria-label="Toggle sidebar" className="-ml-1" />
            <Separator orientation="vertical" className="h-4" />
            <div className="flex-1 flex items-center">
              {typeof pageTitle === 'string' ? (
                <h1 className="text-sm font-semibold text-foreground">{pageTitle}</h1>
              ) : (
                pageTitle
              )}
            </div>
            {headerActions && (
              <div className="flex items-center gap-2 mr-2">
                {headerActions}
              </div>
            )}
            <div className="ml-auto flex items-center">
              <DockerDaemonStatus onNavigateToEngine={handleNavigateToEngine} />
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto p-6" id="main-content">
            {typeof children === 'function' ? children(activeTab, handleNavigateToEngine) : children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
};
