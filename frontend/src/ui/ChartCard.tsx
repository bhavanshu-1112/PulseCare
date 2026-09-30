import React from 'react';
import { Panel } from './Panel';
import { EmptyState } from './FeedbackStates';
import { BarChart2 } from 'lucide-react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  legend?: React.ReactNode;
  children: React.ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
  height?: number | string;
  className?: string;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  actions,
  legend,
  children,
  isEmpty = false,
  emptyMessage = 'No chart data available',
  height = 280,
  className = '',
}) => {
  return (
    <Panel
      title={title}
      subtitle={subtitle}
      actions={actions}
      className={className}
      bodyClassName="flex flex-col"
    >
      {legend && <div className="mb-3 flex items-center justify-end gap-4 text-xs">{legend}</div>}

      <div className="w-full flex-1" style={{ minHeight: typeof height === 'number' ? `${height}px` : height }}>
        {isEmpty ? (
          <div className="h-full flex items-center justify-center">
            <EmptyState title="No Data" description={emptyMessage} icon={BarChart2} />
          </div>
        ) : (
          children
        )}
      </div>
    </Panel>
  );
};
