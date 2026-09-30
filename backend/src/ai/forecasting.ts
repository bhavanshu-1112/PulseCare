/**
 * Forecasting Module
 *
 * 1. Calculates burn-rate per facility per medicine from stock history
 * 2. Passes structured data to LLM for risk scoring and plain-language summaries
 * 3. Generates alerts for high-risk items
 */

import { query, getClient } from '../db/pool';
import { callLLMJSON } from './llm-client';
import { BurnRateData, StockOutRisk } from '../types';
import { publishToStream, STREAMS } from '../redis/client';

// ─── Burn Rate Calculation (Pure Math, No LLM) ────────────

/**
 * Calculate burn rate from stock history using simple linear regression
 * over the last N data points. Returns units consumed per day.
 */
export function calculateBurnRate(
  history: Array<{ quantity: number; recorded_at: Date }>
): { burnRatePerDay: number; daysUntilStockout: number | null; currentQuantity: number } {
  if (history.length < 2) {
    return { burnRatePerDay: 0, daysUntilStockout: null, currentQuantity: history[0]?.quantity || 0 };
  }

  // Sort by time ascending
  const sorted = [...history].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  const currentQuantity = sorted[sorted.length - 1].quantity;

  // Simple linear depletion: (first - last) / days elapsed
  const firstPoint = sorted[0];
  const lastPoint = sorted[sorted.length - 1];

  const elapsedMs = new Date(lastPoint.recorded_at).getTime() - new Date(firstPoint.recorded_at).getTime();
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);

  if (elapsedDays < 0.1) {
    return { burnRatePerDay: 0, daysUntilStockout: null, currentQuantity };
  }

  // Positive burn rate = stock is decreasing
  const totalDepletion = firstPoint.quantity - lastPoint.quantity;
  const burnRatePerDay = totalDepletion / elapsedDays;

  // If stock is increasing (negative burn rate), no stockout predicted
  if (burnRatePerDay <= 0) {
    return { burnRatePerDay: 0, daysUntilStockout: null, currentQuantity };
  }

  const daysUntilStockout = currentQuantity / burnRatePerDay;

  return {
    burnRatePerDay: Math.round(burnRatePerDay * 100) / 100,
    daysUntilStockout: Math.round(daysUntilStockout * 10) / 10,
    currentQuantity,
  };
}

/**
 * Calculate a risk score (0-100) from burn rate data.
 * Pure math — no LLM needed for the base score.
 */
export function calculateRiskScore(
  daysUntilStockout: number | null,
  currentQuantity: number,
  reorderLevel: number
): number {
  // Already stocked out
  if (currentQuantity <= 0) return 100;

  // No depletion trend
  if (daysUntilStockout === null) return 5;

  let score = 0;

  // Days until stockout factor (0-60 points)
  if (daysUntilStockout <= 1) score += 60;
  else if (daysUntilStockout <= 3) score += 50;
  else if (daysUntilStockout <= 7) score += 35;
  else if (daysUntilStockout <= 14) score += 20;
  else if (daysUntilStockout <= 30) score += 10;
  else score += 5;

  // Below reorder level factor (0-30 points)
  if (currentQuantity <= reorderLevel * 0.25) score += 30;
  else if (currentQuantity <= reorderLevel * 0.5) score += 20;
  else if (currentQuantity <= reorderLevel) score += 15;
  else if (currentQuantity <= reorderLevel * 1.5) score += 5;

  // Absolute quantity factor (0-10 points)
  if (currentQuantity <= 5) score += 10;
  else if (currentQuantity <= 20) score += 5;

  return Math.min(100, score);
}

// ─── Data Gathering ────────────────────────────────────────

export async function gatherBurnRateData(): Promise<BurnRateData[]> {
  // Get all medicine stock with facility info
  const stockResult = await query(`
    SELECT
      ms.facility_id,
      f.name as facility_name,
      f.district,
      f.state,
      ms.medicine_name,
      ms.quantity as current_quantity,
      ms.reorder_level
    FROM medicine_stock ms
    JOIN facilities f ON f.id = ms.facility_id
    ORDER BY f.state, f.district, f.name, ms.medicine_name
  `);

  const burnRateResults: BurnRateData[] = [];

  for (const stock of stockResult.rows) {
    // Get recent history (last 7 days)
    const historyResult = await query(
      `SELECT quantity, recorded_at
       FROM stock_history
       WHERE facility_id = $1 AND medicine_name = $2
       ORDER BY recorded_at ASC
       LIMIT 50`,
      [stock.facility_id, stock.medicine_name]
    );

    const { burnRatePerDay, daysUntilStockout } = calculateBurnRate(historyResult.rows);
    const riskScore = calculateRiskScore(
      daysUntilStockout,
      stock.current_quantity,
      stock.reorder_level
    );

    burnRateResults.push({
      facility_id: stock.facility_id,
      facility_name: stock.facility_name,
      district: stock.district,
      state: stock.state,
      medicine_name: stock.medicine_name,
      current_quantity: stock.current_quantity,
      reorder_level: stock.reorder_level,
      burn_rate_per_day: burnRatePerDay,
      days_until_stockout: daysUntilStockout,
      risk_score: riskScore,
    });
  }

  return burnRateResults;
}

// ─── LLM Risk Assessment ──────────────────────────────────

interface LLMRiskAssessment {
  assessments: Array<{
    facility_name: string;
    medicine_name: string;
    adjusted_risk_score: number;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    explanation: string;
  }>;
  district_summary: string;
  overall_summary: string;
}

const FORECASTING_SYSTEM_PROMPT = `You are a public health supply chain analyst for India's Primary Health Centre (PHC) network.
You analyze medicine stock data and burn rates to produce actionable risk assessments.

IMPORTANT RULES:
- Return ONLY valid JSON matching the requested schema
- Be specific about which facilities and medicines are at risk
- Risk levels: "critical" (stockout imminent, <2 days), "high" (3-7 days), "medium" (7-14 days), "low" (>14 days or stable)
- adjusted_risk_score should be 0-100 and may differ from the input risk_score if you see contextual factors
- Summaries should be concise and actionable, suitable for a district health officer
- Consider that some medicines are more critical than others (e.g., insulin is more urgent than paracetamol)`;

export async function runLLMRiskAssessment(
  burnRateData: BurnRateData[]
): Promise<LLMRiskAssessment> {
  // Filter to only at-risk items to keep prompt focused
  const atRisk = burnRateData
    .filter(d => d.risk_score >= 25 || d.current_quantity <= d.reorder_level)
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 30); // Top 30 most at-risk to fit in context

  if (atRisk.length === 0) {
    return {
      assessments: [],
      district_summary: 'All facilities have adequate stock levels. No immediate concerns.',
      overall_summary: 'All facilities have adequate stock levels across the network.',
    };
  }

  const prompt = `Analyze these at-risk medicine stocks and provide risk assessments.

DATA (${atRisk.length} items at risk out of ${burnRateData.length} total):
${JSON.stringify(atRisk.map(d => ({
  facility: d.facility_name,
  district: d.district,
  medicine: d.medicine_name,
  qty: d.current_quantity,
  reorder_level: d.reorder_level,
  burn_rate_per_day: d.burn_rate_per_day,
  days_until_stockout: d.days_until_stockout,
  computed_risk_score: d.risk_score,
})), null, 2)}

Return JSON with this exact schema:
{
  "assessments": [
    {
      "facility_name": "string",
      "medicine_name": "string",
      "adjusted_risk_score": number,
      "risk_level": "critical" | "high" | "medium" | "low",
      "explanation": "string (1-2 sentences, actionable)"
    }
  ],
  "district_summary": "string (2-3 sentences summarizing district-level patterns)",
  "overall_summary": "string (1-2 sentences, headline for a health officer dashboard)"
}`;

  try {
    return await callLLMJSON<LLMRiskAssessment>(prompt, FORECASTING_SYSTEM_PROMPT);
  } catch (err) {
    console.error('LLM risk assessment failed, using fallback:', err);
    return generateFallbackAssessment(atRisk);
  }
}

// ─── Fallback (No LLM) ────────────────────────────────────

function generateFallbackAssessment(atRisk: BurnRateData[]): LLMRiskAssessment {
  const assessments = atRisk.map(d => {
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (d.risk_score >= 80) riskLevel = 'critical';
    else if (d.risk_score >= 60) riskLevel = 'high';
    else if (d.risk_score >= 35) riskLevel = 'medium';

    const daysText = d.days_until_stockout !== null
      ? `Expected stockout in ${d.days_until_stockout} days.`
      : 'No clear depletion trend.';

    return {
      facility_name: d.facility_name,
      medicine_name: d.medicine_name,
      adjusted_risk_score: d.risk_score,
      risk_level: riskLevel,
      explanation: `${d.medicine_name} at ${d.facility_name}: ${d.current_quantity} units remaining (reorder level: ${d.reorder_level}). ${daysText} Burn rate: ${d.burn_rate_per_day} units/day.`,
    };
  });

  const criticalCount = assessments.filter(a => a.risk_level === 'critical').length;
  const highCount = assessments.filter(a => a.risk_level === 'high').length;

  return {
    assessments,
    district_summary: `${criticalCount} critical and ${highCount} high-risk stock items identified across the network. Immediate attention required for facilities with stockout within 3 days.`,
    overall_summary: `${atRisk.length} medicine-facility combinations at risk. ${criticalCount} require immediate intervention.`,
  };
}

// ─── Run Full Forecasting Pipeline ─────────────────────────

export async function runForecasting(): Promise<{
  burnRateData: BurnRateData[];
  riskAssessment: LLMRiskAssessment;
  alertsCreated: number;
}> {
  console.log('📊 Running forecasting pipeline...');

  // Step 1: Calculate burn rates
  const burnRateData = await gatherBurnRateData();
  console.log(`  Calculated burn rates for ${burnRateData.length} stock items`);

  // Step 2: LLM risk assessment
  const riskAssessment = await runLLMRiskAssessment(burnRateData);
  console.log(`  LLM assessed ${riskAssessment.assessments.length} at-risk items`);

  // Step 3: Create/update alerts in database
  let alertsCreated = 0;
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Resolve old stock alerts
    await client.query(
      `UPDATE alerts SET is_resolved = true, resolved_at = NOW()
       WHERE alert_type IN ('stock_low', 'stock_out') AND is_resolved = false`
    );

    for (const assessment of riskAssessment.assessments) {
      if (assessment.risk_level === 'low') continue;

      // Find facility_id
      const facilityResult = await client.query(
        'SELECT id FROM facilities WHERE name = $1 LIMIT 1',
        [assessment.facility_name]
      );

      if (facilityResult.rows.length === 0) continue;

      const facilityId = facilityResult.rows[0].id;
      const alertType = assessment.adjusted_risk_score >= 95 ? 'stock_out' : 'stock_low';

      await client.query(
        `INSERT INTO alerts (facility_id, alert_type, severity, title, description, medicine_name, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          facilityId,
          alertType,
          assessment.risk_level,
          `${assessment.risk_level.toUpperCase()}: ${assessment.medicine_name} at ${assessment.facility_name}`,
          assessment.explanation,
          assessment.medicine_name,
          JSON.stringify({ risk_score: assessment.adjusted_risk_score }),
        ]
      );
      alertsCreated++;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Publish alert event
  if (alertsCreated > 0) {
    await publishToStream(STREAMS.ALERTS, {
      type: 'forecast_complete',
      alerts_created: String(alertsCreated),
      summary: riskAssessment.overall_summary,
      timestamp: new Date().toISOString(),
    });
  }

  console.log(`  Created ${alertsCreated} alerts`);
  console.log(`  Summary: ${riskAssessment.overall_summary}`);

  return { burnRateData, riskAssessment, alertsCreated };
}
