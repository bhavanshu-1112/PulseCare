import { useState } from 'react';
import { Radio, Activity, Pill, Bed, UserCheck, AlertTriangle } from 'lucide-react';
import { Panel } from '../ui/Panel';
import { SegmentedControl } from '../ui/SegmentedControl';

interface WSMessage {
  type: string;
  updateType?: string;
  data?: any;
  timestamp?: string;
}

interface LiveFeedProps {
  messages: WSMessage[];
}

const BADGE_CONFIG: Record<string, { icon: typeof Pill; label: string; bgVar: string; textVar: string }> = {
  stock: { icon: Pill, label: 'Stock', bgVar: 'var(--color-brand-tint)', textVar: 'var(--color-brand)' },
  bed: { icon: Bed, label: 'Bed', bgVar: 'var(--color-medium-bg)', textVar: 'var(--color-medium-text)' },
  attendance: { icon: UserCheck, label: 'Staff', bgVar: 'var(--color-ok-bg)', textVar: 'var(--color-ok-text)' },
  alert: { icon: AlertTriangle, label: 'Alert', bgVar: 'var(--color-high-bg)', textVar: 'var(--color-high-text)' },
};

const DEFAULT_BADGE = { icon: Activity, label: 'Event', bgVar: 'var(--color-raised)', textVar: 'var(--color-muted)' };

export function LiveFeed({ messages }: LiveFeedProps) {
  const [filterType, setFilterType] = useState('all');

  const filteredMessages = messages.filter(m =>
    filterType === 'all' ? true : m.updateType === filterType
  );

  const formatMessage = (msg: WSMessage): string => {
    const data = msg.data || {};
    const name = data.facility_name || data.facility_id?.substring(0, 8) || 'Facility';

    switch (msg.updateType) {
      case 'stock':
        if (data.event === 'restock')
          return `${name}: Restocked ${data.medicine_name} to ${data.quantity} units`;
        return `${name}: ${data.medicine_name} adjusted to ${data.quantity} units`;
      case 'bed':
        return `${name}: Bed status ${data.occupied}/${data.total} occupied`;
      case 'attendance':
        return `${name}: ${data.staff_name || ''} logged as ${data.status}`;
      case 'alert':
        return `${name}: ${data.title || 'Threshold exceeded'}`;
      default:
        return typeof data === 'string' ? data : JSON.stringify(data).substring(0, 90);
    }
  };

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'stock', label: 'Stock' },
    { value: 'bed', label: 'Bed' },
    { value: 'attendance', label: 'Staff' },
    { value: 'alert', label: 'Alert' },
  ];

  return (
    <Panel
      title={
        <div className="flex items-center gap-2">
          <span>Live Telemetry Stream</span>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-ok-text)] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--color-ok-text)]"></span>
          </span>
        </div>
      }
      subtitle="Real-time events streamed via WebSocket"
      actions={
        <SegmentedControl
          options={filterOptions}
          value={filterType}
          onValueChange={setFilterType}
        />
      }
    >
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {filteredMessages.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-[var(--color-line)] rounded-xl bg-[var(--color-raised)]">
            <Activity className="w-8 h-8 text-[var(--color-muted)] mx-auto mb-2 animate-pulse" />
            <p className="text-xs font-semibold text-[var(--color-ink)]">
              Awaiting real-time events…
            </p>
            <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
              Updates appear as stock adjustments and check-ins occur
            </p>
          </div>
        ) : (
          filteredMessages.slice(0, 40).map((msg, idx) => {
            const badge = BADGE_CONFIG[msg.updateType || ''] || DEFAULT_BADGE;
            const Icon = badge.icon;
            const timeStr = msg.timestamp
              ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              : 'Just now';

            return (
              <div
                key={idx}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--color-raised)] border border-[var(--color-line-subtle)] hover:border-[var(--color-line)] transition-colors text-xs"
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: badge.bgVar, color: badge.textVar }}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>

                <div className="flex-1 min-w-0">
                  <span className="font-medium text-[var(--color-ink)] truncate block">
                    {formatMessage(msg)}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 text-[var(--color-muted)] text-[11px]">
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold"
                    style={{ background: badge.bgVar, color: badge.textVar }}
                  >
                    {badge.label}
                  </span>
                  <span className="tabular-nums">{timeStr}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
}
