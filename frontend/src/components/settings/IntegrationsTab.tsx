import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Key, Loader2, Save } from 'lucide-react';
import { AppSettings } from '@/types/system';
import { SecretInput } from '@/components/ui/secret-input';

interface IntegrationsTabProps {
  settings?: AppSettings;
  onSave: (settings: Partial<AppSettings>) => void;
  isSaving: boolean;
}

export const IntegrationsTab: React.FC<IntegrationsTabProps> = ({ settings, onSave, isSaving }) => {
  const [githubToken, setGithubToken] = useState('');

  useEffect(() => {
    if (settings?.github_token) {
      setGithubToken(settings.github_token);
    }
  }, [settings]);

  const handleSave = () => {
    onSave({ github_token: githubToken });
  };

  return (
    <Card className="border-slate-800 bg-dark-900 shadow-xl overflow-hidden group">
      <CardHeader className="border-b border-slate-800/50 bg-slate-900/50 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
            <Key size={20} />
          </div>
          <div>
            <CardTitle className="text-lg text-slate-200">Integrations</CardTitle>
            <CardDescription className="text-slate-400">Configure external service tokens and access.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="github_token">GitHub Personal Access Token</Label>
            <SecretInput
              id="github_token"
              placeholder="ghp_xxxxxxxxxxxx"
              value={githubToken}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGithubToken(e.target.value)}
              className="bg-dark-800 border-slate-700 focus:border-blue-500"
              allowCopy
            />
            <p className="text-xs text-slate-500">
              Used for fetching remote repositories and composing stacks from private repositories.
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-slate-900/50 border-t border-slate-800/50 px-6 py-4 flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
          Save Integrations
        </Button>
      </CardFooter>
    </Card>
  );
};
