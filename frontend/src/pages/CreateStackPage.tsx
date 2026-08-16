import React, { useState, useEffect } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { STACKS_QUERY_KEY } from '../hooks/useStacks';
import { stacksApi, machinesApi } from '../api';
import { AppShell } from '../components/AppShell';
import { SyncModeSelector, SyncMode } from '../components/SyncModeSelector';
import { RegistryAuthSection, RegistryAuthValue } from '../components/RegistryAuthSection';
import { GitSourceForm } from '../components/stack/GitSourceForm';
import { InlineSourceForm } from '../components/stack/InlineSourceForm';
import { SecuritySection } from '../components/stack/SecuritySection';
import { CreateMachineModal } from '../components/machine/CreateMachineModal';
import {
  ArrowLeft,
  Server,
  GitBranch,
  FileCode,
  Database,
  Loader2,
  Check,
  XCircle,
} from 'lucide-react';
import { clsx } from 'clsx';

interface CreateStackPageProps {
  initialMachine?: string | null;
  onBack: () => void;
  onLogout?: () => void;
}

export const CreateStackPage: React.FC<CreateStackPageProps> = ({ initialMachine, onBack, onLogout }) => {
  const queryClient = useQueryClient();

  const { data: machines } = useQuery({
    queryKey: ['machines'],
    queryFn: () => machinesApi.getMachines(),
  });

  const [mode, setMode] = useState<'git' | 'inline'>('git');
  
  // Base fields
  const [id, setId] = useState('');
  const [pollInterval, setPollInterval] = useState(60);
  const [envVars, setEnvVars] = useState('');
  const [registryAuth, setRegistryAuth] = useState<RegistryAuthValue>({
    registry_host: '',
    registry_user: '',
    registry_pass: '',
  });
  const [syncMode, setSyncMode] = useState<SyncMode>('poll');
  const [isProtected, setIsProtected] = useState(false);
  const [securityPin, setSecurityPin] = useState('');
  const [machineName, setMachineName] = useState(initialMachine || '');
  const [isMachineModalOpen, setIsMachineModalOpen] = useState(false);

  useEffect(() => {
    if (machines && machines.length > 0 && !machineName) {
      setMachineName(machines[0].Name);
    }
  }, [machines, machineName]);

  // Git specific fields
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [composePath, setComposePath] = useState('docker-compose.yml');
  const [patToken, setPatToken] = useState(() => localStorage.getItem('global_git_pat') || '');
  const [showPatToken, setShowPatToken] = useState(false);
  const [copiedPatToken, setCopiedPatToken] = useState(false);

  // Inline specific fields
  const [inlineCompose, setInlineCompose] = useState('version: "3.8"\nservices:\n  # Your services here\n');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await stacksApi.createStack({
        id: id.trim(),
        source_type: mode,
        inline_compose: mode === 'inline' ? inlineCompose.trim() : undefined,
        repo_url: mode === 'git' ? repoUrl.trim() : undefined,
        branch: mode === 'git' ? branch.trim() : undefined,
        compose_path: mode === 'git' ? composePath.trim() : undefined,
        poll_interval_secs: Number(pollInterval),
        pat_token: mode === 'git' ? (patToken.trim() || undefined) : undefined,
        env_vars: envVars.trim() || undefined,
        registry_host: registryAuth.registry_host.trim() || undefined,
        registry_user: registryAuth.registry_user.trim() || undefined,
        registry_pass: registryAuth.registry_pass.trim() || undefined,
        sync_mode: syncMode,
        is_protected: isProtected,
        security_pin: securityPin.trim() || undefined,
        machine_name: machineName.trim() || undefined,
      });

      if (mode === 'git' && patToken.trim()) {
        localStorage.setItem('global_git_pat', patToken.trim());
      }

      queryClient.invalidateQueries({ queryKey: STACKS_QUERY_KEY });
      onBack();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create stack');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell
      onRefresh={() => {}}
      isRefetching={false}
      onLogout={onLogout}
      pageTitle="Create New Stack"
      onAddStack={() => { window.location.hash = '#/stacks/new'; }}
    >
      {() => (
        <div className="flex-1 w-full px-6 py-6 font-sans">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-dark-900 border border-slate-800 text-slate-400 hover:text-slate-100 hover:border-slate-700 transition-all flex items-center gap-1.5 text-xs font-medium"
            >
              <ArrowLeft size={16} />
              <span>Cancel & Back</span>
            </button>
            <span className="text-slate-600">/</span>
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight font-sans">
              Add New OmniOps Stack
            </h1>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300 flex items-center justify-between">
              <span className="flex items-center gap-2 font-medium">
                <XCircle size={18} />
                {errorMsg}
              </span>
            </div>
          )}

          <div className="glass-panel rounded-2xl p-6 border border-slate-800 bg-dark-900/80 shadow-xl mb-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* ID Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Stack ID (alphanumeric, hyphens)</label>
                <div className="relative">
                  <Server size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. webapp-prod"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-dark-950 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>
              </div>

              {/* Machine Selection Field */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Machine</label>
                {machines?.length === 0 ? (
                  <div className="flex items-center justify-between p-3 bg-dark-900 border border-slate-800 rounded-xl">
                    <span className="text-sm text-slate-400">No machines found</span>
                    <button 
                      type="button" 
                      onClick={() => setIsMachineModalOpen(true)} 
                      className="px-3 py-1.5 bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 rounded-md text-xs font-semibold border border-brand-500/20"
                    >
                      Create New Machine
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Server size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <select
                        value={machineName}
                        onChange={(e) => setMachineName(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-dark-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500 transition-colors appearance-none cursor-pointer"
                        required
                      >
                        {machines?.map((m) => (
                          <option key={m.Name} value={m.Name}>
                            {m.Name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMachineModalOpen(true)}
                      className="text-xs text-brand-400 hover:text-brand-300 transition-colors font-semibold px-1"
                    >
                      + Create New Machine
                    </button>
                  </div>
                )}
              </div>

              {/* Mode Toggle */}
              <div className="flex items-center gap-2 p-1 bg-dark-950 border border-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setMode('git')}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all',
                    mode === 'git'
                      ? 'bg-brand-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-dark-900'
                  )}
                >
                  <GitBranch size={16} />
                  From Git Repository
                </button>
                <button
                  type="button"
                  onClick={() => setMode('inline')}
                  className={clsx(
                    'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all',
                    mode === 'inline'
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-dark-900'
                  )}
                >
                  <FileCode size={16} />
                  Manual Compose (Inline)
                </button>
              </div>

              {/* Mode-specific Fields */}
              {mode === 'git' ? (
                <GitSourceForm
                  repoUrl={repoUrl}
                  setRepoUrl={setRepoUrl}
                  branch={branch}
                  setBranch={setBranch}
                  composePath={composePath}
                  setComposePath={setComposePath}
                  patToken={patToken}
                  setPatToken={setPatToken}
                  showPatToken={showPatToken}
                  setShowPatToken={setShowPatToken}
                  copiedPatToken={copiedPatToken}
                  setCopiedPatToken={setCopiedPatToken}
                />
              ) : (
                <InlineSourceForm
                  inlineCompose={inlineCompose}
                  setInlineCompose={setInlineCompose}
                />
              )}

              {/* Common Fields */}
              <hr className="border-slate-800" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Sync Polling Interval (seconds)</label>
                  <input
                    type="number"
                    required
                    min={10}
                    value={pollInterval}
                    onChange={(e) => setPollInterval(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-dark-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                </div>

                <div>
                  <SyncModeSelector value={syncMode} onChange={setSyncMode} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Database size={14} className="text-slate-400" />
                  Custom Environment Variables (.env equivalent)
                </label>
                <textarea
                  placeholder="KEY=VALUE&#10;PORT=8080"
                  rows={3}
                  value={envVars}
                  onChange={(e) => setEnvVars(e.target.value)}
                  className="w-full p-3 bg-dark-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 placeholder-slate-700 focus:outline-none focus:border-brand-500 transition-colors resize-y"
                />
              </div>

              <RegistryAuthSection
                value={registryAuth}
                onChange={setRegistryAuth}
              />

              <SecuritySection
                isProtected={isProtected}
                setIsProtected={setIsProtected}
                securityPin={securityPin}
                setSecurityPin={setSecurityPin}
              />

              {/* Submit Button */}
              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Creating Stack...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Create Stack
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
          
          <CreateMachineModal
            isOpen={isMachineModalOpen}
            onClose={() => setIsMachineModalOpen(false)}
            onSuccess={(newName) => {
              setMachineName(newName);
              setIsMachineModalOpen(false);
            }}
            machines={machines || []}
          />
        </div>
      )}
    </AppShell>
  );
};

