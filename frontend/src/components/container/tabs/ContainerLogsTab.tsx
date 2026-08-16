import React, { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

export interface ContainerLogsTabProps {
  containerName: string;
  logsContent: string;
  logsLoading: boolean;
}

export const ContainerLogsTab: React.FC<ContainerLogsTabProps> = ({
  containerName,
  logsContent,
  logsLoading,
}) => {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logsContent]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-slate-500 text-xs">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400" />
        </span>
        Auto-refreshing every 5 seconds
      </div>
      <div
        className="relative bg-[#0a0a0f] border border-white/[0.06] rounded-2xl overflow-hidden"
        style={{ minHeight: '480px' }}
      >
        {/* Terminal chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.01]">
          <span className="w-3 h-3 rounded-full bg-rose-500/60" />
          <span className="w-3 h-3 rounded-full bg-amber-500/60" />
          <span className="w-3 h-3 rounded-full bg-emerald-500/60" />
          <span className="ml-4 text-slate-600 text-xs font-mono">{containerName} — stdout</span>
        </div>
        <div className="overflow-auto p-5 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed" style={{ maxHeight: '560px' }}>
          {logsLoading && !logsContent ? (
            <div className="flex items-center gap-3 text-slate-600 py-8">
              <Loader2 size={16} className="animate-spin" /> Fetching logs...
            </div>
          ) : (
            <>
              {logsContent ? (
                logsContent.split('\n').map((line, i) => (
                  <div key={i} className={`hover:bg-white/[0.02] px-1 rounded ${
                    line.toLowerCase().includes('error') || line.toLowerCase().includes('fatal')
                      ? 'text-rose-300'
                      : line.toLowerCase().includes('warn')
                      ? 'text-amber-300'
                      : ''
                  }`}>
                    {line || '\u00A0'}
                  </div>
                ))
              ) : (
                <span className="text-slate-600 italic">No output available.</span>
              )}
              <div ref={logsEndRef} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
