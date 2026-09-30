import React from 'react';
import { Package, Bed, Users, AlertTriangle, TrendingDown, TrendingUp, CheckCircle2 } from 'lucide-react';
import { KpiCard } from '../ui/KpiCard';
import type { StockItem, BedSummary, AttendanceSummary, Alert } from '../services/api';

interface StatsOverviewProps {
  stocks: StockItem[];
  beds: BedSummary[];
  attendance: AttendanceSummary[];
  alerts: Alert[];
}

export function StatsOverview({ stocks, beds, attendance, alerts }: StatsOverviewProps) {
  const uniqueFacilities = new Set(stocks.map(s => s.facility_id)).size;
  const stockoutCount = stocks.filter(s => s.stock_status === 'stockout').length;
  const lowStockCount = stocks.filter(s => s.stock_status === 'low').length;
  const adequateCount = stocks.filter(s => s.stock_status === 'adequate').length;

  const totalBeds = beds.reduce((sum, b) => sum + b.total, 0);
  const occupiedBeds = beds.reduce((sum, b) => sum + b.occupied, 0);
  const availableBeds = totalBeds - occupiedBeds;
  const avgOccupancy = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  const totalStaff = attendance.reduce((sum, a) => sum + Number(a.total_staff), 0);
  const presentStaff = attendance.reduce((sum, a) => sum + Number(a.present_count), 0);
  const avgAttendance = totalStaff > 0 ? Math.round((presentStaff / totalStaff) * 100) : 0;

  const activeAlerts = alerts.filter(a => !a.is_resolved);
  const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical').length;
  const highAlerts = activeAlerts.filter(a => a.severity === 'high').length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* PHC Facilities */}
      <KpiCard
        title="PHC Facilities"
        value={uniqueFacilities}
        icon={Package}
        subtitle={`${stocks.length} drug inventories tracked`}
        secondaryValue={
          stockoutCount > 0
            ? `${stockoutCount} stockout${stockoutCount > 1 ? 's' : ''}`
            : `${adequateCount} adequate`
        }
        severity={stockoutCount > 0 ? 'critical' : lowStockCount > 3 ? 'high' : undefined}
      />

      {/* Bed Utilization */}
      <KpiCard
        title="Bed Utilization"
        value={`${avgOccupancy}%`}
        icon={Bed}
        subtitle={`${occupiedBeds} of ${totalBeds} beds in use`}
        secondaryValue={`${availableBeds} available`}
        severity={avgOccupancy >= 90 ? 'critical' : avgOccupancy >= 80 ? 'high' : undefined}
        trend={
          avgOccupancy >= 85
            ? { direction: 'up', value: 'High demand', isGood: false }
            : { direction: 'neutral', value: 'Optimal', isGood: true }
        }
      />

      {/* Staff Attendance */}
      <KpiCard
        title="Staff Attendance"
        value={`${avgAttendance}%`}
        icon={Users}
        subtitle={`${presentStaff} of ${totalStaff} checked in`}
        secondaryValue={`${totalStaff - presentStaff} absent`}
        severity={avgAttendance < 70 ? 'high' : undefined}
        trend={{
          direction: avgAttendance >= 80 ? 'up' : 'down',
          value: avgAttendance >= 80 ? 'Staffed' : 'Understaffed',
          isGood: avgAttendance >= 80,
        }}
      />

      {/* Active Alerts */}
      <KpiCard
        title="Active Alerts"
        value={activeAlerts.length}
        icon={AlertTriangle}
        subtitle={
          criticalAlerts > 0
            ? `${criticalAlerts} critical, ${highAlerts} high`
            : activeAlerts.length === 0
            ? 'All systems nominal'
            : `${highAlerts} high priority`
        }
        severity={
          criticalAlerts > 0
            ? 'critical'
            : highAlerts > 0
            ? 'high'
            : activeAlerts.length > 0
            ? 'medium'
            : 'ok'
        }
      />
    </div>
  );
}
