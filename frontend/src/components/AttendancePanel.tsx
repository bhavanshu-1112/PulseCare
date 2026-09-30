import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CheckCircle2, UserX, AlertTriangle } from 'lucide-react';
import { Panel } from '../ui/Panel';
import { ProgressBar } from '../ui/ProgressBar';
import type { AttendanceSummary } from '../services/api';

interface AttendancePanelProps {
  attendance: AttendanceSummary[];
}

export function AttendancePanel({ attendance }: AttendancePanelProps) {
  const totalStaff = attendance.reduce((sum, a) => sum + Number(a.total_staff), 0);
  const presentStaff = attendance.reduce((sum, a) => sum + Number(a.present_count), 0);
  const absentStaff = Math.max(0, totalStaff - presentStaff);
  const attendancePct = totalStaff > 0 ? Math.round((presentStaff / totalStaff) * 100) : 0;

  const pieData = [
    { name: 'Checked In', value: presentStaff, color: 'var(--color-ok-text, #10b981)' },
    { name: 'Absent / Off', value: absentStaff, color: 'var(--color-line, #334155)' },
  ];

  // Facilities with low attendance (< 75%)
  const lowAttendance = attendance
    .filter(a => a.attendance_pct < 75 && Number(a.total_staff) > 0)
    .sort((a, b) => a.attendance_pct - b.attendance_pct)
    .slice(0, 8);

  return (
    <Panel
      title="Medical Staff Attendance"
      subtitle={`Personnel roster across ${attendance.length} PHC facilities`}
      actions={
        <span className="text-xs px-2.5 py-1 rounded-lg bg-[var(--color-ok-bg)] text-[var(--color-ok-text)] font-bold tabular-nums">
          {attendancePct}% On Duty
        </span>
      }
      footer={
        <>
          <span>Roster covers {attendance.length} PHC medical teams</span>
          <span className="text-[var(--color-ok-text)]">Live check-in active</span>
        </>
      }
    >
      {/* Donut Chart & Counters */}
      <div className="flex items-center gap-5 p-4 rounded-xl bg-[var(--color-raised)] border border-[var(--color-line)] mb-5">
        <div className="w-28 h-28 relative flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={36}
                outerRadius={52}
                paddingAngle={4}
                dataKey="value"
                strokeWidth={0}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-surface)',
                  borderColor: 'var(--color-line)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--color-ink)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center percentage label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-sm font-extrabold text-[var(--color-ink)]">{attendancePct}%</span>
            <span className="text-[9px] text-[var(--color-muted)] uppercase">On Duty</span>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-[var(--color-ok-bg)] border border-[var(--color-ok-bg)]">
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-ok-text)] mb-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="font-semibold">Checked In</span>
            </div>
            <p className="text-2xl font-extrabold text-[var(--color-ink)] tabular-nums">{presentStaff}</p>
            <p className="text-[11px] text-[var(--color-muted)]">Doctors & Staff</p>
          </div>

          <div className="p-3 rounded-lg bg-[var(--color-raised)] border border-[var(--color-line)]">
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-muted)] mb-1">
              <UserX className="w-3.5 h-3.5" />
              <span className="font-semibold">Absent / Off</span>
            </div>
            <p className="text-2xl font-extrabold text-[var(--color-ink)] tabular-nums">{absentStaff}</p>
            <p className="text-[11px] text-[var(--color-muted)]">Rostered staff</p>
          </div>
        </div>
      </div>

      {/* Low Attendance List */}
      {lowAttendance.length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-high-text)] mb-2.5 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Facilities with Staffing Deficits (&lt; 75%)
          </h3>
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {lowAttendance.map(a => (
              <div
                key={a.facility_id}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[var(--color-high-bg)] border border-[var(--color-high-bg)] text-xs"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <p className="font-semibold text-[var(--color-ink)] truncate">{a.facility_name}</p>
                  <p className="text-[10px] text-[var(--color-muted)]">{a.district}, {a.state}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="font-bold text-[var(--color-high-text)] tabular-nums">{a.attendance_pct}%</span>
                  <p className="text-[10px] text-[var(--color-muted)] tabular-nums">{a.present_count}/{a.total_staff} staff</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {lowAttendance.length === 0 && (
        <div className="text-center py-6 text-xs text-[var(--color-muted)]">
          <CheckCircle2 className="w-6 h-6 text-[var(--color-ok-text)] mx-auto mb-1" />
          All facilities are adequately staffed today.
        </div>
      )}
    </Panel>
  );
}
