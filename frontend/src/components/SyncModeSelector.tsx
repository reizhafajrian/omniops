import React from 'react';
import { Timer, Webhook, Shuffle } from 'lucide-react';

export type SyncMode = 'poll' | 'webhook' | 'both';

interface SyncModeSelectorProps {
  value: SyncMode;
  onChange: (mode: SyncMode) => void;
}

const MODES: {
  key: SyncMode;
  label: string;
  desc: string;
  icon: React.ReactNode;
  activeClass: string;
}[] = [
  {
    key: 'poll',
    label: 'Polling',
    desc: 'Periodic git check',
    icon: <Timer size={15} />,
    activeClass: 'bg-brand-500/20 border-brand-500 text-brand-300',
  },
  {
    key: 'webhook',
    label: 'Webhook',
    desc: 'Push-triggered deploy',
    icon: <Webhook size={15} />,
    activeClass: 'bg-indigo-500/20 border-indigo-500 text-indigo-300',
  },
  {
    key: 'both',
    label: 'Poll + Webhook',
    desc: 'Dual-trigger mode',
    icon: <Shuffle size={15} />,
    activeClass: 'bg-emerald-500/20 border-emerald-500 text-emerald-300',
  },
];

export const SyncModeSelector: React.FC<SyncModeSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="grid grid-cols-3 gap-2">
      {MODES.map((mode) => {
        const isActive = value === mode.key;
        return (
          <button
            key={mode.key}
            type="button"
            onClick={() => onChange(mode.key)}
            className={`flex flex-col items-center gap-1 px-3 py-2.5 text-xs font-medium rounded-xl border text-center transition-all ${
              isActive
                ? mode.activeClass + ' font-bold shadow-md'
                : 'bg-dark-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <span className={isActive ? '' : 'text-slate-500'}>{mode.icon}</span>
            <span className="font-semibold">{mode.label}</span>
            <span className={`text-[10px] font-normal ${isActive ? 'opacity-80' : 'text-slate-600'}`}>
              {mode.desc}
            </span>
          </button>
        );
      })}
    </div>
  );
};
