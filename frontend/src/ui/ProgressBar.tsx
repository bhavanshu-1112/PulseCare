import React from 'react';
import { SeverityLevel } from './StatusBadge';

interface ProgressBarProps {
  value: number; // 0 to 100
  max?: number;
  label?: string;
  sublabel?: string;
  showPercent?: boolean;
  severity?: SeverityLevel;
  height?: 'sm' | 'md' | 'lg';
  thresholds?: {
    warning?: number;
    critical?: number;
  };
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  sublabel,
  showPercent = true,
  severity,
  height = 'md',
  thresholds,
  className = '',
}) => {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  // Auto determine severity if not explicitly provided
  let effectiveSeverity: SeverityLevel = severity || 'ok';
  if (!severity && thresholds) {
    if (thresholds.critical !== undefined && percentage >= thresholds.critical) {
      effectiveSeverity = 'critical';
    } else if (thresholds.warning !== undefined && percentage >= thresholds.warning) {
      effectiveSeverity = 'high';
    }
  }

  const colorMap: Record<SeverityLevel, string> = {
    critical: 'bg-[var(--color-critical)]',
    high: 'bg-[var(--color-high)]',
    medium: 'bg-[var(--color-medium)]',
    ok: 'bg-[var(--color-ok)]',
    info: 'bg-[var(--color-brand)]',
  };

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {(label || showPercent || sublabel) && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            {label && <span className="font-medium text-[var(--color-ink)]">{label}</span>}
            {sublabel && <span className="text-[var(--color-muted)]">({sublabel})</span>}
          </div>
          {showPercent && (
            <span className="font-semibold tabular-nums text-[var(--color-ink)]">
              {percentage}%
            </span>
          )}
        </div>
      )}

      <div
        className={`w-full bg-[var(--color-line)] rounded-full overflow-hidden ${heightClasses[height]}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${colorMap[effectiveSeverity]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
