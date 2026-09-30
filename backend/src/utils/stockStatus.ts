/**
 * Shared Stock Status Utility
 *
 * Single source of truth for classifying medicine stock health.
 * Used by: SQL dashboard queries, charts, KPIs, alerts, and AI redistribution.
 *
 * Classification uses days-of-cover (quantity ÷ burn_rate_per_day)
 * rather than raw thresholds, giving a more realistic triage signal.
 */

export type StockStatusLevel = 'stockout' | 'critical' | 'low' | 'moderate' | 'adequate';

export interface StockStatusResult {
  status: StockStatusLevel;
  daysOfCover: number | null;  // null = no burn rate data
  label: string;               // human-readable label for UI
}

/**
 * Determine the stock status for a single medicine at a single facility.
 *
 * @param quantity        Current on-hand quantity
 * @param burnRatePerDay  Average daily consumption (0 means no consumption data)
 * @param reorderLevel    The facility's configured reorder threshold
 * @returns               Unified status classification
 */
export function getStockStatus(
  quantity: number,
  burnRatePerDay: number,
  reorderLevel: number
): StockStatusResult {
  // Already depleted
  if (quantity <= 0) {
    return { status: 'stockout', daysOfCover: 0, label: 'Stocked out' };
  }

  // If we have a burn rate, use days-of-cover as the primary signal
  if (burnRatePerDay > 0) {
    const daysOfCover = quantity / burnRatePerDay;

    if (daysOfCover <= 2) {
      return { status: 'critical', daysOfCover: Math.round(daysOfCover * 10) / 10, label: 'Critical – under 2 days' };
    }
    if (daysOfCover <= 7) {
      return { status: 'low', daysOfCover: Math.round(daysOfCover * 10) / 10, label: 'Low – under 7 days' };
    }
    if (daysOfCover <= 14) {
      return { status: 'moderate', daysOfCover: Math.round(daysOfCover * 10) / 10, label: 'Moderate – under 14 days' };
    }
    return { status: 'adequate', daysOfCover: Math.round(daysOfCover * 10) / 10, label: 'Adequate' };
  }

  // No burn rate: fall back to quantity vs reorder_level comparison
  if (quantity <= reorderLevel * 0.25) {
    return { status: 'critical', daysOfCover: null, label: 'Critical – very low stock' };
  }
  if (quantity <= reorderLevel) {
    return { status: 'low', daysOfCover: null, label: 'Low – below reorder level' };
  }
  if (quantity <= reorderLevel * 2) {
    return { status: 'moderate', daysOfCover: null, label: 'Moderate' };
  }
  return { status: 'adequate', daysOfCover: null, label: 'Adequate' };
}

/**
 * Map a StockStatusLevel to the severity used by the alert system.
 */
export function stockStatusToAlertSeverity(status: StockStatusLevel): 'critical' | 'high' | 'medium' | 'low' | null {
  switch (status) {
    case 'stockout': return 'critical';
    case 'critical': return 'critical';
    case 'low': return 'high';
    case 'moderate': return 'medium';
    case 'adequate': return null; // no alert needed
  }
}
