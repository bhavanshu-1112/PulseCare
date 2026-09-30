import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'ok' | 'info';

interface StatusBadgeProps {
  severity: SeverityLevel;
  label?: string;
  count?: number;
  size?: 'sm' | 'md';
  className?: string;
  showIcon?: boolean;
}

const severityConfig: Record<
  SeverityLevel,
  {
    icon: React.ComponentType<{ className?: string }>;
    defaultLabel: string;
    bgVar: string;
    textVar: string;
    borderVar: string;
  }
> = {
  critical: {
    icon: XCircle,
    defaultLabel: 'Critical',
    bgVar: 'var(--color-critical-bg)',
    textVar: 'var(--color-critical-text)',
    borderVar: 'var(--color-critical-line)',
  },
  high: {
    icon: AlertTriangle,
    defaultLabel: 'High Risk',
    bgVar: 'var(--color-high-bg)',
    textVar: 'var(--color-high-text)',
    borderVar: 'var(--color-high-line)',
  },
  medium: {
    icon: AlertCircle,
    defaultLabel: 'Moderate',
    bgVar: 'var(--color-medium-bg)',
    textVar: 'var(--color-medium-text)',
    borderVar: 'var(--color-medium-line)',
  },
  ok: {
    icon: CheckCircle2,
    defaultLabel: 'Normal',
    bgVar: 'var(--color-ok-bg)',
    textVar: 'var(--color-ok-text)',
    borderVar: 'var(--color-ok-line)',
  },
  info: {
    icon: Info,
    defaultLabel: 'Info',
    bgVar: 'var(--color-info-bg)',
    textVar: 'var(--color-info-text)',
    borderVar: 'var(--color-info-line)',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  severity,
  label,
  count,
  size = 'md',
  className = '',
  showIcon = true,
}) => {
  const config = severityConfig[severity] || severityConfig.info;
  const Icon = config.icon;
  const text = label || config.defaultLabel;

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-[11px] gap-1'
      : 'px-2.5 py-1 text-xs gap-1.5 font-medium';

  return (
    <span
      className={`inline-flex items-center rounded-full border leading-none transition-colors select-none ${sizeClasses} ${className}`}
      style={{
        backgroundColor: config.bgVar,
        color: config.textVar,
        borderColor: config.borderVar,
      }}
    >
      {showIcon && <Icon className={size === 'sm' ? 'w-3 h-3 flex-shrink-0' : 'w-3.5 h-3.5 flex-shrink-0'} />}
      <span className="truncate">{text}</span>
      {count !== undefined && (
        <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-black/10 dark:bg-white/10 tabular-nums">
          {count}
        </span>
      )}
    </span>
  );
};
