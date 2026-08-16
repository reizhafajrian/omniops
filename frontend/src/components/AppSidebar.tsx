import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Layers, Server, Cpu, Settings, Key, RefreshCw, LogOut, Plus } from 'lucide-react';
import { systemApi} from '@/api';
import { AppSettings } from '@/types';;
import { useStacks } from '@/hooks/useStacks';

interface AppSidebarProps {
  activeTab: 'stacks' | 'docker' | 'podman';
  onTabChange: (tab: 'stacks' | 'docker' | 'podman') => void;
  onOpenSettings: () => void;
  onOpenAuth: () => void;
  onLogout?: () => void;
  onAddStack?: () => void;
  onRefresh: () => void;
  isRefetching: boolean;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  activeTab,
  onTabChange,
  onOpenSettings,
  onOpenAuth,
  onLogout,
  onAddStack,
  onRefresh,
  isRefetching,
}) => {
  const { data: stacks = [] } = useStacks(5000);
  const { data: settings } = useQuery<AppSettings>({
    queryKey: ['settings'],
    queryFn: () => systemApi.getSettings(),
  });

  const engine = settings?.container_engine ?? 'docker';
  const failedCount = stacks.filter((s) => s.state === 'failed').length;
  const deployingCount = stacks.filter((s) => s.state === 'deploying').length;

  const navItems = [
    {
      id: 'stacks' as const,
      label: 'Dashboard',
      icon: Layers,
      badge: failedCount > 0 ? { label: String(failedCount), variant: 'destructive' as const } :
             deployingCount > 0 ? { label: String(deployingCount), variant: 'secondary' as const } : null,
    },
    {
      id: 'docker' as const,
      label: 'Docker',
      icon: Server,
      badge: engine === 'docker' ? { label: 'Active', variant: 'default' as const } : null,
    },
    {
      id: 'podman' as const,
      label: 'Podman',
      icon: Cpu,
      badge: engine === 'podman' ? { label: 'Active', variant: 'default' as const } : null,
    },
  ];

  return (
    <Sidebar>
      {/* Brand Header */}
      <SidebarHeader className="px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/20 text-primary shadow-sm shrink-0">
            <Layers size={20} aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-sidebar-foreground">DockOps</span>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono border-primary/30 text-primary">
                Control Plane
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">GitOps Container Platform</p>
          </div>
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map(({ id, label, icon: Icon, badge }) => (
              <SidebarMenuItem key={id}>
                <SidebarMenuButton
                  isActive={activeTab === id}
                  onClick={() => onTabChange(id)}
                  aria-current={activeTab === id ? 'page' : undefined}
                  className="justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Icon size={16} aria-hidden="true" />
                    {label}
                  </span>
                  {badge && (
                    <Badge variant={badge.variant} className="text-[10px] px-1.5 py-0 h-4 ml-auto">
                      {badge.label}
                    </Badge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Actions</SidebarGroupLabel>
          <SidebarMenu>
            {onAddStack && (
              <SidebarMenuItem>
                <SidebarMenuButton onClick={onAddStack}>
                  <Plus size={16} aria-hidden="true" />
                  Add Stack
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <SidebarMenuButton onClick={onRefresh} disabled={isRefetching}>
                <RefreshCw size={16} className={isRefetching ? 'animate-spin' : ''} aria-hidden="true" />
                {isRefetching ? 'Refreshing...' : 'Refresh'}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer Actions */}
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onOpenAuth}>
              <Key size={16} aria-hidden="true" />
              Auth Token
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onOpenSettings}>
              <Settings size={16} aria-hidden="true" />
              Settings
            </SidebarMenuButton>
          </SidebarMenuItem>
          {onLogout && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={onLogout}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut size={16} aria-hidden="true" />
                Log Out
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
