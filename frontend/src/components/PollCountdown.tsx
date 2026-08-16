import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { clsx } from 'clsx';

interface PollCountdownProps {
  intervalSecs: number;
  size?: 'sm' | 'md';
  isPaused?: boolean;
}

export const PollCountdown: React.FC<PollCountdownProps> = ({
  intervalSecs,
  size = 'md',
  isPaused = false,
}) => {
  const [timeLeft, setTimeLeft] = useState(intervalSecs);

  useEffect(() => {
    setTimeLeft(intervalSecs);
  }, [intervalSecs]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (isPaused) return;
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return intervalSecs;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [intervalSecs, isPaused]);

  // Calculate percentage for SVG ring
  const percentage = Math.max(0, Math.min(100, (timeLeft / intervalSecs) * 100));
  const strokeDashoffset = 100 - percentage;

  if (isPaused) {
    return (
      <div
        title="Automated sync is paused because the stack is stopped"
        className={clsx(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono bg-dark-950 border border-slate-800 text-slate-500 shadow-sm transition-all shrink-0 whitespace-nowrap',
          size === 'sm' ? 'text-[10px]' : 'text-xs'
        )}
      >
        <div className="relative w-3.5 h-3.5 flex items-center justify-center shrink-0">
          <svg className="w-full h-full" viewBox="0 0 24 24">
             <rect x="6" y="4" width="4" height="16" fill="currentColor" />
             <rect x="14" y="4" width="4" height="16" fill="currentColor" />
          </svg>
        </div>
        <span>Paused</span>
      </div>
    );
  }

  return (
    <div
      title={`Automated Git reconciliation poll interval: ${intervalSecs}s (Next check in ${timeLeft}s)`}
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono bg-dark-950 border border-slate-800 text-slate-300 shadow-sm transition-all shrink-0 whitespace-nowrap',
        size === 'sm' ? 'text-[10px]' : 'text-xs'
      )}
    >
      <div className="relative w-3.5 h-3.5 flex items-center justify-center shrink-0">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          <path
            className="text-slate-800"
            strokeWidth="4"
            stroke="currentColor"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            className={clsx(
              'transition-all duration-1000 ease-linear',
              timeLeft <= 5 ? 'text-emerald-400' : 'text-brand-400'
            )}
            strokeDasharray="100, 100"
            strokeDashoffset={strokeDashoffset}
            strokeWidth="4"
            strokeLinecap="round"
            stroke="currentColor"
            fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
      </div>

      <Clock size={size === 'sm' ? 10 : 11} className="text-slate-400 shrink-0" />
      <span>{timeLeft}s</span>
    </div>
  );
};
