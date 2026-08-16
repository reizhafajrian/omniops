import React from 'react';
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  iconBgClass?: string;
  iconColorClass?: string;
  showProgress?: boolean;
  progressValue?: number;
  progressLabel?: string;
  progressText?: React.ReactNode;
  progressColorClass?: string;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  iconBgClass = "bg-primary/10",
  iconColorClass = "text-primary",
  showProgress = false,
  progressValue = 0,
  progressLabel = "Usage",
  progressText,
  progressColorClass,
  className
}) => {
  return (
    <div className={cn("bg-dark-900 border border-slate-800 rounded-xl p-6 flex items-center gap-5 shadow-sm hover:border-slate-700 transition-colors", className)}>
      <div className={cn("w-14 h-14 rounded-xl shrink-0 flex items-center justify-center", iconBgClass)}>
        <div className={iconColorClass}>
          {icon}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap justify-between items-baseline mb-1 gap-x-2 gap-y-0.5">
          <div className="text-sm text-slate-400 font-medium truncate shrink">{title}</div>
          <div className="text-sm font-bold text-white truncate shrink-0 max-w-full" title={typeof value === 'string' ? value : undefined}>{value}</div>
        </div>
        {showProgress && (
          <div className="mt-2.5">
            <div className="flex justify-between items-center mb-1.5 gap-2 min-w-0">
              <span className="text-xs text-slate-500 shrink-0">{progressLabel}</span>
              <span className="text-xs font-medium text-slate-300 truncate" title={typeof progressText === 'string' ? progressText : undefined}>{progressText}</span>
            </div>
            <Progress 
              value={Math.min(progressValue || 0, 100)} 
              className={cn("h-1.5", progressColorClass ? `[&>[data-slot=progress-indicator]]:${progressColorClass}` : "")} 
            />
          </div>
        )}
      </div>
    </div>
  );
};
