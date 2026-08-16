import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon, Cpu, Server, Loader2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppSettings } from '@/types/system';

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
    description: 'Currently disabled. Requires docker compose plugin',
    icon: Server,
    disabled: true,
  },
];

interface GeneralTabProps {
  settings?: AppSettings;
  onSave: (settings: Partial<AppSettings>) => void;
  isSaving: boolean;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({ settings, onSave, isSaving }) => {
  const [engine, setEngine] = useState('podman');

  useEffect(() => {
    if (settings?.container_engine) {
      setEngine(settings.container_engine);
    }
  }, [settings]);

  const handleSave = () => {
    onSave({ container_engine: engine });
  };

  return (
    <Card className="border-slate-800 bg-dark-900 shadow-xl overflow-hidden group">
      <CardHeader className="border-b border-slate-800/50 bg-slate-900/50 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-500/10 rounded-lg text-slate-400">
            <SettingsIcon size={20} />
          </div>
          <div>
            <CardTitle className="text-lg text-slate-200">General</CardTitle>
            <CardDescription className="text-slate-400">Configure core platform behaviors.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="space-y-3">
            <div>
              <Label>Container Engine</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Select which engine the backend uses for compose and exec commands.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Container engine selection">
              {ENGINE_OPTIONS.map(({ value, label, description, icon: Icon, disabled }) => {
                const isSelected = engine === value;
                return (
                  <label
                    key={value}
                    className={cn(
                      'relative flex flex-col gap-1 p-4 rounded-xl border transition-all',
                      disabled ? 'opacity-50 cursor-not-allowed bg-dark-900 border-slate-800' : 'cursor-pointer',
                      isSelected && !disabled
                        ? 'bg-brand-500/10 border-brand-500 text-foreground'
                        : !disabled ? 'bg-dark-800 border-slate-700 text-slate-400 hover:border-slate-500' : 'text-slate-500'
                    )}
                  >
                    <input
                      type="radio"
                      name="engine"
                      value={value}
                      className="sr-only"
                      checked={isSelected}
                      disabled={disabled}
                      onChange={(e) => setEngine(e.target.value)}
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
        </div>
      </CardContent>
      <CardFooter className="bg-slate-900/50 border-t border-slate-800/50 px-6 py-4 flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={isSaving}
          className="bg-brand-600 hover:bg-brand-700 text-white"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
          Save General
        </Button>
      </CardFooter>
    </Card>
  );
};
