import React, { useState, useEffect } from 'react';
import { timeAgo, formatDateTime } from '../lib/formatters';

interface RelativeTimeProps {
  timestamp: string | number | Date | null | undefined;
  refreshIntervalMs?: number;
  className?: string;
}

export const RelativeTime: React.FC<RelativeTimeProps> = ({
  timestamp,
  refreshIntervalMs = 15000,
  className = '',
}) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!timestamp) return;
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [timestamp, refreshIntervalMs]);

  if (!timestamp) return <span className={className}>-</span>;

  const fullDate = new Date(timestamp).toLocaleString('en-IN');

  return (
    <time
      dateTime={new Date(timestamp).toISOString()}
      title={fullDate}
      className={`tabular-nums text-[var(--color-muted)] ${className}`}
    >
      {timeAgo(timestamp)}
    </time>
  );
};
