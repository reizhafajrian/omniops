import React from 'react';
import { Lock } from 'lucide-react';
import { clsx } from 'clsx';

export interface SecuritySectionProps {
  isProtected: boolean;
  setIsProtected: (val: boolean) => void;
  securityPin: string;
  setSecurityPin: (val: string) => void;
}

export const SecuritySection: React.FC<SecuritySectionProps> = ({
  isProtected, setIsProtected,
  securityPin, setSecurityPin,
}) => {
  return (
    <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
      <label className="flex items-center gap-3 cursor-pointer mb-3">
        <div className="relative">
          <input
            type="checkbox"
            className="sr-only"
            checked={isProtected}
            onChange={(e) => setIsProtected(e.target.checked)}
          />
          <div className={clsx("block w-10 h-6 rounded-full transition-colors", isProtected ? 'bg-amber-500' : 'bg-slate-700')}></div>
          <div className={clsx("absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform", isProtected ? 'translate-x-4' : '')}></div>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-amber-400 flex items-center gap-1.5">
            <Lock size={14} /> Enable Stack Protection
          </span>
          <span className="text-xs text-slate-400 mt-0.5">Require PIN for destructive actions (Delete, Clean, Exec Shell)</span>
        </div>
      </label>

      {isProtected && (
        <div className="mt-3 pl-14">
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">Security PIN</label>
          <input
            type="password"
            placeholder="Enter PIN (e.g. 1234)"
            value={securityPin}
            onChange={(e) => setSecurityPin(e.target.value)}
            required={isProtected}
            className="w-full max-w-xs px-3 py-2 bg-dark-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
      )}
    </div>
  );
};
