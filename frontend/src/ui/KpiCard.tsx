import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { StatusBadge, SeverityLevel } from './StatusBadge';

export interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  secondaryValue?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
    isGood?: boolean;
  };
  severity?: SeverityLevel;
  icon?: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  secondaryValue,
  trend,
  severity,
  icon: Icon,
  onClick,
  className = '',
}) => {
  const isClickable = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      className={`bg-[var(--color-surface)] border border-[var(--color-line)] rounded-xl p-5 transition-all duration-150 flex flex-col justify-between ${
        isClickable ? 'cursor-pointer hover:border-[var(--color-brand)]/50 focus-visible:border-[var(--color-brand)]' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-[var(--color-raised)] border border-[var(--color-line)] flex items-center justify-center text-[var(--color-muted)] flex-shrink-0">
              <Icon className="w-4 h-4" />
            </div>
          )}
          <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
            {title}
          </span>
        </div>

        {severity && <StatusBadge severity={severity} size="sm" />}
      </div>

      <div className="my-1 flex items-baseline justify-between gap-2">
        <div className="text-2xl font-bold tracking-tight text-[var(--color-ink)] tabular-nums">
          {value}
        </div>
        {secondaryValue && (
          <span className="text-xs text-[var(--color-muted)] tabular-nums font-medium">
            {secondaryValue}
          </span>
        )}
      </div>

      {(subtitle || trend) && (
        <div className="mt-2 pt-2 border-t border-[var(--color-line-subtle)] flex items-center justify-between gap-2 text-xs text-[var(--color-muted)]">
          {subtitle && <span className="truncate">{subtitle}</span>}
          {trend && (
            <span
              className={`inline-flex items-center gap-0.5 font-medium tabular-nums ${
                trend.direction === 'neutral'
                  ? 'text-[var(--color-muted)]'
                  : trend.isGood
                  ? 'text-[var(--color-ok-text)]'
                  : 'text-[var(--color-critical-text)]'
              }`}
            >
              {trend.direction === 'up' && <ArrowUpRight className="w-3.5 h-3.5" />}
              {trend.direction === 'down' && <ArrowDownRight className="w-3.5 h-3.5" />}
              {trend.direction === 'neutral' && <Minus className="w-3.5 h-3.5" />}
              {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
