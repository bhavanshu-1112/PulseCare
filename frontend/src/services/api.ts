const RAW_API_URL = import.meta.env.VITE_API_URL || '';
export const API_BASE = RAW_API_URL
  ? RAW_API_URL.replace(/\/$/, '').endsWith('/api')
    ? RAW_API_URL.replace(/\/$/, '')
    : `${RAW_API_URL.replace(/\/$/, '')}/api`
  : '/api';

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export interface Facility {
  id: string;
  name: string;
  facility_type: string;
  district: string;
  state: string;
  latitude: number;
  longitude: number;
  total_beds: number;
  bed_status?: { total: number; occupied: number };
}

export interface StockItem {
  facility_id: string;
  facility_name: string;
  district: string;
  state: string;
  latitude: number;
  longitude: number;
  medicine_name: string;
  quantity: number;
  unit: string;
  reorder_level: number;
  max_capacity: number;
  last_updated: string;
  stock_status: 'adequate' | 'medium' | 'low' | 'stockout';
}

export interface BedSummary {
  facility_id: string;
  facility_name: string;
  district: string;
  state: string;
  total: number;
  occupied: number;
  occupancy_pct: number;
}

export interface AttendanceSummary {
  facility_id: string;
  facility_name: string;
  district: string;
  state: string;
  total_staff: number;
  present_count: number;
  attendance_pct: number;
}

export interface Alert {
  id: string;
  facility_id: string;
  facility_name: string;
  district: string;
  state: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description?: string;
  medicine_name?: string;
  metadata: Record<string, any>;
  is_resolved: boolean;
  created_at: string;
}

export interface Redistribution {
  id: string;
  source_facility_id: string;
  source_facility_name: string;
  source_district: string;
  target_facility_id: string;
  target_facility_name: string;
  target_district: string;
  medicine_name: string;
  recommended_quantity: number;
  urgency_score: number;
  distance_km: number;
  reasoning: string;
  status: string;
  created_at: string;
}

export interface FilterOptions {
  states: string[];
  districts: Array<{ district: string; state: string }>;
}

// ─── API Calls ─────────────────────────────────────────────

export const api = {
  getFacilities: () =>
    fetchJSON<{ data: Facility[] }>('/facilities').then(r => r.data),

  getStockSummary: (state?: string, district?: string) => {
    const params = new URLSearchParams();
    if (state) params.set('state', state);
    if (district) params.set('district', district);
    const qs = params.toString();
    return fetchJSON<{ data: StockItem[] }>(`/dashboard/stock-summary${qs ? '?' + qs : ''}`).then(r => r.data);
  },

  getBedSummary: (state?: string, district?: string) => {
    const params = new URLSearchParams();
    if (state) params.set('state', state);
    if (district) params.set('district', district);
    const qs = params.toString();
    return fetchJSON<{ data: BedSummary[] }>(`/dashboard/bed-summary${qs ? '?' + qs : ''}`).then(r => r.data);
  },

  getAttendanceSummary: (state?: string, district?: string) => {
    const params = new URLSearchParams();
    if (state) params.set('state', state);
    if (district) params.set('district', district);
    const qs = params.toString();
    return fetchJSON<{ data: AttendanceSummary[] }>(`/dashboard/attendance-summary${qs ? '?' + qs : ''}`).then(r => r.data);
  },

  getAlerts: (resolved = false, limit = 50) =>
    fetchJSON<{ data: Alert[] }>(`/alerts?resolved=${resolved}&limit=${limit}`).then(r => r.data),

  getRedistributions: (status?: string) => {
    const qs = status ? `?status=${status}` : '';
    return fetchJSON<{ data: Redistribution[] }>(`/redistributions${qs}`).then(r => r.data);
  },

  getFilters: () =>
    fetchJSON<FilterOptions>('/filters'),

  // Forecasting & redistribution triggers
  runForecasting: () =>
    fetchJSON<{ data: any }>('/ai/forecast'),

  runRedistribution: () =>
    fetchJSON<{ data: any }>('/ai/redistribute'),

  updateRedistributionStatus: async (id: string, status: string) => {
    const res = await fetch(`${API_BASE}/redistributions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return res.json();
  },

  updateAlertStatus: async (id: string, is_resolved: boolean) => {
    const res = await fetch(`${API_BASE}/alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_resolved }),
    });
    return res.json();
  },
};
