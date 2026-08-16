import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { systemApi } from '@/api/system';
import { setStoredToken } from '@/api/client';
import { AppSettings } from '@/types/system';
import { AppShell } from '@/components/AppShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

import { GeneralTab } from '@/components/settings/GeneralTab';
import { AccountSecurityTab } from '@/components/settings/AccountSecurityTab';
import { IntegrationsTab } from '@/components/settings/IntegrationsTab';

interface SettingsPageProps {
  onBack?: () => void;
  onLogout?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onLogout }) => {
  const queryClient = useQueryClient();
  
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: systemApi.getSettings,
  });

  const updateMutation = useMutation({
    mutationFn: (newSettings: AppSettings) => systemApi.updateSettings(newSettings),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['settings'], data);
      if (variables.admin_password !== undefined) {
        setStoredToken(variables.admin_password);
      }
      toast.success('Settings updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update settings: ${String(error)}`);
    }
  });

  const handleSave = (newValues: Partial<AppSettings>) => {
    if (!settings) return;
    updateMutation.mutate({
      ...settings,
      ...newValues
    });
  };

  return (
    <AppShell pageTitle="Settings" onLogout={onLogout}>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="mb-6 w-full grid grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="account">Account Security</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <GeneralTab 
              settings={settings} 
              onSave={handleSave} 
              isSaving={updateMutation.isPending} 
            />
          </TabsContent>

          <TabsContent value="account">
            <AccountSecurityTab 
              settings={settings} 
              onSave={handleSave} 
              onLogout={onLogout}
              isSaving={updateMutation.isPending} 
            />
          </TabsContent>

          <TabsContent value="integrations">
            <IntegrationsTab 
              settings={settings} 
              onSave={handleSave} 
              isSaving={updateMutation.isPending} 
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
};
