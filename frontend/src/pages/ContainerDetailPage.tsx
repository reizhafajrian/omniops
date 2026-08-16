import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {  containersApi} from '@/api';;
import {
  Terminal,
  Activity,
  Database,
  ChevronRight,
  Container,
  Layers,
  Server,
  Settings,
} from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { BackButton } from '@/components/BackButton';
import { ContainerOverviewTab } from '@/components/container/tabs/ContainerOverviewTab';
import { ContainerVolumesTab } from '@/components/container/tabs/ContainerVolumesTab';
import { ContainerEnvTab } from '@/components/container/tabs/ContainerEnvTab';
import { ContainerLogsTab } from '@/components/container/tabs/ContainerLogsTab';
import { parseCpuPercent, parseMemPercent } from '@/lib/formatters';

interface ContainerDetailPageProps {
  machineName: string;
  containerId: string;
  onBack: () => void;
  onLogout: () => void;
}

type TabId = 'overview' | 'volumes' | 'env' | 'logs';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Activity size={15} /> },
  { id: 'volumes', label: 'Volumes', icon: <Database size={15} /> },
  { id: 'env', label: 'Environment', icon: <Settings size={15} /> },
  { id: 'logs', label: 'Live Logs', icon: <Terminal size={15} /> },
];

export const ContainerDetailPage: React.FC<ContainerDetailPageProps> = ({
  machineName,
  containerId,
  onBack,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [logsContent, setLogsContent] = useState<string>('');
  const [logsLoading, setLogsLoading] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['containerStats', containerId],
    queryFn: () => containersApi.getContainerStats(containerId),
    refetchInterval: 3000,
  });

  const { data: inspectData, isLoading: inspectLoading, refetch: refetchInspect } = useQuery({
    queryKey: ['containerInspect', containerId],
    queryFn: () => containersApi.inspectContainer(containerId),
    staleTime: 60000,
  });

  useEffect(() => {
    if (activeTab !== 'logs') return;
    let interval: ReturnType<typeof setInterval>;
    const fetchLogs = async () => {
      try {
        const res = await containersApi.getContainerLogs(containerId);
        setLogsContent(res.logs || 'No logs available.');
        setLogsLoading(false);
      } catch (e) {
        console.error(e);
      }
    };
    setLogsLoading(true);
    fetchLogs();
    interval = setInterval(fetchLogs, 5000);
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [containerId, activeTab]);

  const containerName =
    inspectData?.Name?.replace(/^\//, '') ||
    inspectData?.Names?.[0]?.replace(/^\//, '') ||
    containerId.substring(0, 12);

  const isRunning = inspectData?.State?.Status === 'running' || inspectData?.State?.Running === true;
  const cpuPct = parseCpuPercent(stats?.cpu_percent || '');
  const memPct = parseMemPercent(stats?.mem_usage || '');
  const shortId = containerId.substring(0, 12);

  return (
    <AppShell
      onLogout={onLogout}
      onRefresh={() => refetchInspect()}
      isRefetching={inspectLoading}
      pageTitle="Container Details"
    >
      {() => (
        <div className="max-w-7xl mx-auto space-y-6">

          {/* ── HEADER ──────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <BackButton onClick={onBack} />
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="text-slate-400 font-medium tracking-tight flex items-center gap-1.5">
                <Server size={14} className="text-emerald-500" />
                {machineName}
              </span>
              <ChevronRight size={14} className="opacity-50" />
              <span className="text-slate-300 font-mono font-semibold">{containerName}</span>
            </div>
          </div>

          {/* ── HERO HEADER ────────────────────────────────── */}
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 p-6">
            <div className="absolute top-0 right-0 w-80 h-80 rounded-full pointer-events-none"
              style={{ background: isRunning ? 'radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(100,116,139,0.06) 0%, transparent 70%)' }} />

            <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${isRunning ? 'bg-emerald-500/10 shadow-lg shadow-emerald-500/10' : 'bg-slate-700/40'}`}>
                <Container size={28} className={isRunning ? 'text-emerald-400' : 'text-slate-400'} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-white font-mono truncate">{containerName}</h1>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    isRunning
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                      : 'bg-slate-700/50 text-slate-400 border border-slate-600/30'
                  }`}>
                    {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                    {inspectData?.State?.Status || 'unknown'}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  <span className="text-slate-500 text-sm font-mono">{shortId}</span>
                  {inspectData?.Config?.Image && (
                    <span className="text-slate-500 text-sm flex items-center gap-1">
                      <Layers size={12} />
                      {inspectData.Config.Image}
                    </span>
                  )}
                </div>
              </div>

              {isRunning && (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 shrink-0">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                  </span>
                  <span className="text-emerald-400 text-sm font-medium">Live</span>
                </div>
              )}
            </div>
          </div>

          {/* ── TABS NAV ───────────────────────────────────── */}
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-indigo-500/20 text-indigo-300 shadow-lg shadow-indigo-500/10'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── TAB CONTENT ────────────────────────────────── */}
          {activeTab === 'overview' && (
            <ContainerOverviewTab
              containerId={containerId}
              cpuPct={cpuPct}
              memPct={memPct}
              stats={stats}
              statsLoading={statsLoading}
              inspectData={inspectData}
              inspectLoading={inspectLoading}
            />
          )}

          {activeTab === 'volumes' && (
            <ContainerVolumesTab
              inspectData={inspectData}
              inspectLoading={inspectLoading}
            />
          )}

          {activeTab === 'env' && (
            <ContainerEnvTab
              inspectData={inspectData}
              inspectLoading={inspectLoading}
            />
          )}

          {activeTab === 'logs' && (
            <ContainerLogsTab
              containerName={containerName}
              logsContent={logsContent}
              logsLoading={logsLoading}
            />
          )}

        </div>
      )}
    </AppShell>
  );
};

