import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { AlertOctagon, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Panel } from '../ui/Panel';
import { SearchInput } from '../ui/SearchInput';
import { SegmentedControl } from '../ui/SegmentedControl';
import { StatusBadge } from '../ui/StatusBadge';
import type { StockItem } from '../services/api';

interface StockHeatmapProps {
  stocks: StockItem[];
}

const STATUS_MAP: Record<string, { label: string; severity: 'critical' | 'high' | 'medium' | 'ok' }> = {
  stockout: { label: 'Stockout', severity: 'critical' },
  low: { label: 'Low', severity: 'high' },
  medium: { label: 'Moderate', severity: 'medium' },
  adequate: { label: 'Adequate', severity: 'ok' },
};

const BAR_COLORS = {
  stockout: 'var(--color-critical-text, #f43f5e)',
  low: 'var(--color-high-text, #f97316)',
  medium: 'var(--color-medium-text, #f59e0b)',
  adequate: 'var(--color-ok-text, #10b981)',
};

export function StockHeatmap({ stocks }: StockHeatmapProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const filteredStocks = useMemo(() => {
    return stocks.filter(s => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        s.medicine_name.toLowerCase().includes(q) ||
        s.facility_name.toLowerCase().includes(q) ||
        s.district.toLowerCase().includes(q);
      const matchStatus = selectedStatus === 'all' || s.stock_status === selectedStatus;
      return matchSearch && matchStatus;
    });
  }, [stocks, searchTerm, selectedStatus]);

  // Aggregate by medicine for chart
  const medicineAggregates = useMemo(() => {
    const map = new Map<string, { name: string; adequate: number; medium: number; low: number; stockout: number }>();
    for (const s of stocks) {
      if (!map.has(s.medicine_name)) {
        map.set(s.medicine_name, { name: s.medicine_name, adequate: 0, medium: 0, low: 0, stockout: 0 });
      }
      const entry = map.get(s.medicine_name)!;
      if (s.stock_status in entry) (entry as any)[s.stock_status]++;
    }
    return Array.from(map.values()).sort((a, b) => (b.stockout * 3 + b.low) - (a.stockout * 3 + a.low));
  }, [stocks]);

  const stockoutTotal = stocks.filter(s => s.stock_status === 'stockout').length;
  const lowStockTotal = stocks.filter(s => s.stock_status === 'low').length;
  const adequateTotal = stocks.filter(s => s.stock_status === 'adequate').length;

  const statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'stockout', label: 'Stockout' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Moderate' },
    { value: 'adequate', label: 'Adequate' },
  ];

  return (
    <div className="space-y-5">
      {/* Summary Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-ok-bg)] text-[var(--color-ok-text)] border border-[var(--color-ok-bg)]">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {adequateTotal} Adequate
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-high-bg)] text-[var(--color-high-text)] border border-[var(--color-high-bg)]">
          <AlertTriangle className="w-3.5 h-3.5" />
          {lowStockTotal} Low
        </span>
        {stockoutTotal > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-critical-bg)] text-[var(--color-critical-text)] border border-[var(--color-critical-bg)]">
            <AlertOctagon className="w-3.5 h-3.5" />
            {stockoutTotal} Stockouts
          </span>
        )}
      </div>

      {/* Chart Panel */}
      <Panel
        title="Risk Profile by Essential Medicine"
        subtitle={`Sorted by stockout frequency · ${stocks.length} total entries`}
      >
        <div className="h-60 w-full -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={medicineAggregates} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
              <XAxis
                dataKey="name"
                angle={-25}
                textAnchor="end"
                interval={0}
                tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
              />
              <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted)' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-line)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--color-ink)',
                }}
                formatter={(value: number, name: string) => [
                  `${value} facilities`,
                  name.charAt(0).toUpperCase() + name.slice(1),
                ]}
              />
              <Bar dataKey="stockout" name="stockout" stackId="a" fill={BAR_COLORS.stockout} />
              <Bar dataKey="low" name="low" stackId="a" fill={BAR_COLORS.low} />
              <Bar dataKey="medium" name="medium" stackId="a" fill={BAR_COLORS.medium} />
              <Bar dataKey="adequate" name="adequate" stackId="a" fill={BAR_COLORS.adequate} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Inventory Table Panel */}
      <Panel
        title="Inventory Detail"
        subtitle={`${filteredStocks.length} of ${stocks.length} items shown`}
        actions={
          <SegmentedControl
            options={statusOptions}
            value={selectedStatus}
            onValueChange={setSelectedStatus}
          />
        }
        bodyClassName="p-0"
      >
        {/* Search bar inside the panel body */}
        <div className="px-5 pt-4 pb-3">
          <SearchInput
            placeholder="Search by medicine, facility, or district…"
            value={searchTerm}
            onChange={setSearchTerm}
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--color-canvas)] text-[var(--color-muted)] uppercase tracking-wider text-[10px] sticky top-0 z-10 border-y border-[var(--color-line)]">
              <tr>
                <th className="py-2.5 px-5 font-semibold">Medicine</th>
                <th className="py-2.5 px-5 font-semibold">Facility</th>
                <th className="py-2.5 px-5 font-semibold">District</th>
                <th className="py-2.5 px-5 font-semibold text-right">Stock</th>
                <th className="py-2.5 px-5 font-semibold text-right">Reorder Lvl</th>
                <th className="py-2.5 px-5 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line-subtle)]">
              {filteredStocks.slice(0, 100).map((s, idx) => {
                const cfg = STATUS_MAP[s.stock_status] || STATUS_MAP.adequate;
                return (
                  <tr key={`${s.facility_id}-${s.medicine_name}-${idx}`} className="hover:bg-[var(--color-raised)] transition-colors">
                    <td className="py-2.5 px-5 font-medium text-[var(--color-ink)]">
                      {s.medicine_name}
                    </td>
                    <td className="py-2.5 px-5 text-[var(--color-ink)] truncate max-w-[180px]">
                      {s.facility_name}
                    </td>
                    <td className="py-2.5 px-5 text-[var(--color-muted)]">
                      {s.district}
                    </td>
                    <td className="py-2.5 px-5 text-right font-semibold text-[var(--color-ink)] tabular-nums">
                      {s.quantity.toLocaleString()}
                      <span className="text-[10px] text-[var(--color-muted)] font-normal ml-1">{s.unit}</span>
                    </td>
                    <td className="py-2.5 px-5 text-right text-[var(--color-muted)] tabular-nums">
                      {s.reorder_level.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-5 text-center">
                      <StatusBadge severity={cfg.severity} label={cfg.label} size="sm" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
