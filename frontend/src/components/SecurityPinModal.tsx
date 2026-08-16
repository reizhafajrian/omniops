import React, { useState } from 'react';
import { Lock, X, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';
import {    stacksApi } from '../api';;

interface SecurityPinModalProps {
  isOpen: boolean;
  stackId: string;
  stackName: string;
  onClose: () => void;
  onUnlockSuccess: () => void;
}

export const SecurityPinModal: React.FC<SecurityPinModalProps> = ({
  isOpen,
  stackId,
  stackName,
  onClose,
  onUnlockSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleDigitClick = (digit: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + digit);
      setErrorMsg(null);
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pin.trim()) {
      setErrorMsg('Please enter a valid Security PIN');
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);

    try {
      const res = await stacksApi.verifyStackPin(stackId, pin.trim());
      if (res.valid) {
        // Save unlocked state in session storage for smooth experience
        sessionStorage.setItem(`stack_unlocked_${stackId}`, 'true');
        onUnlockSuccess();
        setPin('');
      } else {
        setErrorMsg(res.error || 'Incorrect Security PIN code');
        setPin('');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to verify Security PIN');
      setPin('');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm glass-panel border border-amber-500/30 rounded-3xl p-6 bg-dark-900/95 shadow-2xl shadow-amber-500/10 space-y-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-dark-800 transition-colors"
        >
          <X size={16} />
        </button>

        {/* Header Icon & Title */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20">
            <Lock size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100 font-sans">
              Protected Stack Security PIN
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Stack: <span className="text-amber-300 font-semibold">{stackName}</span>
            </p>
          </div>
          <p className="text-xs text-slate-400">
            This sensitive stack is locked. Enter the Security PIN code to unlock container logs, shell exec, and settings.
          </p>
        </div>

        {/* Error Message Alert */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-medium animate-in slide-in-from-top-1">
            <AlertTriangle size={14} className="shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* PIN Input Dots */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-center items-center gap-3 py-2">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full border transition-all ${
                  pin.length > idx
                    ? 'bg-amber-400 border-amber-400 shadow-md shadow-amber-400/40 scale-110'
                    : 'bg-dark-950 border-slate-700'
                }`}
              />
            ))}
          </div>

          <input
            type="password"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter PIN (e.g. 1234)"
            className="w-full text-center text-lg tracking-[0.5em] font-mono px-4 py-2.5 bg-dark-950 border border-slate-800 rounded-xl text-amber-300 placeholder-slate-600 focus:outline-none focus:border-amber-500"
          />

          {/* On-screen Keypad */}
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigitClick(digit)}
                className="py-2.5 text-sm font-bold font-mono bg-dark-950 border border-slate-800 hover:border-amber-500/50 hover:bg-amber-500/10 text-slate-200 rounded-xl transition-all active:scale-95"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleDelete}
              className="py-2.5 text-xs font-semibold bg-dark-950 border border-slate-800 hover:bg-slate-800 text-slate-400 rounded-xl transition-all"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleDigitClick('0')}
              className="py-2.5 text-sm font-bold font-mono bg-dark-950 border border-slate-800 hover:border-amber-500/50 hover:bg-amber-500/10 text-slate-200 rounded-xl transition-all active:scale-95"
            >
              0
            </button>
            <button
              type="submit"
              disabled={isVerifying || !pin.trim()}
              className="py-2.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-dark-950 rounded-xl shadow-md transition-all font-bold flex items-center justify-center gap-1 disabled:opacity-40"
            >
              {isVerifying ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              <span>Unlock</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
