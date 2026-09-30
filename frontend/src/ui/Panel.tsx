import React from 'react';

interface PanelProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
  footer?: React.ReactNode;
  variant?: 'default' | 'raised';
}

export const Panel: React.FC<PanelProps> = ({
  title,
  subtitle,
  actions,
  children,
  className = '',
  bodyClassName = '',
  headerClassName = '',
  footer,
  variant = 'default',
}) => {
  const baseBg = variant === 'raised' ? 'bg-[var(--color-raised)]' : 'bg-[var(--color-surface)]';

  return (
    <section
      className={`border border-[var(--color-line)] rounded-xl overflow-hidden transition-all duration-150 flex flex-col ${baseBg} ${className}`}
    >
      {(title || subtitle || actions) && (
        <div
          className={`px-5 py-4 border-b border-[var(--color-line)] flex items-center justify-between gap-4 flex-wrap ${headerClassName}`}
        >
          <div className="min-w-0">
            {title && (
              <h3 className="text-base font-semibold text-[var(--color-ink)] leading-snug tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-[var(--color-muted)] mt-0.5 leading-normal">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {actions}
            </div>
          )}
        </div>
      )}

      <div className={`p-5 flex-1 min-w-0 ${bodyClassName}`}>
        {children}
      </div>

      {footer && (
        <div className="px-5 py-3 border-t border-[var(--color-line)] bg-[var(--color-canvas)]/50 text-xs text-[var(--color-muted)] flex items-center justify-between">
          {footer}
        </div>
      )}
    </section>
  );
};
