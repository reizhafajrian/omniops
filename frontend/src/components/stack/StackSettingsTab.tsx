import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Settings, Check, GitBranch, FileCode, Webhook, Key, EyeOff, Eye, Copy, ClipboardPaste, Lock, Database, Server, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SyncModeSelector, SyncMode } from '@/components/SyncModeSelector';
import { RegistryAuthSection, RegistryAuthValue } from '@/components/RegistryAuthSection';
import { useUpdateStack } from '@/hooks/useStacks';

interface StackSettingsTabProps {
  stack: any;
}

export const StackSettingsTab: React.FC<StackSettingsTabProps> = ({ stack }) => {
  const { config } = stack;
  const updateMutation = useUpdateStack();

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
  
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [editSuccessMsg, setEditSuccessMsg] = useState<string | null>(null);
  const [editErrorMsg, setEditErrorMsg] = useState<string | null>(null);
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
      setIsFormInitialized(true);
    }
  }, [stack, isFormInitialized, config]);

  const handleUpdate = (e?: React.FormEvent, regenerateWebhook = false) => {
    if (e) e.preventDefault();
    setEditSuccessMsg(null);
    setEditErrorMsg(null);

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
          registry_host: editRegistryAuth.registry_host.trim() || undefined,
          registry_user: editRegistryAuth.registry_user.trim() || undefined,
          registry_pass: editRegistryAuth.registry_pass.trim() || undefined,
          sync_mode: editSyncMode,
          regenerate_webhook: regenerateWebhook,
          is_protected: editIsProtected,
          security_pin: editSecurityPin.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          if (editSourceType === 'git' && editPatToken.trim()) {
            localStorage.setItem('global_git_pat', editPatToken.trim());
          }
          setEditSuccessMsg(regenerateWebhook ? 'Regenerated webhook secret key!' : 'Stack configuration updated successfully!');
          setTimeout(() => setEditSuccessMsg(null), 3000);
        },
        onError: (err: any) => {
          setEditErrorMsg(err.message || 'Failed to update configuration.');
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

      {editSuccessMsg && <Alert className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"><Check className="h-4 w-4" /><AlertDescription>{editSuccessMsg}</AlertDescription></Alert>}
      {editErrorMsg && <Alert variant="destructive"><AlertDescription>{editErrorMsg}</AlertDescription></Alert>}

      <div className="flex items-center gap-2 p-1 bg-muted rounded-lg w-full max-w-sm">
        <button type="button" onClick={() => setEditSourceType('git')} className={clsx('flex-1 py-1.5 text-sm font-medium rounded-md flex justify-center items-center gap-2 transition-all', editSourceType === 'git' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
          <GitBranch size={16} /> Git Repo
        </button>
        <button type="button" onClick={() => setEditSourceType('inline')} className={clsx('flex-1 py-1.5 text-sm font-medium rounded-md flex justify-center items-center gap-2 transition-all', editSourceType === 'inline' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
          <FileCode size={16} /> Inline
        </button>
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
          <div className="pt-4 space-y-2 border-t">
            <Label className="text-xs">Webhook Trigger URL (GitHub / GitLab):</Label>
            <div className="flex items-center gap-2">
              <Input readOnly value={`${window.location.protocol}//${window.location.hostname}:9090/api/webhooks/${config.webhook_secret || 'secret'}`} className="font-mono text-xs text-indigo-400" />
              <Button type="button" variant="secondary" onClick={() => {
                const url = `${window.location.protocol}//${window.location.hostname}:9090/api/webhooks/${config.webhook_secret || 'secret'}`;
                navigator.clipboard.writeText(url);
                setCopiedWebhook(true);
                setTimeout(() => setCopiedWebhook(false), 2000);
              }} className="gap-2">
                {copiedWebhook ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                {copiedWebhook ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Payload method: POST.</p>
              <button type="button" onClick={(e) => handleUpdate(e, true)} className="text-xs text-amber-500 hover:underline">Regenerate Secret</button>
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
    </form>
  );
};
