import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, Loader2, Cpu, Server } from 'lucide-react';
import { systemApi} from '../api';
import { AppSettings } from '../types';;
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ENGINE_OPTIONS = [
  {
    value: 'podman',
    label: 'Podman',
    description: 'Requires podman-compose',
    icon: Cpu,
  },
  {
    value: 'docker',
    label: 'Docker',
    description: 'Requires docker compose plugin',
    icon: Server,
  },
] as const;

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<AppSettings>({ container_engine: 'podman' });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) loadSettings();
  }, [isOpen]);

  const loadSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await systemApi.getSettings();
      setSettings(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await systemApi.updateSettings(settings);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Global Settings</DialogTitle>
          <DialogDescription>Configure DockOps control plane preferences</DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <form id="settings-form" onSubmit={handleSave} className="space-y-6 py-2">
            <div className="space-y-3">
              <div>
                <Label>Container Engine</Label>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  Select which engine the backend uses for <code>compose</code> and <code>exec</code> commands.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Container engine selection">
                {ENGINE_OPTIONS.map(({ value, label, description, icon: Icon }) => {
                  const isSelected = settings.container_engine === value;
                  return (
                    <label
                      key={value}
                      className={cn(
                        'relative flex flex-col gap-1 p-4 cursor-pointer rounded-xl border transition-all',
                        isSelected
                          ? 'bg-primary/10 border-primary text-foreground'
                          : 'bg-secondary/40 border-border text-muted-foreground hover:border-muted-foreground/50'
                      )}
                    >
                      <input
                        type="radio"
                        name="engine"
                        value={value}
                        className="sr-only"
                        checked={isSelected}
                        onChange={(e) => setSettings({ ...settings, container_engine: e.target.value })}
                        aria-label={label}
                      />
                      <span className="flex items-center gap-2 font-semibold text-sm">
                        <Icon size={14} aria-hidden="true" />
                        {label}
                      </span>
                      <span className="text-xs opacity-70">{description}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </form>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="settings-form"
            disabled={isLoading || isSaving}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
