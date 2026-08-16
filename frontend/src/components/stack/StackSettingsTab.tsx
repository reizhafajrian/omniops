import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Settings, Check, GitBranch, FileCode, Webhook, Key, EyeOff, Eye, Copy, ClipboardPaste, Lock, Database, Server, Loader2, RefreshCw, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SyncModeSelector, SyncMode } from '@/components/SyncModeSelector';
import { RegistryAuthSection, RegistryAuthValue } from '@/components/RegistryAuthSection';
import { CreateMachineModal } from '@/components/machine/CreateMachineModal';
import { useUpdateStack } from '@/hooks/useStacks';
import { useQuery } from '@tanstack/react-query';
import { machinesApi } from '@/api';

interface StackSettingsTabProps {
  stack: any;
}

export const StackSettingsTab: React.FC<StackSettingsTabProps> = ({ stack }) => {
  const { config } = stack;
  const updateMutation = useUpdateStack();

  const { data: machines } = useQuery({
    queryKey: ['machines'],
    queryFn: () => machinesApi.getMachines(),
  });

  const [editSourceType, setEditSourceType] = useState<'git' | 'inline'>('git');
  const [editInlineCompose, setEditInlineCompose] = useState('');
  const [editBranch, setEditBranch] = useState('');
  const [editComposePath, setEditComposePath] = useState('');
  const [editPatToken, setEditPatToken] = useState(() => localStorage.getItem('global_git_pat') || '');
  const [showPatToken, setShowPatToken] = useState(false);
  const [copiedPatToken, setCopiedPatToken] = useState(false);
  const [editPollInterval, setEditPollInterval] = useState(60);
  const [editEnvVars, setEditEnvVars] = useState('');
  const [editRegistryAuth, setEditRegistryAuth] = useState<RegistryAuthValue>({
    registry_host: '',
    registry_user: '',
    registry_pass: '',
  });
  const [editSyncMode, setEditSyncMode] = useState<SyncMode>('poll');
  const [editIsProtected, setEditIsProtected] = useState(false);
  const [editSecurityPin, setEditSecurityPin] = useState('');
  const [editMachineName, setEditMachineName] = useState('');
  
  const [isMachineModalOpen, setIsMachineModalOpen] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [showWebhookToken, setShowWebhookToken] = useState(false);
  const [copiedWebhookToken, setCopiedWebhookToken] = useState(false);
  const [copiedExample, setCopiedExample] = useState<string | null>(null);
  const [isFormInitialized, setIsFormInitialized] = useState(false);

  useEffect(() => {
    if (stack && !isFormInitialized) {
      setEditSourceType((config.source_type as 'git' | 'inline') || 'git');
      setEditInlineCompose(config.inline_compose || '');
      setEditBranch(config.branch || '');
      setEditComposePath(config.compose_path || '');
      setEditPollInterval(config.poll_interval_secs || 60);
      setEditEnvVars(config.env_vars || '');
      setEditRegistryAuth({
        registry_host: config.registry_host || '',
        registry_user: config.registry_user || '',
        registry_pass: config.registry_pass || '',
      });
      setEditSyncMode((config.sync_mode as SyncMode) || 'poll');
      setEditIsProtected(!!config.is_protected);
      setEditSecurityPin(config.security_pin || '');
      setEditMachineName(config.machine_name || (machines && machines.length > 0 ? machines[0].Name : ''));
      setIsFormInitialized(true);
    }
  }, [stack, isFormInitialized, config]);

  const handleUpdate = (e?: React.FormEvent, regenerateWebhook = false) => {
    if (e) e.preventDefault();

    updateMutation.mutate(
      {
        stackId: config.id,
        input: {
          source_type: editSourceType,
          inline_compose: editSourceType === 'inline' ? editInlineCompose.trim() : undefined,
          branch: editSourceType === 'git' ? editBranch.trim() : undefined,
          compose_path: editSourceType === 'git' ? editComposePath.trim() : undefined,
          poll_interval_secs: Number(editPollInterval),
          pat_token: editSourceType === 'git' ? (editPatToken.trim() || undefined) : undefined,
          env_vars: editEnvVars.trim() || undefined,
          registry_host: editRegistryAuth.registry_host.trim() || "",
          registry_user: editRegistryAuth.registry_user.trim() || "",
          registry_pass: editRegistryAuth.registry_pass.trim() || "",
          sync_mode: editSyncMode,
          regenerate_webhook: regenerateWebhook,
          is_protected: editIsProtected,
          security_pin: editSecurityPin.trim() || undefined,
          machine_name: editMachineName.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          if (editSourceType === 'git' && editPatToken.trim()) {
            localStorage.setItem('global_git_pat', editPatToken.trim());
          }
          toast.success(regenerateWebhook ? 'Regenerated webhook secret key!' : 'Stack configuration updated successfully!');
        },
        onError: (err: any) => {
          toast.error(err.message || 'Failed to update configuration.');
        }
      }
    );
  };

  return (
    <form onSubmit={(e) => handleUpdate(e)} className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Settings size={18} className="text-primary" />
          Stack Configuration
        </h3>
        <p className="text-sm text-muted-foreground mt-1">Updates are saved to the database and applied on next reconciliation.</p>
      </div>

      <div className="flex items-center gap-2 p-1 bg-muted rounded-lg w-full max-w-sm">
        <button type="button" onClick={() => setEditSourceType('git')} className={clsx('flex-1 py-1.5 text-sm font-medium rounded-md flex justify-center items-center gap-2 transition-all', editSourceType === 'git' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
          <GitBranch size={16} /> Git Repo
        </button>
        <button type="button" onClick={() => setEditSourceType('inline')} className={clsx('flex-1 py-1.5 text-sm font-medium rounded-md flex justify-center items-center gap-2 transition-all', editSourceType === 'inline' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
          <FileCode size={16} /> Inline
        </button>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5"><Server size={14} className="text-primary" /> Target Machine</Label>
        <div className="space-y-2">
          <div className="relative">
            <select
              value={editMachineName}
              onChange={(e) => setEditMachineName(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer"
              required
            >
              {machines?.map((m) => (
                <option key={m.Name} value={m.Name}>
                  {m.Name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMachineModalOpen(true)}
            className="text-xs text-brand-400 hover:text-brand-300 transition-colors font-semibold px-1"
          >
            + Create New Machine
          </button>
        </div>
      </div>

      {editSourceType === 'git' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><GitBranch size={14} className="text-primary" /> Tracked Branch</Label>
            <Input value={editBranch} onChange={(e) => setEditBranch(e.target.value)} className="font-mono text-sm" />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><FileCode size={14} className="text-indigo-400" /> Compose Path</Label>
            <Input value={editComposePath} onChange={(e) => setEditComposePath(e.target.value)} className="font-mono text-sm" />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5"><FileCode size={14} /> docker-compose.yml</Label>
          <Textarea required rows={12} value={editInlineCompose} onChange={(e) => setEditInlineCompose(e.target.value)} className="font-mono text-sm resize-y" placeholder="version: '3.8'..." />
        </div>
      )}

      <div className="space-y-4 p-4 rounded-xl border bg-card/50">
        <Label className="flex items-center gap-1.5"><Webhook size={14} className="text-primary" /> Trigger Mode</Label>
        <SyncModeSelector value={editSyncMode} onChange={setEditSyncMode} />
        <p className="text-xs text-muted-foreground">
          {editSyncMode === 'poll' && 'Backend polls git repository on the configured interval.'}
          {editSyncMode === 'webhook' && 'Deploys instantly on push. A unique webhook URL is generated below.'}
          {editSyncMode === 'both' && 'Combines periodic polling with instant webhook triggers for reliability.'}
        </p>

        {(editSyncMode === 'webhook' || editSyncMode === 'both') && (
          <div className="pt-4 space-y-4 border-t">
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1.5"><Webhook size={12} className="text-indigo-400" /> Webhook URL</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={`${window.location.protocol}//${window.location.hostname}:9090/api/webhooks/${config.webhook_secret || 'secret'}`} className="font-mono text-xs text-indigo-400" />
                <Button type="button" variant="secondary" size="sm" onClick={() => {
                  const url = `${window.location.protocol}//${window.location.hostname}:9090/api/webhooks/${config.webhook_secret || 'secret'}`;
                  navigator.clipboard.writeText(url);
                  setCopiedWebhook(true);
                  setTimeout(() => setCopiedWebhook(false), 2000);
                }} className="gap-1.5 shrink-0">
                  {copiedWebhook ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  {copiedWebhook ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Send a <code className="text-indigo-400">POST</code> request to this URL to trigger a deployment.</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1.5"><Shield size={12} className="text-amber-400" /> Webhook Token</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    readOnly
                    value={config.webhook_secret || ''}
                    type={showWebhookToken ? 'text' : 'password'}
                    className="font-mono text-xs pr-20"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowWebhookToken(!showWebhookToken)}>
                      {showWebhookToken ? <EyeOff size={13} /> : <Eye size={13} />}
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                      navigator.clipboard.writeText(config.webhook_secret || '');
                      setCopiedWebhookToken(true);
                      setTimeout(() => setCopiedWebhookToken(false), 2000);
                    }}>
                      {copiedWebhookToken ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    </Button>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(e) => handleUpdate(e, true)}
                  className="gap-1.5 shrink-0 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400"
                >
                  <RefreshCw size={13} />
                  Regenerate
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">This token is embedded in the URL and authenticates the webhook request. Regenerate it if compromised.</p>
            </div>

            <div className="bg-dark-900 border border-slate-800 rounded-lg p-4 space-y-3">
              <Label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"><FileCode size={12} /> Usage Examples</Label>
              <Tabs defaultValue="curl" className="flex flex-col w-full">
                <TabsList className="bg-dark-950 border border-slate-800 w-full justify-start">
                  <TabsTrigger value="curl" className="text-xs">cURL</TabsTrigger>
                  <TabsTrigger value="nodejs" className="text-xs">Node.js</TabsTrigger>
                  <TabsTrigger value="github" className="text-xs">GitHub Actions</TabsTrigger>
                </TabsList>
                <TabsContent value="curl" className="mt-2">
                  <div className="relative group">
                    <pre className="p-3 bg-dark-950 border border-slate-800 rounded-md overflow-x-auto text-xs font-mono text-slate-300 leading-relaxed pr-10">
                      <code>{`curl -X POST "${window.location.protocol}//${window.location.hostname}:9090/api/webhooks/${config.webhook_secret || '<your-token>'}"`}</code>
                    </pre>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        navigator.clipboard.writeText(`curl -X POST "${window.location.protocol}//${window.location.hostname}:9090/api/webhooks/${config.webhook_secret || '<your-token>'}"`);
                        setCopiedExample('curl');
                        setTimeout(() => setCopiedExample(null), 2000);
                      }}
                    >
                      {copiedExample === 'curl' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="nodejs" className="mt-2">
                  <div className="relative group">
                    <pre className="p-3 bg-dark-950 border border-slate-800 rounded-md overflow-x-auto text-xs font-mono text-slate-300 leading-relaxed pr-10">
                      <code>{`const WEBHOOK_TOKEN = '${config.webhook_secret || '<your-token>'}';
const BASE_URL = '${window.location.protocol}//${window.location.hostname}:9090';

const res = await fetch(
  \`\$\{BASE_URL\}/api/webhooks/\$\{WEBHOOK_TOKEN\}\`,
  { method: 'POST' }
);

console.log('Status:', res.status);
console.log('Response:', await res.json());`}</code>
                    </pre>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        const code = `const WEBHOOK_TOKEN = '${config.webhook_secret || '<your-token>'}';
const BASE_URL = '${window.location.protocol}//${window.location.hostname}:9090';

const res = await fetch(
  \`\$\{BASE_URL\}/api/webhooks/\$\{WEBHOOK_TOKEN\}\`,
  { method: 'POST' }
);

console.log('Status:', res.status);
console.log('Response:', await res.json());`;
                        navigator.clipboard.writeText(code);
                        setCopiedExample('nodejs');
                        setTimeout(() => setCopiedExample(null), 2000);
                      }}
                    >
                      {copiedExample === 'nodejs' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="github" className="mt-2">
                  <div className="relative group">
                    <pre className="p-3 bg-dark-950 border border-slate-800 rounded-md overflow-x-auto text-xs font-mono text-slate-300 leading-relaxed pr-10">
                      <code>{`# .github/workflows/deploy.yml
name: Deploy via Webhook
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger OmniOps Webhook
        run: |
          curl -X POST \\
            "${window.location.protocol}//${window.location.hostname}:9090/api/webhooks/\${{ secrets.OMNIOPS_WEBHOOK_TOKEN }}"`}</code>
                    </pre>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        const code = `# .github/workflows/deploy.yml
name: Deploy via Webhook
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger OmniOps Webhook
        run: |
          curl -X POST \\
            "${window.location.protocol}//${window.location.hostname}:9090/api/webhooks/\${{ secrets.OMNIOPS_WEBHOOK_TOKEN }}"`;
                        navigator.clipboard.writeText(code);
                        setCopiedExample('github');
                        setTimeout(() => setCopiedExample(null), 2000);
                      }}
                    >
                      {copiedExample === 'github' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Add <code className="text-amber-400">OMNIOPS_WEBHOOK_TOKEN</code> to your repo secrets with value: <code className="text-indigo-400">{config.webhook_secret || '<your-token>'}</code></p>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Poll Interval (seconds)</Label>
        <Input type="number" min="10" disabled={editSyncMode === 'webhook'} value={editPollInterval} onChange={(e) => setEditPollInterval(Number(e.target.value))} className="font-mono max-w-[200px]" />
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5"><Key size={14} className="text-amber-500" /> Git PAT (Access Token)</Label>
        <div className="relative">
          <Input type={showPatToken ? "text" : "password"} value={editPatToken} onChange={(e) => setEditPatToken(e.target.value)} placeholder="Leave blank to keep current token" className="font-mono pr-24" />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowPatToken(!showPatToken)}>{showPatToken ? <EyeOff size={14} /> : <Eye size={14} />}</Button>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
              navigator.clipboard.writeText(editPatToken);
              setCopiedPatToken(true);
              setTimeout(() => setCopiedPatToken(false), 2000);
            }}>{copiedPatToken ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}</Button>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={async () => {
              try { const text = await navigator.clipboard.readText(); setEditPatToken(text); } catch (err) {}
            }}><ClipboardPaste size={14} /></Button>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-amber-500 flex items-center gap-2"><Lock size={14} /> Protect Stack</Label>
            <p className="text-xs text-amber-500/80">Require a security PIN to view or manage this stack.</p>
          </div>
          <Switch checked={editIsProtected} onCheckedChange={setEditIsProtected} />
        </div>
        {editIsProtected && (
          <div className="pt-4 border-t border-amber-500/20 space-y-2">
            <Label className="text-xs text-amber-500/80">Security PIN (Default: 1234):</Label>
            <Input type="password" maxLength={6} value={editSecurityPin} onChange={(e) => setEditSecurityPin(e.target.value)} placeholder="4-digit PIN" className="font-mono border-amber-500/30 focus-visible:ring-amber-500" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5"><Database size={14} className="text-emerald-500" /> Environment Variables (.env)</Label>
        <Textarea rows={4} value={editEnvVars} onChange={(e) => setEditEnvVars(e.target.value)} className="font-mono text-sm resize-y" placeholder="FOO=bar" />
        <p className="text-xs text-muted-foreground">Written to .env file during deployment.</p>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-1.5"><Server size={14} className="text-indigo-400" /> Registry Auth</Label>
        <RegistryAuthSection value={editRegistryAuth} onChange={setEditRegistryAuth} />
      </div>

      <div className="pt-4">
        <Button type="submit" disabled={updateMutation.isPending} className="gap-2">
          {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          Save Configuration
        </Button>
      </div>

      <CreateMachineModal
        isOpen={isMachineModalOpen}
        onClose={() => setIsMachineModalOpen(false)}
        onSuccess={(newName) => {
          setEditMachineName(newName);
          setIsMachineModalOpen(false);
        }}
        machines={machines || []}
      />
    </form>
  );
};
