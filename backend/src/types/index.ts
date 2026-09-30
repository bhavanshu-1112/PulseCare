// ============================================================
// PulseCare Core Type Definitions
// ============================================================

export interface Facility {
  id: string;
  name: string;
  facility_type: string;
  district: string;
  state: string;
  latitude: number;
  longitude: number;
  total_beds: number;
  contact_phone?: string;
  created_at: Date;
  updated_at: Date;
}

export interface MedicineStock {
  id: string;
  facility_id: string;
  medicine_name: string;
  quantity: number;
  unit: string;
  reorder_level: number;
  max_capacity: number;
  last_updated: Date;
  created_at: Date;
}

export interface StockHistory {
  id: string;
  facility_id: string;
  medicine_name: string;
  quantity: number;
  recorded_at: Date;
}

export interface BedStatus {
  id: string;
  facility_id: string;
  total: number;
  occupied: number;
  last_updated: Date;
}

export interface Personnel {
  id: string;
  facility_id: string;
  staff_name: string;
  role: string;
  created_at: Date;
}

export interface PersonnelAttendance {
  id: string;
  facility_id: string;
  staff_id: string;
  role: string;
  checked_in_at: Date;
  checked_out_at?: Date;
  status: 'present' | 'absent' | 'on_leave';
}

export interface Alert {
  id: string;
  facility_id: string;
  alert_type: 'stock_low' | 'stock_out' | 'bed_full' | 'attendance_low';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description?: string;
  medicine_name?: string;
  metadata: Record<string, any>;
  is_resolved: boolean;
  created_at: Date;
  resolved_at?: Date;
}

export interface RedistributionRecommendation {
  id: string;
  source_facility_id: string;
  target_facility_id: string;
  medicine_name: string;
  recommended_quantity: number;
  urgency_score: number;
  distance_km?: number;
  reasoning?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  created_at: Date;
  actioned_at?: Date;
}

// --- API Request/Response types ---

export interface StockUpdateRequest {
  facility_id: string;
  medicine_name: string;
  quantity: number;
  unit?: string;
}

export interface BedUpdateRequest {
  facility_id: string;
  total?: number;
  occupied: number;
}

export interface AttendanceUpdateRequest {
  facility_id: string;
  staff_id: string;
  role: string;
  status: 'present' | 'absent' | 'on_leave';
}

// --- Forecasting types ---

export interface BurnRateData {
  facility_id: string;
  facility_name: string;
  district: string;
  state: string;
  medicine_name: string;
  current_quantity: number;
  reorder_level: number;
  burn_rate_per_day: number;        // units consumed per day
  days_until_stockout: number | null; // null means no depletion trend
  risk_score: number;                // 0-100
}

export interface StockOutRisk {
  facility_id: string;
  facility_name: string;
  district: string;
  medicine_name: string;
  current_quantity: number;
  days_until_stockout: number | null;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  ai_summary?: string;
}

export interface RedistributionSuggestion {
  source_facility: {
    id: string;
    name: string;
    district: string;
    surplus_quantity: number;
  };
  target_facility: {
    id: string;
    name: string;
    district: string;
    deficit_quantity: number;
    days_until_stockout: number | null;
  };
  medicine_name: string;
  recommended_transfer_quantity: number;
  urgency_score: number;
  distance_km: number;
  reasoning: string;
}

// --- Dashboard types ---

export interface FacilitySnapshot {
  facility: Facility;
  stocks: MedicineStock[];
  beds: BedStatus;
  attendance_today: {
    total_staff: number;
    present: number;
    absent: number;
  };
}

export interface DashboardUpdate {
  type: 'stock' | 'bed' | 'attendance' | 'alert' | 'redistribution';
  timestamp: string;
  data: any;
}

// --- Federated API types (stretch goal) ---

export interface FederatedAggregateDemand {
  state: string;
  period: string; // ISO date range
  medicines: Array<{
    medicine_name: string;
    total_consumption: number;
    avg_burn_rate: number;
    facilities_at_risk: number;
  }>;
  generated_at: string;
}
