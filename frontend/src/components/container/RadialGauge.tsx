import React from 'react';
import { Loader2 } from 'lucide-react';

export interface RadialGaugeProps {
  percent: number | null;
  label: string;
  value: string;
  color: string;
  icon: React.ReactNode;
  loading: boolean;
}

export const RadialGauge: React.FC<RadialGaugeProps> = ({ percent, label, value, color, icon, loading }) => {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const dash = percent != null ? (percent / 100) * circ : 0;
  return (
    <div className="relative flex flex-col items-center justify-center gap-2 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.07] hover:border-white/[0.14] transition-all duration-300 group">
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `radial-gradient(circle at 50% 0%, ${color}18 0%, transparent 70%)` }} />
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          {/* Track */}
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          {/* Progress */}
          {!loading && percent != null && (
            <circle
              cx="50" cy="50" r={r}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ - dash}`}
              style={{ transition: 'stroke-dasharray 0.8s ease' }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {loading ? (
            <Loader2 size={18} className="animate-spin text-slate-500" />
          ) : (
            <>
              <span className="text-lg font-bold text-white leading-none">
                {percent != null ? `${percent.toFixed(1)}%` : '—'}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <div className="text-xs text-slate-500 font-mono text-center truncate max-w-full px-1">{loading ? '—' : (value || '—')}</div>
    </div>
  );
};
