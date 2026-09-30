import { useState } from 'react';
import { Check, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Panel } from '../ui/Panel';
import { SearchInput } from '../ui/SearchInput';
import { SegmentedControl } from '../ui/SegmentedControl';
import { StatusBadge, SeverityLevel } from '../ui/StatusBadge';
import { RelativeTime } from '../ui/RelativeTime';
import { api, type Alert } from '../services/api';

interface AlertsPanelProps {
  alerts: Alert[];
  onAlertUpdated?: () => void;
}

export function AlertsPanel({ alerts, onAlertUpdated }: AlertsPanelProps) {
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filteredAlerts = alerts.filter(a => {
    const matchSeverity = selectedSeverity === 'all' || a.severity === selectedSeverity;
    const q = searchTerm.toLowerCase();
    const matchSearch =
      a.title.toLowerCase().includes(q) ||
      a.facility_name.toLowerCase().includes(q) ||
      (a.medicine_name && a.medicine_name.toLowerCase().includes(q)) ||
      a.district.toLowerCase().includes(q);
    return matchSeverity && matchSearch;
  });

  const handleToggleResolve = async (alert: Alert) => {
    const willResolve = !alert.is_resolved;
    try {
      setUpdatingId(alert.id);
      await api.updateAlertStatus(alert.id, willResolve);
      if (willResolve) {
        toast.success(`Alert resolved: ${alert.title}`, {
          description: `${alert.facility_name} (${alert.district})`,
        });
      } else {
        toast.info(`Alert reopened: ${alert.title}`, {
          description: `${alert.facility_name} (${alert.district})`,
        });
      }
      onAlertUpdated?.();
    } catch (err) {
      console.error('Failed to update alert:', err);
      toast.error('Failed to update alert status');
    } finally {
      setUpdatingId(null);
    }
  };

  const activeCount = alerts.filter(a => !a.is_resolved).length;
  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.is_resolved).length;
  const highCount = alerts.filter(a => a.severity === 'high' && !a.is_resolved).length;

  const severityOptions = [
    { value: 'all', label: 'All' },
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  return (
    <Panel
      title={
        <div className="flex items-center gap-2">
          <span>Alert Center</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-[var(--color-critical-bg)] text-[var(--color-critical-text)]">
            {activeCount} Active
          </span>
        </div>
      }
      subtitle="Automated stockout alerts, deficit warnings & threshold breaches"
      actions={
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <StatusBadge severity="critical" label={`${criticalCount} Critical`} size="sm" />
          )}
          {highCount > 0 && (
            <StatusBadge severity="high" label={`${highCount} High`} size="sm" />
          )}
        </div>
      }
      bodyClassName="p-0"
    >
      {/* Filter toolbar */}
      <div className="px-5 pt-4 pb-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="flex-1">
          <SearchInput
            placeholder="Filter alerts by medicine, PHC, or issue…"
            value={searchTerm}
            onChange={setSearchTerm}
          />
        </div>
        <SegmentedControl
          options={severityOptions}
          value={selectedSeverity}
          onValueChange={setSelectedSeverity}
        />
      </div>

      {/* Alerts list */}
      <div className="px-5 pb-5 space-y-2 max-h-[520px] overflow-y-auto">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-[var(--color-line)] rounded-xl bg-[var(--color-raised)]">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-[var(--color-ok-text)]" />
            <p className="text-xs font-semibold text-[var(--color-ink)]">
              No matching alerts found
            </p>
            <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
              All monitored PHCs are operating within acceptable thresholds
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isUpdating = updatingId === alert.id;
            const severity = (alert.severity === 'critical' || alert.severity === 'high' || alert.severity === 'medium' || alert.severity === 'low')
              ? alert.severity as SeverityLevel
              : 'medium';

            return (
              <div
                key={alert.id}
                className="p-3.5 rounded-xl border border-[var(--color-line)] bg-[var(--color-raised)] transition-all duration-150 hover:border-[var(--color-brand)]/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold text-[var(--color-ink)] truncate">
                        {alert.title}
                      </span>
                      <StatusBadge severity={severity} label={alert.severity} size="sm" />
                    </div>

                    <p className="text-xs text-[var(--color-ink)] opacity-80 mb-1.5 leading-snug line-clamp-2">
                      {alert.description || 'Stock depletion rate exceeds standard safety buffer.'}
                    </p>

                    <div className="flex items-center gap-2 text-[11px] text-[var(--color-muted)] flex-wrap">
                      <span className="font-medium text-[var(--color-ink)] opacity-70">
                        {alert.facility_name}
                      </span>
                      <span>·</span>
                      <span>{alert.district}, {alert.state}</span>
                      {alert.medicine_name && (
                        <>
                          <span>·</span>
                          <span className="text-[var(--color-brand)] font-medium">{alert.medicine_name}</span>
                        </>
                      )}
                      <span>·</span>
                      <RelativeTime timestamp={alert.created_at} />
                    </div>
                  </div>

                  {/* Resolve Button */}
                  <button
                    onClick={() => handleToggleResolve(alert)}
                    disabled={isUpdating}
                    className={`p-1.5 rounded-lg border transition-colors flex-shrink-0 cursor-pointer ${
                      alert.is_resolved
                        ? 'border-[var(--color-ok-text)]/30 bg-[var(--color-ok-bg)] text-[var(--color-ok-text)]'
                        : 'border-[var(--color-line)] bg-[var(--color-raised)] text-[var(--color-muted)] hover:text-[var(--color-ok-text)] hover:bg-[var(--color-ok-bg)]'
                    }`}
                    title={alert.is_resolved ? 'Mark active' : 'Acknowledge & resolve'}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
}
