import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { ArrowUpDown, AlertCircle } from 'lucide-react';
import { Panel } from '../ui/Panel';
import { ProgressBar } from '../ui/ProgressBar';
import type { BedSummary } from '../services/api';

interface BedOccupancyProps {
  beds: BedSummary[];
}

function getOccupancyColor(pct: number): string {
  if (pct >= 90) return 'var(--color-critical-text, #f43f5e)';
  if (pct >= 75) return 'var(--color-high-text, #f97316)';
  if (pct >= 50) return 'var(--color-medium-text, #f59e0b)';
  return 'var(--color-ok-text, #10b981)';
}

function getOccupancySeverity(pct: number): 'critical' | 'high' | 'medium' | 'ok' {
  if (pct >= 90) return 'critical';
  if (pct >= 75) return 'high';
  if (pct >= 50) return 'medium';
  return 'ok';
}

export function BedOccupancy({ beds }: BedOccupancyProps) {
  const [sortAsc, setSortAsc] = useState(false);

  const sortedBeds = [...beds].sort((a, b) =>
    sortAsc
      ? Number(a.occupancy_pct) - Number(b.occupancy_pct)
      : Number(b.occupancy_pct) - Number(a.occupancy_pct)
  );

  const chartData = sortedBeds.slice(0, 14).map(b => ({
    name: b.facility_name.replace('Primary Health Centre', 'PHC'),
    occupancy: Number(b.occupancy_pct),
    occupied: b.occupied,
    total: b.total,
    district: b.district,
  }));

  const totalBeds = beds.reduce((sum, b) => sum + b.total, 0);
  const occupiedBeds = beds.reduce((sum, b) => sum + b.occupied, 0);
  const avgOccupancy = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const criticalFacilities = beds.filter(b => Number(b.occupancy_pct) >= 90).length;

  return (
    <Panel
      title="Bed Capacity & Occupancy"
      subtitle={`Live ward utilization across ${beds.length} facilities`}
      actions={
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 rounded-lg bg-[var(--color-brand-tint)] text-[var(--color-brand)] font-medium tabular-nums">
            Avg: {avgOccupancy}%
          </span>
          {criticalFacilities > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-lg bg-[var(--color-critical-bg)] text-[var(--color-critical-text)] font-semibold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {criticalFacilities} Near Capacity
            </span>
          )}
          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="p-1.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-raised)] text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
            title="Toggle sort order"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        </div>
      }
      footer={
        <>
          <span>Available: {totalBeds - occupiedBeds} beds across network</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--color-ok-text)]" /> &lt;75%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--color-medium-text)]" /> 75-89%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--color-critical-text)]" /> ≥90%</span>
          </span>
        </>
      }
    >
      {/* Chart */}
      <div className="w-full min-h-[320px]">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 5, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-line)" />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
              unit="%"
            />
            <YAxis
              dataKey="name"
              type="category"
              width={120}
              tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-surface)',
                borderColor: 'var(--color-line)',
                borderRadius: '8px',
                fontSize: '12px',
                color: 'var(--color-ink)',
              }}
              formatter={(value: number, _name: string, item: any) => [
                `${item.payload.occupied} / ${item.payload.total} beds (${value}%)`,
                'Occupancy',
              ]}
            />
            <Bar dataKey="occupancy" radius={[0, 6, 6, 0]} barSize={14}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={getOccupancyColor(entry.occupancy)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
