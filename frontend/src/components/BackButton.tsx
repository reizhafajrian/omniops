import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { clsx } from 'clsx';

interface BackButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onClick: () => void;
}

export const BackButton: React.FC<BackButtonProps> = ({ onClick, className, ...props }) => {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center justify-center shrink-0",
        className
      )}
      aria-label="Go back"
      {...props}
    >
      <ArrowLeft size={20} />
    </button>
  );
};
