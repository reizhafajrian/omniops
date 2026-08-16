import React, { useState } from 'react';
import { SyncEvent, EventKind } from '../types';
import { Clock, CheckCircle2, XCircle, GitCommit, Play, RotateCcw, AlertCircle, Eye, X, AlertTriangle, Terminal } from 'lucide-react';
import { clsx } from 'clsx';

interface HistoryTableProps {
  events: SyncEvent[];
  isLoading?: boolean;
}

export const HistoryTable: React.FC<HistoryTableProps> = ({ events, isLoading }) => {
  const [selectedError, setSelectedError] = useState<{ commit: string; message: string; timestamp: string } | null>(null);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-400">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-brand-500 border-t-transparent mb-2"></div>
        <p className="text-xs font-mono">Loading reconciliation history...</p>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl bg-dark-950/50">
        <Clock className="mx-auto mb-2 opacity-50" size={24} />
        <p className="text-sm font-medium">No sync history recorded yet</p>
        <p className="text-xs text-slate-600 mt-1">Reconciliation events will appear here automatically after polls or sync triggers.</p>
      </div>
    );
  }

  const renderKindBadge = (kind: EventKind) => {
    switch (kind) {
      case 'scheduled_sync':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
            <Clock size={10} /> Scheduled Poll
          </span>
        );
      case 'manual_sync':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
            <Play size={10} /> Manual Trigger
          </span>
        );
      case 'rollback':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
            <RotateCcw size={10} /> Rollback
          </span>
        );
      case 'out_of_sync_detected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/30">
            <AlertCircle size={10} /> Change Detected
          </span>
        );
      default:
        return <span className="text-xs text-slate-400">{kind}</span>;
    }
  };

  return (
    <>
      {/* Full Error Detail Modal */}
      {selectedError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl glass-panel border border-rose-500/30 rounded-3xl p-6 bg-dark-900/95 shadow-2xl shadow-rose-500/10 space-y-4">
            <button
              onClick={() => setSelectedError(null)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-dark-800 transition-colors"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100 font-sans">
                  Docker Compose Failure Audit Log
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Commit: <span className="text-brand-400 font-semibold">{selectedError.commit}</span> &bull; {new Date(selectedError.timestamp).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-dark-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
                  <Terminal size={13} /> Full CLI & Daemon Trace
                </span>
                <span className="text-[10px] text-slate-500">docker compose stderr / stdout</span>
              </div>

              <pre className="p-3.5 rounded-xl bg-dark-900 border border-rose-500/20 font-mono text-xs text-rose-300 leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-72">
                {selectedError.message}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedError(null)}
                className="px-4 py-2 text-xs font-semibold bg-dark-950 border border-slate-800 hover:bg-slate-800 text-slate-200 rounded-xl transition-all"
              >
                Close Audit Detail
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full overflow-hidden rounded-xl border border-slate-800 bg-dark-950 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-dark-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Trigger</th>
                <th className="py-3 px-4">Commit Target</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Details / Error Log</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
              {events.map((event) => (
                <tr
                  key={event.id}
                  className={clsx(
                    'hover:bg-slate-800/30 transition-colors',
                    !event.success && 'bg-rose-950/10'
                  )}
                >
                  {/* Status Column */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {event.success ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-400 font-sans font-medium">
                        <CheckCircle2 size={14} /> Success
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-rose-400 font-sans font-medium">
                        <XCircle size={14} /> Failed
                      </span>
                    )}
                  </td>

                  {/* Trigger Kind Column */}
                  <td className="py-3 px-4 font-sans whitespace-nowrap">
                    {renderKindBadge(event.kind)}
                  </td>

                  {/* Commit Hash Column */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-brand-300 text-xs">
                      <GitCommit size={12} className="text-slate-500" />
                      <span>{event.short_commit}</span>
                    </div>
                  </td>

                  {/* Created At Timestamp */}
                  <td className="py-3 px-4 text-slate-400 font-sans whitespace-nowrap">
                    {new Date(event.created_at).toLocaleString()}
                  </td>

                  {/* Error details column */}
                  <td className="py-3 px-4 font-sans text-xs">
                    {event.error_message ? (
                      <button
                        onClick={() =>
                          setSelectedError({
                            commit: event.short_commit,
                            message: event.error_message!,
                            timestamp: event.created_at,
                          })
                        }
                        className="text-left group/err block w-full"
                        title="Click to view full un-truncated error log"
                      >
                        <span className="text-rose-300 bg-rose-500/10 border border-rose-500/30 group-hover/err:border-rose-400 px-2.5 py-1 rounded inline-flex items-center gap-1.5 font-mono text-[11px] max-w-md truncate transition-all">
                          <Eye size={12} className="shrink-0 text-rose-400" />
                          <span className="truncate">{event.error_message}</span>
                        </span>
                      </button>
                    ) : (
                      <span className="text-slate-500 italic">No errors</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};
