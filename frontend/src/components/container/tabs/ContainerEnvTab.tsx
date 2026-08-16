import React, { useState } from 'react';
import { Settings, Eye, EyeOff, Loader2 } from 'lucide-react';

export interface ContainerEnvTabProps {
  inspectData: any;
  inspectLoading: boolean;
}

const isSensitiveKey = (k: string) =>
  /password|secret|key|token|auth|pass|pwd|credential/i.test(k);

export const ContainerEnvTab: React.FC<ContainerEnvTabProps> = ({
  inspectData,
  inspectLoading,
}) => {
  const [showSensitiveEnv, setShowSensitiveEnv] = useState(false);

  if (inspectLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-600 gap-3">
        <Loader2 size={20} className="animate-spin" /> Loading environment...
      </div>
    );
  }

  if (!inspectData?.Config?.Env || inspectData.Config.Env.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-600">
        <Settings size={40} className="mb-3 opacity-30" />
        <p className="text-sm">No environment variables</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <span className="text-slate-400 text-sm">{inspectData.Config.Env.length} variables</span>
        <button
          onClick={() => setShowSensitiveEnv(v => !v)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors border border-white/[0.07] rounded-lg px-3 py-1.5"
        >
          {showSensitiveEnv ? <EyeOff size={13} /> : <Eye size={13} />}
          {showSensitiveEnv ? 'Hide sensitive' : 'Show sensitive'}
        </button>
      </div>
      <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl overflow-hidden">
        {inspectData.Config.Env.map((envStr: string, i: number) => {
          const eqIdx = envStr.indexOf('=');
          const key = eqIdx >= 0 ? envStr.substring(0, eqIdx) : envStr;
          const val = eqIdx >= 0 ? envStr.substring(eqIdx + 1) : '';
          const sensitive = isSensitiveKey(key);
          return (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.05] last:border-0 hover:bg-white/[0.02] transition-colors group"
            >
              {sensitive && (
                <span className="text-rose-400/60 shrink-0" title="Sensitive">
                  <Settings size={12} />
                </span>
              )}
              <span className="w-56 shrink-0 font-mono text-sm text-indigo-300 truncate" title={key}>{key}</span>
              <span className={`flex-1 font-mono text-sm text-slate-400 break-all ${sensitive && !showSensitiveEnv ? 'blur-sm select-none' : ''}`}>
                {val || <span className="italic text-slate-600">empty</span>}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
};
