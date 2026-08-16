import React, { useState } from 'react';
import { Stack } from '../types';
import { useStackHistory, useStackServices, useUpdateStack } from '../hooks/useStacks';
import { StatusBadge } from './StatusBadge';
import { SyncButton } from './SyncButton';
import { RollbackButton } from './RollbackButton';
import { LogTerminal } from './LogTerminal';
import { ExecTerminal } from './ExecTerminal';
import { HistoryTable } from './HistoryTable';
import {
  X,
  Terminal,
  History,
  GitBranch,
  FileCode,
  ShieldCheck,
  Boxes,
  Code,
  Settings,
  Check,
  Loader2,
  Key,
  Server
} from 'lucide-react';
import { clsx } from 'clsx';

interface StackDetailModalProps {
  stack: Stack | null;
  initialTab?: 'services' | 'logs' | 'exec' | 'history' | 'edit';
  onClose: () => void;
}

export const StackDetailModal: React.FC<StackDetailModalProps> = ({
  stack,
  initialTab = 'services',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'services' | 'logs' | 'exec' | 'history' | 'edit'>(initialTab);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [execService, setExecService] = useState<string | null>(null);

  // Edit form state
  const [editBranch, setEditBranch] = useState(stack?.config.branch || 'main');
  const [editComposePath, setEditComposePath] = useState(stack?.config.compose_path || 'docker-compose.yml');
  const [editPollInterval, setEditPollInterval] = useState(stack?.config.poll_interval_secs || 60);
  const [editPatToken, setEditPatToken] = useState('');
  const [editSuccessMsg, setEditSuccessMsg] = useState<string | null>(null);

  const historyQuery = useStackHistory(stack ? stack.config.id : null);
  const servicesQuery = useStackServices(stack ? stack.config.id : null);
  const updateMutation = useUpdateStack();

  if (!stack) return null;

  const { config, state, last_synced_commit, last_known_good_commit } = stack;
  const services = servicesQuery.data?.services || [];

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setEditSuccessMsg(null);

    updateMutation.mutate(
      {
        stackId: config.id,
        input: {
          branch: editBranch.trim(),
          compose_path: editComposePath.trim(),
          poll_interval_secs: Number(editPollInterval),
          pat_token: editPatToken.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setEditSuccessMsg('Stack configuration updated successfully!');
          setTimeout(() => setEditSuccessMsg(null), 3000);
        },
      }
    );
  };

  const handleOpenLogs = (serviceName?: string) => {
    setSelectedService(serviceName || null);
    setActiveTab('logs');
  };

  const handleOpenExec = (serviceName: string) => {
    setExecService(serviceName);
    setActiveTab('exec');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6">
      <div className="bg-dark-900 border border-slate-800 rounded-2xl max-w-5xl w-full h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-dark-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-100 font-sans tracking-tight">
              {config.id}
            </h2>
            <StatusBadge state={state} size="md" />
          </div>

          <div className="flex items-center gap-3">
            <RollbackButton
              stackId={config.id}
              currentState={state}
              lastKnownGoodCommit={last_known_good_commit}
              size="sm"
            />
            <SyncButton
              stackId={config.id}
              currentState={state}
              size="sm"
            />

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors ml-2"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Sub-Header Metadata Bar */}
        <div className="px-6 py-3 bg-dark-900/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs font-mono shrink-0">
          <div className="flex items-center gap-4 text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <GitBranch size={13} className="text-brand-400" />
              <span>{config.branch}</span>
            </span>

            <span className="flex items-center gap-1.5 text-slate-400">
              <FileCode size={13} className="text-indigo-400" />
              <span>{config.compose_path}</span>
            </span>

            {config.auth && (
              <span className="flex items-center gap-1 text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                <ShieldCheck size={11} /> PAT Configured
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-slate-400">
              Commit: <strong className="text-slate-200">{last_synced_commit ? last_synced_commit.slice(0, 7) : 'None'}</strong>
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 border-b border-slate-800 bg-dark-950/40 shrink-0">
          <button
            onClick={() => setActiveTab('services')}
            className={clsx(
              'flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all',
              activeTab === 'services'
                ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            )}
          >
            <Boxes size={15} />
            <span>Services & Containers ({services.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={clsx(
              'flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all',
              activeTab === 'logs'
                ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            )}
          >
            <Terminal size={15} />
            <span>Container Logs</span>
          </button>

          {execService && (
            <button
              onClick={() => setActiveTab('exec')}
              className={clsx(
                'flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all',
                activeTab === 'exec'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              )}
            >
              <Code size={15} />
              <span>Shell Exec ({execService})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('history')}
            className={clsx(
              'flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all',
              activeTab === 'history'
                ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            )}
          >
            <History size={15} />
            <span>Audit Log History</span>
          </button>

          <button
            onClick={() => setActiveTab('edit')}
            className={clsx(
              'flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all',
              activeTab === 'edit'
                ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            )}
          >
            <Settings size={15} />
            <span>Edit Configuration</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 p-6 overflow-y-auto bg-dark-900">
          {/* TAB 1: Services Breakdown */}
          {activeTab === 'services' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-200 font-sans flex items-center gap-2">
                  <Server size={16} className="text-brand-400" />
                  Compose Applications & Services
                </h3>
                <span className="text-xs text-slate-400">
                  Auto-updated live status
                </span>
              </div>

              {servicesQuery.isLoading && (
                <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
                  <Loader2 size={24} className="animate-spin text-brand-400" />
                  <span className="text-xs">Detecting running compose services...</span>
                </div>
              )}

              {!servicesQuery.isLoading && services.length === 0 && (
                <div className="p-8 rounded-xl bg-dark-950 border border-slate-800 text-center">
                  <p className="text-sm text-slate-400">No active services detected in Docker daemon.</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Click <strong>Sync Now</strong> above to start your Docker Compose stack.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((svc) => (
                  <div
                    key={svc.name}
                    className="p-4 rounded-xl bg-dark-950 border border-slate-800/80 flex flex-col justify-between shadow-lg hover:border-slate-700 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                          <h4 className="text-sm font-bold text-slate-100 font-mono">
                            {svc.service || svc.name}
                          </h4>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                          {svc.status}
                        </span>
                      </div>

                      <p className="text-xs font-mono text-slate-400 truncate mb-1">
                        Container: {svc.name}
                      </p>

                      {svc.ports && (
                        <p className="text-xs font-mono text-indigo-300/90 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded">
                          Ports: {svc.ports}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800/80">
                      <button
                        onClick={() => handleOpenLogs(svc.service || svc.name)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-dark-900 border border-slate-800 hover:border-slate-700 text-slate-200 rounded-lg transition-colors"
                      >
                        <Terminal size={13} className="text-brand-400" />
                        <span>Logs</span>
                      </button>

                      <button
                        onClick={() => handleOpenExec(svc.service || svc.name)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300 rounded-lg transition-colors"
                      >
                        <Code size={13} />
                        <span>Terminal Exec</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: Container Logs */}
          {activeTab === 'logs' && (
            <div className="flex flex-col h-full space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400 font-medium">Filter Log Service:</label>
                  <select
                    value={selectedService || ''}
                    onChange={(e) => setSelectedService(e.target.value || null)}
                    className="px-3 py-1.5 text-xs font-mono bg-dark-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">All Services (Stack Output)</option>
                    {services.map((s) => (
                      <option key={s.name} value={s.service || s.name}>
                        {s.service || s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex-1 min-h-[420px]">
                <LogTerminal stackId={config.id} service={selectedService || undefined} />
              </div>
            </div>
          )}

          {/* TAB 3: Interactive Shell Exec */}
          {activeTab === 'exec' && execService && (
            <div className="h-full min-h-[420px]">
              <ExecTerminal stackId={config.id} service={execService} />
            </div>
          )}

          {/* TAB 4: Audit History */}
          {activeTab === 'history' && (
            <div className="h-full min-h-[400px]">
              <HistoryTable
                events={historyQuery.data || []}
                isLoading={historyQuery.isLoading}
              />
            </div>
          )}

          {/* TAB 5: Edit Configuration */}
          {activeTab === 'edit' && (
            <form onSubmit={handleUpdate} className="max-w-xl space-y-4 font-sans">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Settings size={16} className="text-brand-400" />
                Update Stack Settings
              </h3>

              {editSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                  <Check size={14} /> {editSuccessMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Tracked Branch
                </label>
                <input
                  type="text"
                  value={editBranch}
                  onChange={(e) => setEditBranch(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-dark-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Compose File Path
                </label>
                <input
                  type="text"
                  value={editComposePath}
                  onChange={(e) => setEditComposePath(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-dark-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Poll Interval (seconds)
                </label>
                <input
                  type="number"
                  min="10"
                  value={editPollInterval}
                  onChange={(e) => setEditPollInterval(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono bg-dark-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1">
                  <Key size={12} className="text-amber-400" /> Update GitHub Personal Access Token (PAT)
                </label>
                <input
                  type="password"
                  value={editPatToken}
                  onChange={(e) => setEditPatToken(e.target.value)}
                  placeholder="Paste new token to update (optional)"
                  className="w-full px-3 py-2 text-xs font-mono bg-dark-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white rounded-xl shadow-lg transition-all disabled:opacity-50"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Save Configuration
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
