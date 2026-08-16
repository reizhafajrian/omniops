import React from 'react';

export interface InfoRowProps {
  label: string;
  value?: string;
  mono?: boolean;
}

export const InfoRow: React.FC<InfoRowProps> = ({ label, value, mono = false }) => (
  <div className="flex justify-between items-start gap-4 py-2.5 border-b border-white/[0.05] last:border-0">
    <span className="text-slate-500 text-sm shrink-0">{label}</span>
    <span className={`text-sm text-right text-slate-200 break-all ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
  </div>
);
