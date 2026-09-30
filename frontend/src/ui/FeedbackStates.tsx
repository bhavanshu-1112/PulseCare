import React from 'react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';

/* ─── Skeleton Loading ─── */
interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse bg-[var(--color-line)] rounded ${className}`}
    />
  );
};

/* ─── Empty State ─── */
interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 border border-dashed border-[var(--color-line)] rounded-xl bg-[var(--color-surface)]/50 ${className}`}
    >
      <div className="w-10 h-10 rounded-full bg-[var(--color-raised)] flex items-center justify-center text-[var(--color-muted)] mb-3">
        <Icon className="w-5 h-5" />
      </div>
      <h4 className="text-sm font-semibold text-[var(--color-ink)] mb-1">{title}</h4>
      {description && (
        <p className="text-xs text-[var(--color-muted)] max-w-sm mb-4 leading-normal">
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
};

/* ─── Error State ─── */
interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load data',
  message = 'An unexpected error occurred while contacting the server.',
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 border border-[var(--color-critical-line)] rounded-xl bg-[var(--color-critical-bg)] text-[var(--color-critical-text)] ${className}`}
    >
      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-3">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <h4 className="text-sm font-semibold mb-1">{title}</h4>
      <p className="text-xs opacity-90 max-w-sm mb-4 leading-normal">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/90 hover:bg-white text-xs font-semibold text-[var(--color-critical-text)] rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
};
