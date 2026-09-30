/**
 * Tests for the Forecasting Module
 *
 * Tests the pure computation functions (burn rate, risk score)
 * and the data pipeline logic without requiring DB/LLM connections.
 */

import {
  calculateBurnRate,
  calculateRiskScore,
} from '../ai/forecasting';

describe('Forecasting Module', () => {

  // ─── Burn Rate Calculation ─────────────────────────────

  describe('calculateBurnRate', () => {

    it('should return zero burn rate for single data point', () => {
      const history = [
        { quantity: 500, recorded_at: new Date('2026-09-25T10:00:00Z') },
      ];
      const result = calculateBurnRate(history);

      expect(result.burnRatePerDay).toBe(0);
      expect(result.daysUntilStockout).toBeNull();
      expect(result.currentQuantity).toBe(500);
    });

    it('should return zero burn rate for empty history', () => {
      const result = calculateBurnRate([]);

      expect(result.burnRatePerDay).toBe(0);
      expect(result.daysUntilStockout).toBeNull();
      expect(result.currentQuantity).toBe(0);
    });

    it('should calculate correct burn rate for linear depletion', () => {
      const history = [
        { quantity: 1000, recorded_at: new Date('2026-09-20T10:00:00Z') },
        { quantity: 800, recorded_at: new Date('2026-09-22T10:00:00Z') },
        { quantity: 600, recorded_at: new Date('2026-09-24T10:00:00Z') },
        { quantity: 500, recorded_at: new Date('2026-09-25T10:00:00Z') },
      ];
      const result = calculateBurnRate(history);

      // 1000 → 500 over 5 days = 100/day
      expect(result.burnRatePerDay).toBe(100);
      expect(result.currentQuantity).toBe(500);
      // 500 / 100 = 5 days
      expect(result.daysUntilStockout).toBe(5);
    });

    it('should handle increasing stock (restock)', () => {
      const history = [
        { quantity: 100, recorded_at: new Date('2026-09-20T10:00:00Z') },
        { quantity: 300, recorded_at: new Date('2026-09-22T10:00:00Z') },
        { quantity: 800, recorded_at: new Date('2026-09-25T10:00:00Z') },
      ];
      const result = calculateBurnRate(history);

      // Stock increased, no stockout
      expect(result.burnRatePerDay).toBe(0);
      expect(result.daysUntilStockout).toBeNull();
      expect(result.currentQuantity).toBe(800);
    });

    it('should handle nearly depleted stock', () => {
      const history = [
        { quantity: 100, recorded_at: new Date('2026-09-24T10:00:00Z') },
        { quantity: 10, recorded_at: new Date('2026-09-25T10:00:00Z') },
      ];
      const result = calculateBurnRate(history);

      // 100 → 10 over 1 day = 90/day
      expect(result.burnRatePerDay).toBe(90);
      expect(result.currentQuantity).toBe(10);
      // 10 / 90 ≈ 0.1 days
      expect(result.daysUntilStockout).toBeCloseTo(0.1, 1);
    });

    it('should handle data points in any order', () => {
      const history = [
        { quantity: 500, recorded_at: new Date('2026-09-25T10:00:00Z') },
        { quantity: 1000, recorded_at: new Date('2026-09-20T10:00:00Z') },
        { quantity: 800, recorded_at: new Date('2026-09-22T10:00:00Z') },
      ];
      const result = calculateBurnRate(history);

      // Should sort internally and get same result
      expect(result.burnRatePerDay).toBe(100);
      expect(result.currentQuantity).toBe(500);
    });
  });

  // ─── Risk Score Calculation ────────────────────────────

  describe('calculateRiskScore', () => {

    it('should return 100 for zero quantity (stockout)', () => {
      const score = calculateRiskScore(0, 0, 100);
      expect(score).toBe(100);
    });

    it('should return low score for null days (no depletion trend)', () => {
      const score = calculateRiskScore(null, 500, 100);
      expect(score).toBe(5);
    });

    it('should return critical score for <1 day until stockout', () => {
      const score = calculateRiskScore(0.5, 10, 100);
      // 60 (days) + 30 (below 25% of reorder) + 10 (low qty) = 100
      expect(score).toBeGreaterThanOrEqual(80);
    });

    it('should return high score for 2-3 days until stockout', () => {
      const score = calculateRiskScore(2, 50, 100);
      // 50 (days) + 20 (below 50% of reorder) = 70
      expect(score).toBeGreaterThanOrEqual(50);
      expect(score).toBeLessThanOrEqual(90);
    });

    it('should return medium score for 7-14 days until stockout with adequate quantity', () => {
      const score = calculateRiskScore(10, 200, 100);
      // 20 (days) + 0 (above 1.5x reorder) = 20
      expect(score).toBeGreaterThanOrEqual(15);
      expect(score).toBeLessThanOrEqual(40);
    });

    it('should return low score for well-stocked facility', () => {
      const score = calculateRiskScore(60, 500, 100);
      // 5 (days >30) + 0 = 5
      expect(score).toBeLessThanOrEqual(10);
    });

    it('should compound below-reorder and low-days factors', () => {
      const scoreLow = calculateRiskScore(5, 30, 100);
      const scoreHigh = calculateRiskScore(5, 300, 100);
      // Same days-to-stockout, but lower quantity should score higher
      expect(scoreLow).toBeGreaterThan(scoreHigh);
    });

    it('should never exceed 100', () => {
      const score = calculateRiskScore(0.1, 1, 1000);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should never be negative', () => {
      const score = calculateRiskScore(null, 10000, 100);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── Integration-style tests (pure logic) ─────────────

  describe('End-to-end risk calculation', () => {

    it('should correctly chain burn rate → risk score for critical scenario', () => {
      const history = [
        { quantity: 100, recorded_at: new Date('2026-09-24T10:00:00Z') },
        { quantity: 10, recorded_at: new Date('2026-09-25T10:00:00Z') },
      ];

      const { burnRatePerDay, daysUntilStockout, currentQuantity } = calculateBurnRate(history);
      const riskScore = calculateRiskScore(daysUntilStockout, currentQuantity, 100);

      expect(burnRatePerDay).toBe(90);
      expect(daysUntilStockout).toBeCloseTo(0.1, 1);
      expect(riskScore).toBeGreaterThanOrEqual(80); // Critical
    });

    it('should correctly chain burn rate → risk score for stable scenario', () => {
      const history = [
        { quantity: 900, recorded_at: new Date('2026-09-20T10:00:00Z') },
        { quantity: 880, recorded_at: new Date('2026-09-25T10:00:00Z') },
      ];

      const { burnRatePerDay, daysUntilStockout, currentQuantity } = calculateBurnRate(history);
      const riskScore = calculateRiskScore(daysUntilStockout, currentQuantity, 100);

      expect(burnRatePerDay).toBe(4); // Slow depletion
      expect(daysUntilStockout).toBe(220); // 880 / 4 = 220 days
      expect(riskScore).toBeLessThanOrEqual(10); // Very low risk
    });
  });
});
