/**
 * Tests for the shared getStockStatus utility.
 *
 * This is the single source of truth for classifying medicine stock health.
 * It must be consistent whether called from SQL dashboard, charts, alerts, or AI.
 */

import { getStockStatus, stockStatusToAlertSeverity } from '../utils/stockStatus';

describe('getStockStatus', () => {
  describe('when quantity is 0 or below', () => {
    it('returns stockout for quantity = 0', () => {
      const result = getStockStatus(0, 5, 100);
      expect(result.status).toBe('stockout');
      expect(result.daysOfCover).toBe(0);
    });

    it('returns stockout for negative quantity', () => {
      const result = getStockStatus(-10, 5, 100);
      expect(result.status).toBe('stockout');
      expect(result.daysOfCover).toBe(0);
    });
  });

  describe('when burn rate is available', () => {
    it('returns critical for < 2 days of cover', () => {
      // 10 units / 8 per day = 1.25 days
      const result = getStockStatus(10, 8, 100);
      expect(result.status).toBe('critical');
      expect(result.daysOfCover).toBeLessThanOrEqual(2);
    });

    it('returns low for 2-7 days of cover', () => {
      // 30 units / 5 per day = 6 days
      const result = getStockStatus(30, 5, 100);
      expect(result.status).toBe('low');
      expect(result.daysOfCover).toBeGreaterThanOrEqual(2);
      expect(result.daysOfCover).toBeLessThanOrEqual(7);
    });

    it('returns moderate for 7-14 days of cover', () => {
      // 80 units / 8 per day = 10 days
      const result = getStockStatus(80, 8, 100);
      expect(result.status).toBe('moderate');
      expect(result.daysOfCover).toBeGreaterThan(7);
      expect(result.daysOfCover).toBeLessThanOrEqual(14);
    });

    it('returns adequate for > 14 days of cover', () => {
      // 500 units / 10 per day = 50 days
      const result = getStockStatus(500, 10, 100);
      expect(result.status).toBe('adequate');
      expect(result.daysOfCover).toBeGreaterThan(14);
    });

    it('returns exactly 2 days for boundary case', () => {
      // 10 units / 5 per day = 2.0 days → critical (<=2)
      const result = getStockStatus(10, 5, 100);
      expect(result.status).toBe('critical');
    });

    it('returns low for exactly 7 days', () => {
      // 35 units / 5 per day = 7.0 days → low (<=7)
      const result = getStockStatus(35, 5, 100);
      expect(result.status).toBe('low');
    });
  });

  describe('when burn rate is zero (no consumption data)', () => {
    it('returns critical for quantity <= 25% of reorder level', () => {
      const result = getStockStatus(20, 0, 100); // 20 <= 25% of 100
      expect(result.status).toBe('critical');
      expect(result.daysOfCover).toBeNull();
    });

    it('returns low for quantity <= reorder level', () => {
      const result = getStockStatus(80, 0, 100);
      expect(result.status).toBe('low');
      expect(result.daysOfCover).toBeNull();
    });

    it('returns moderate for quantity between reorder and 2x reorder', () => {
      const result = getStockStatus(150, 0, 100);
      expect(result.status).toBe('moderate');
    });

    it('returns adequate for quantity > 2x reorder level', () => {
      const result = getStockStatus(300, 0, 100);
      expect(result.status).toBe('adequate');
    });
  });
});

describe('stockStatusToAlertSeverity', () => {
  it('maps stockout to critical', () => {
    expect(stockStatusToAlertSeverity('stockout')).toBe('critical');
  });

  it('maps critical to critical', () => {
    expect(stockStatusToAlertSeverity('critical')).toBe('critical');
  });

  it('maps low to high', () => {
    expect(stockStatusToAlertSeverity('low')).toBe('high');
  });

  it('maps moderate to medium', () => {
    expect(stockStatusToAlertSeverity('moderate')).toBe('medium');
  });

  it('returns null for adequate (no alert)', () => {
    expect(stockStatusToAlertSeverity('adequate')).toBeNull();
  });
});
