import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, CartesianGrid, Cell } from 'recharts';
import { Panel } from '../ui/Panel';
import { ProgressBar } from '../ui/ProgressBar';
import type { StockItem, BedSummary, AttendanceSummary } from '../services/api';

interface DistrictSummaryProps {
  stocks: StockItem[];
  beds: BedSummary[];
  attendance: AttendanceSummary[];
}

export function DistrictSummary({ stocks, beds, attendance }: DistrictSummaryProps) {
  const districtData = useMemo(() => {
    const districts = new Map<string, {
      name: string;
      state: string;
      facilities: Set<string>;
      totalStock: number;
      lowStock: number;
      stockout: number;
      bedOccupancy: number;
      bedTotal: number;
      staffPresent: number;
      staffTotal: number;
    }>();

    for (const s of stocks) {
      if (!districts.has(s.district)) {
        districts.set(s.district, {
          name: s.district, state: s.state, facilities: new Set(),
          totalStock: 0, lowStock: 0, stockout: 0,
          bedOccupancy: 0, bedTotal: 0, staffPresent: 0, staffTotal: 0,
        });
      }
      const d = districts.get(s.district)!;
      d.facilities.add(s.facility_id);
      d.totalStock++;
      if (s.stock_status === 'low') d.lowStock++;
      if (s.stock_status === 'stockout') d.stockout++;
    }

    for (const b of beds) {
      const d = districts.get(b.district);
      if (d) { d.bedOccupancy += b.occupied; d.bedTotal += b.total; }
    }

    for (const a of attendance) {
      const d = districts.get(a.district);
      if (d) { d.staffPresent += Number(a.present_count); d.staffTotal += Number(a.total_staff); }
    }

    return Array.from(districts.values()).map(d => ({
      name: d.name,
      state: d.state,
      facilities: d.facilities.size,
      stockHealth: d.totalStock > 0 ? Math.round(((d.totalStock - d.lowStock - d.stockout) / d.totalStock) * 100) : 100,
      bedOccupancy: d.bedTotal > 0 ? Math.round((d.bedOccupancy / d.bedTotal) * 100) : 0,
      attendance: d.staffTotal > 0 ? Math.round((d.staffPresent / d.staffTotal) * 100) : 0,
      atRisk: d.lowStock + d.stockout,
    })).sort((a, b) => b.stockHealth - a.stockHealth);
  }, [stocks, beds, attendance]);

  const radarData = useMemo(() => {
    return districtData.slice(0, 6).map(d => ({
      district: d.name.length > 11 ? d.name.substring(0, 11) + '…' : d.name,
      'Stock Health': d.stockHealth,
      'Bed Avail.': 100 - d.bedOccupancy,
      'Staff Attendance': d.attendance,
    }));
  }, [districtData]);

  if (districtData.length === 0) return null;

  const tooltipStyle = {
    backgroundColor: 'var(--color-surface)',
    borderColor: 'var(--color-line)',
    borderRadius: '8px',
    fontSize: '12px',
    color: 'var(--color-ink)',
  };

  return (
    <Panel
      title="Regional District Resource Analysis"
      subtitle={`Comparative index across ${districtData.length} healthcare districts`}
    >
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        {/* Bar Chart */}
        <div className="p-4 rounded-xl bg-[var(--color-raised)] border border-[var(--color-line)]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)] mb-3 flex items-center justify-between">
            <span>District Stock Health (%)</span>
            <span className="text-[11px] font-normal lowercase">higher is better</span>
          </h3>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={districtData} layout="vertical" margin={{ left: -10, right: 15, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-line)" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--color-muted)' }} unit="%" />
                <YAxis dataKey="name" type="category" width={85} tick={{ fontSize: 11, fill: 'var(--color-muted)' }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value}%`, 'Stock Health']} />
                <Bar dataKey="stockHealth" radius={[0, 6, 6, 0]} barSize={16}>
                  {districtData.map((entry, index) => {
                    const color = entry.stockHealth >= 80 ? 'var(--color-ok-text)'
                      : entry.stockHealth >= 60 ? 'var(--color-medium-text)'
                      : entry.stockHealth >= 40 ? 'var(--color-high-text)'
                      : 'var(--color-critical-text)';
                    return <Cell key={index} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Radar Chart */}
        <div className="p-4 rounded-xl bg-[var(--color-raised)] border border-[var(--color-line)]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)] mb-3 flex items-center justify-between">
            <span>Resource Triangle (Stock · Beds · Staff)</span>
            <span className="text-[11px] font-normal lowercase">balance check</span>
          </h3>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} cx="50%" cy="50%">
                <PolarGrid stroke="var(--color-line)" />
                <PolarAngleAxis dataKey="district" tick={{ fontSize: 10, fill: 'var(--color-muted)' }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--color-muted)' }} />
                <Radar name="Stock Health" dataKey="Stock Health" stroke="var(--color-brand)" fill="var(--color-brand)" fillOpacity={0.2} strokeWidth={2} />
                <Radar name="Bed Avail." dataKey="Bed Avail." stroke="var(--color-ok-text)" fill="var(--color-ok-text)" fillOpacity={0.15} strokeWidth={2} />
                <Radar name="Staff Attendance" dataKey="Staff Attendance" stroke="var(--color-medium-text)" fill="var(--color-medium-text)" fillOpacity={0.15} strokeWidth={2} />
                <Tooltip contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* District Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {districtData.map((d) => (
          <div
            key={d.name}
            className="p-3.5 rounded-xl border border-[var(--color-line)] bg-[var(--color-raised)] hover:border-[var(--color-brand)]/30 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-[var(--color-ink)] truncate">{d.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-canvas)] text-[var(--color-muted)] font-medium">
                {d.facilities} PHCs
              </span>
            </div>
            <div className="space-y-2.5">
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-[var(--color-muted)]">Stock Health</span>
                  <span className="font-semibold tabular-nums text-[var(--color-ink)]">{d.stockHealth}%</span>
                </div>
                <ProgressBar
                  value={d.stockHealth}
                  max={100}
                  severity={d.stockHealth >= 80 ? 'ok' : d.stockHealth >= 60 ? 'medium' : 'critical'}
                  height="sm"
                  showPercent={false}
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-[var(--color-muted)]">Bed Occupancy</span>
                  <span className="font-semibold tabular-nums text-[var(--color-ink)]">{d.bedOccupancy}%</span>
                </div>
                <ProgressBar
                  value={d.bedOccupancy}
                  max={100}
                  severity={d.bedOccupancy >= 90 ? 'critical' : d.bedOccupancy >= 75 ? 'high' : 'ok'}
                  height="sm"
                  showPercent={false}
                />
              </div>
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-[var(--color-muted)]">Attendance</span>
                  <span className="font-semibold tabular-nums text-[var(--color-ink)]">{d.attendance}%</span>
                </div>
                <ProgressBar
                  value={d.attendance}
                  max={100}
                  severity={d.attendance >= 80 ? 'ok' : d.attendance >= 65 ? 'medium' : 'high'}
                  height="sm"
                  showPercent={false}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
