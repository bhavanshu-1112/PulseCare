/**
 * PulseCare Formatters & Utility Functions
 */

/**
 * Format numbers with Indian numbering grouping (e.g. 1,50,000)
 */
export function formatNumber(num: number | null | undefined, fallback = '0'): string {
  if (num === null || num === undefined || isNaN(num)) return fallback;
  return new Intl.NumberFormat('en-IN').format(num);
}

/**
 * Format currency in INR
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Pluralize English nouns
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  const word = count === 1 ? singular : (plural || `${singular}s`);
  return `${formatNumber(count)} ${word}`;
}

/**
 * Format burn rate or consumption rate
 */
export function formatRate(unitsPerDay: number | null | undefined, unit = 'units/day'): string {
  if (unitsPerDay === null || unitsPerDay === undefined || isNaN(unitsPerDay)) {
    return `0 ${unit}`;
  }
  return `${unitsPerDay.toFixed(1)} ${unit}`;
}

/**
 * Format days of cover remaining
 */
export function formatDaysLeft(days: number | null | undefined): string {
  if (days === null || days === undefined || isNaN(days)) return 'Unknown';
  if (days <= 0) return '0 days (Depleted)';
  if (days < 1) return '< 1 day remaining';
  if (days === 1) return '1 day remaining';
  return `${Math.round(days)} days remaining`;
}

/**
 * Relative time formatter (e.g. "2m ago", "1h ago", "Just now")
 */
export function timeAgo(timestamp: string | number | Date | null | undefined): string {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return 'Invalid date';

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

/**
 * Format precise timestamp for logs and telemetries
 */
export function formatDateTime(timestamp: string | number | Date | null | undefined): string {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}
