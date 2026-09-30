import { useState } from 'react';
import { ArrowRight, MapPin, Truck, Sparkles, Package, Clock, Route, Check, CheckCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Panel } from '../ui/Panel';
import { SegmentedControl } from '../ui/SegmentedControl';
import { StatusBadge } from '../ui/StatusBadge';
import { api, type Redistribution } from '../services/api';

interface RedistributionPanelProps {
  redistributions: Redistribution[];
  onStatusUpdate?: () => void;
}

function getUrgencySeverity(score: number): 'critical' | 'high' | 'medium' | 'ok' {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'ok';
}

function getUrgencyLabel(score: number): string {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 40) return 'Medium';
  return 'Routine';
}

export function RedistributionPanel({ redistributions, onStatusUpdate }: RedistributionPanelProps) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const pending = redistributions.filter(r => r.status === 'pending');
  const totalTransferUnits = redistributions.reduce((sum, r) => sum + r.recommended_quantity, 0);
  const avgDistance = redistributions.length > 0
    ? Math.round(redistributions.reduce((sum, r) => sum + (r.distance_km || 0), 0) / redistributions.length)
    : 0;

  const filteredItems = redistributions.filter(r =>
    filterStatus === 'all' ? true : r.status === filterStatus
  );

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const item = redistributions.find(r => r.id === id);
    try {
      setUpdatingId(id);
      await api.updateRedistributionStatus(id, newStatus);
      if (newStatus === 'approved') {
        toast.success(`Transfer Approved: ${item ? item.recommended_quantity + ' units of ' + item.medicine_name : 'Transfer route'}`, {
          description: item ? `From ${item.source_facility_name} to ${item.target_facility_name}` : undefined,
        });
      } else if (newStatus === 'rejected') {
        toast.info('Transfer route rejected', {
          description: item ? `${item.medicine_name} transfer cancelled` : undefined,
        });
      } else if (newStatus === 'in_transit') {
        toast.success('Dispatched: Status updated to In Transit');
      } else if (newStatus === 'completed') {
        toast.success('Delivered: Transfer completed successfully');
      }
      onStatusUpdate?.();
    } catch (err) {
      console.error('Failed to update redistribution status:', err);
      toast.error('Failed to update transfer status');
    } finally {
      setUpdatingId(null);
    }
  };

  const statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'in_transit', label: 'In Transit' },
  ];

  return (
    <Panel
      title={
        <div className="flex items-center gap-2">
          <span>Cross-District Medicine Redistribution</span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--color-brand-tint)] text-[var(--color-brand)]">
            {redistributions.length} Routes
          </span>
        </div>
      }
      subtitle="AI optimization matching surplus facilities to avert imminent stockouts"
      actions={
        <SegmentedControl
          options={statusOptions}
          value={filterStatus}
          onValueChange={setFilterStatus}
        />
      }
    >
      {/* Metric summary banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-6">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--color-brand-tint)] border border-[var(--color-brand-tint)]">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--color-brand-tint)] text-[var(--color-brand)]">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xl font-extrabold text-[var(--color-ink)] tabular-nums">
              {totalTransferUnits.toLocaleString()}
            </p>
            <p className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Total Recommended Units
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--color-medium-bg)] border border-[var(--color-medium-bg)]">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--color-medium-bg)] text-[var(--color-medium-text)]">
            <Route className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xl font-extrabold text-[var(--color-ink)] tabular-nums">
              {avgDistance} km
            </p>
            <p className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Average Transit Distance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--color-high-bg)] border border-[var(--color-high-bg)]">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[var(--color-high-bg)] text-[var(--color-high-text)]">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xl font-extrabold text-[var(--color-ink)] tabular-nums">
              {pending.filter(r => r.urgency_score >= 60).length}
            </p>
            <p className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider">
              High / Critical Urgency
            </p>
          </div>
        </div>
      </div>

      {/* List of Recommendations */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-dashed border-[var(--color-line)] bg-[var(--color-raised)]">
          <Truck className="w-10 h-10 text-[var(--color-muted)] mx-auto mb-2 opacity-60" />
          <p className="text-sm font-semibold text-[var(--color-ink)]">
            No redistribution routes for current filter
          </p>
          <p className="text-xs text-[var(--color-muted)] max-w-sm mx-auto mt-1">
            Trigger "Optimize Redistribution" in the AI Engine to calculate new transfers.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredItems.map((r) => {
            const isUpdating = updatingId === r.id;

            return (
              <div
                key={r.id}
                className="rounded-xl border border-[var(--color-line)] bg-[var(--color-raised)] hover:border-[var(--color-brand)]/30 transition-all duration-150 overflow-hidden flex flex-col justify-between"
              >
                <div className="p-4 sm:p-5">
                  {/* Top Row */}
                  <div className="flex items-start justify-between gap-3 mb-3.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-[var(--color-ink)]">
                          {r.medicine_name}
                        </h3>
                        <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-[var(--color-brand-tint)] text-[var(--color-brand)]">
                          {r.recommended_quantity} units
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
                        Status: <span className="font-semibold capitalize text-[var(--color-ink)]">{r.status || 'pending'}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {r.distance_km && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[var(--color-medium-bg)] text-[var(--color-medium-text)] tabular-nums">
                          {r.distance_km.toFixed(0)} km
                        </span>
                      )}
                      <StatusBadge
                        severity={getUrgencySeverity(r.urgency_score)}
                        label={`${getUrgencyLabel(r.urgency_score)} (${Math.round(r.urgency_score)})`}
                        size="sm"
                      />
                    </div>
                  </div>

                  {/* Route flow */}
                  <div className="flex items-center gap-2 mb-3.5">
                    {/* Source */}
                    <div className="flex-1 p-3 rounded-lg bg-[var(--color-ok-bg)] border border-[var(--color-ok-bg)]">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-[var(--color-ok-text)] tracking-wider mb-1">
                        <MapPin className="w-3 h-3" />
                        Source (Surplus)
                      </div>
                      <p className="text-xs font-semibold text-[var(--color-ink)] truncate">
                        {r.source_facility_name}
                      </p>
                      <p className="text-[11px] text-[var(--color-muted)] truncate">
                        {r.source_district}
                      </p>
                    </div>

                    {/* Arrow */}
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-brand-tint)] flex-shrink-0">
                      <ArrowRight className="w-4 h-4 text-[var(--color-brand)]" />
                    </div>

                    {/* Target */}
                    <div className="flex-1 p-3 rounded-lg bg-[var(--color-critical-bg)] border border-[var(--color-critical-bg)]">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-[var(--color-critical-text)] tracking-wider mb-1">
                        <MapPin className="w-3 h-3" />
                        Target (Deficit)
                      </div>
                      <p className="text-xs font-semibold text-[var(--color-ink)] truncate">
                        {r.target_facility_name}
                      </p>
                      <p className="text-[11px] text-[var(--color-muted)] truncate">
                        {r.target_district}
                      </p>
                    </div>
                  </div>

                  {/* AI Reasoning */}
                  {r.reasoning && (
                    <div className="p-3 rounded-lg bg-[var(--color-brand-tint)] border-l-2 border-[var(--color-brand)] text-xs leading-relaxed text-[var(--color-ink)]">
                      <div className="flex items-center gap-1.5 font-semibold text-[var(--color-brand)] text-[10px] uppercase tracking-wider mb-1">
                        <Sparkles className="w-3 h-3" />
                        AI Decision Rationale
                      </div>
                      <p className="line-clamp-2 hover:line-clamp-none transition-all opacity-80">
                        {r.reasoning}
                      </p>
                    </div>
                  )}
                </div>

                {/* Card Action Footer */}
                <div className="px-4 py-2.5 bg-[var(--color-canvas)] border-t border-[var(--color-line)] flex items-center justify-between text-xs">
                  <span className="text-[var(--color-muted)] text-[11px] tabular-nums">
                    Created: {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  <div className="flex items-center gap-2">
                    {r.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(r.id, 'rejected')}
                          disabled={isUpdating}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[var(--color-muted)] hover:text-[var(--color-critical-text)] hover:bg-[var(--color-critical-bg)] border border-[var(--color-line)] transition-colors cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(r.id, 'approved')}
                          disabled={isUpdating}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-[var(--color-brand)] hover:bg-[var(--color-brand-hover)] text-white font-semibold transition-colors shadow-sm cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </button>
                      </>
                    )}

                    {r.status === 'approved' && (
                      <button
                        onClick={() => handleUpdateStatus(r.id, 'in_transit')}
                        disabled={isUpdating}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[var(--color-medium-text)] hover:opacity-90 text-white font-semibold transition-colors cursor-pointer"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        Dispatch
                      </button>
                    )}

                    {r.status === 'in_transit' && (
                      <button
                        onClick={() => handleUpdateStatus(r.id, 'completed')}
                        disabled={isUpdating}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[var(--color-ok-text)] hover:opacity-90 text-white font-semibold transition-colors cursor-pointer"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark Delivered
                      </button>
                    )}

                    {r.status === 'completed' && (
                      <span className="inline-flex items-center gap-1 text-[var(--color-ok-text)] font-medium">
                        <CheckCheck className="w-3.5 h-3.5" />
                        Completed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
