/**
 * Redistribution Recommendation Engine
 *
 * The centerpiece feature: given predicted stock-outs at some facilities
 * and surpluses at others, generates ranked redistribution suggestions
 * with explainable AI reasoning.
 *
 * Flow:
 * 1. Identify deficit facilities (low/stockout, high burn rate)
 * 2. Identify surplus facilities (well-stocked, low burn rate)
 * 3. Calculate distances between facilities
 * 4. Pass structured surplus/deficit data to LLM for reasoning
 * 5. Store recommendations in DB
 */

import { query, getClient } from '../db/pool';
import { callLLMJSON } from './llm-client';
import { BurnRateData, RedistributionSuggestion } from '../types';
import { gatherBurnRateData } from './forecasting';

// ─── Geo Distance ──────────────────────────────────────────

/**
 * Haversine distance between two lat/lng points in kilometers.
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// ─── Data Structures ──────────────────────────────────────

interface FacilityStock {
  facility_id: string;
  facility_name: string;
  district: string;
  state: string;
  latitude: number;
  longitude: number;
  medicine_name: string;
  current_quantity: number;
  reorder_level: number;
  max_capacity: number;
  burn_rate_per_day: number;
  days_until_stockout: number | null;
  risk_score: number;
}

interface DeficitFacility {
  facility_id: string;
  facility_name: string;
  district: string;
  state: string;
  latitude: number;
  longitude: number;
  medicine_name: string;
  current_quantity: number;
  deficit_quantity: number;  // How many units needed to reach reorder level
  days_until_stockout: number | null;
  urgency: number;  // 0-100
}

interface SurplusFacility {
  facility_id: string;
  facility_name: string;
  district: string;
  state: string;
  latitude: number;
  longitude: number;
  medicine_name: string;
  current_quantity: number;
  surplus_quantity: number;  // How many units can be spared
  burn_rate_per_day: number;
}

// ─── Identify Deficit & Surplus ───────────────────────────

export async function identifyDeficitsAndSurpluses(burnRateData: BurnRateData[]): Promise<{
  deficits: DeficitFacility[];
  surpluses: SurplusFacility[];
}> {
  // Get facility coordinates
  const facilitiesResult = await query(
    'SELECT id, name, district, state, latitude, longitude FROM facilities'
  );
  const facilityMap = new Map(
    facilitiesResult.rows.map((f: any) => [f.id, f])
  );

  // Get max capacities
  const stockResult = await query(
    'SELECT facility_id, medicine_name, max_capacity FROM medicine_stock'
  );
  const capacityMap = new Map(
    stockResult.rows.map((s: any) => [`${s.facility_id}:${s.medicine_name}`, s.max_capacity])
  );

  const deficits: DeficitFacility[] = [];
  const surpluses: SurplusFacility[] = [];

  for (const data of burnRateData) {
    const facility = facilityMap.get(data.facility_id);
    if (!facility) continue;

    const maxCapacity = capacityMap.get(`${data.facility_id}:${data.medicine_name}`) || 1000;

    if (data.risk_score >= 40 || data.current_quantity <= data.reorder_level) {
      // Deficit: needs stock
      const deficitQty = Math.max(0, data.reorder_level * 2 - data.current_quantity);
      deficits.push({
        facility_id: data.facility_id,
        facility_name: data.facility_name,
        district: data.district,
        state: data.state,
        latitude: facility.latitude,
        longitude: facility.longitude,
        medicine_name: data.medicine_name,
        current_quantity: data.current_quantity,
        deficit_quantity: Math.round(deficitQty),
        days_until_stockout: data.days_until_stockout,
        urgency: data.risk_score,
      });
    } else if (data.current_quantity > data.reorder_level * 3) {
      // Surplus: can spare some stock
      const safeMinimum = data.reorder_level * 2;
      const surplusQty = data.current_quantity - safeMinimum;
      if (surplusQty > 0) {
        surpluses.push({
          facility_id: data.facility_id,
          facility_name: data.facility_name,
          district: data.district,
          state: data.state,
          latitude: facility.latitude,
          longitude: facility.longitude,
          medicine_name: data.medicine_name,
          current_quantity: data.current_quantity,
          surplus_quantity: Math.round(surplusQty),
          burn_rate_per_day: data.burn_rate_per_day,
        });
      }
    }
  }

  // Sort deficits by urgency (highest first)
  deficits.sort((a, b) => b.urgency - a.urgency);

  return { deficits, surpluses };
}

// ─── Candidate Matching ───────────────────────────────────

interface TransferCandidate {
  deficit: DeficitFacility;
  surplus: SurplusFacility;
  distance_km: number;
  feasibility_score: number; // 0-100 based on distance and quantity
}

export function generateTransferCandidates(
  deficits: DeficitFacility[],
  surpluses: SurplusFacility[],
  maxDistanceKm: number = 200
): TransferCandidate[] {
  const candidates: TransferCandidate[] = [];

  // Track remaining surplus per facility+medicine to prevent double-allocation
  const remainingSurplus = new Map<string, number>();
  for (const s of surpluses) {
    remainingSurplus.set(`${s.facility_id}:${s.medicine_name}`, s.surplus_quantity);
  }

  // Sort deficits by urgency (most urgent first) to prioritise critical needs
  const sortedDeficits = [...deficits].sort((a, b) => b.urgency - a.urgency);

  for (const deficit of sortedDeficits) {
    let remainingNeed = deficit.deficit_quantity;
    if (remainingNeed <= 0) continue;

    // Find matching surpluses (same medicine, within range, still has stock)
    const matchingSurpluses = surpluses
      .filter(s => {
        if (s.medicine_name !== deficit.medicine_name) return false;
        if (s.facility_id === deficit.facility_id) return false;
        const key = `${s.facility_id}:${s.medicine_name}`;
        return (remainingSurplus.get(key) || 0) > 0;
      })
      .map(s => {
        const distance = haversineDistance(
          deficit.latitude, deficit.longitude,
          s.latitude, s.longitude
        );
        return { surplus: s, distance };
      })
      .filter(x => x.distance <= maxDistanceKm)
      .sort((a, b) => a.distance - b.distance);  // prefer closer facilities

    for (const { surplus, distance } of matchingSurpluses) {
      if (remainingNeed <= 0) break;

      const surplusKey = `${surplus.facility_id}:${surplus.medicine_name}`;
      const available = remainingSurplus.get(surplusKey) || 0;
      if (available <= 0) continue;

      // Allocate the smaller of what's available and what's needed
      const allocatedQty = Math.min(available, remainingNeed);

      // Decrement the remaining pool
      remainingSurplus.set(surplusKey, available - allocatedQty);
      remainingNeed -= allocatedQty;

      // Feasibility: closer + more surplus = more feasible
      const distanceScore = Math.max(0, 100 - (distance / maxDistanceKm) * 100);
      const quantityScore = Math.min(100, (allocatedQty / Math.max(1, deficit.deficit_quantity)) * 50);
      const feasibility = Math.round((distanceScore * 0.6 + quantityScore * 0.4));

      // Clone surplus with the allocated quantity
      candidates.push({
        deficit,
        surplus: { ...surplus, surplus_quantity: allocatedQty },
        distance_km: distance,
        feasibility_score: feasibility,
      });
    }
  }

  // Sort by combined urgency + feasibility
  candidates.sort((a, b) => {
    const scoreA = a.deficit.urgency * 0.6 + a.feasibility_score * 0.4;
    const scoreB = b.deficit.urgency * 0.6 + b.feasibility_score * 0.4;
    return scoreB - scoreA;
  });

  return candidates.slice(0, 20); // Top 20 candidates for LLM
}

// ─── LLM Redistribution Reasoning ─────────────────────────

interface LLMRedistributionResult {
  recommendations: Array<{
    source_facility: string;
    target_facility: string;
    medicine_name: string;
    transfer_quantity: number;
    urgency_score: number;
    reasoning: string;
  }>;
  overall_plan: string;
}

const REDISTRIBUTION_SYSTEM_PROMPT = `You are a logistics optimization expert for India's Primary Health Centre (PHC) network.
Your job is to recommend medicine transfers between facilities to prevent stock-outs.

IMPORTANT RULES:
- Return ONLY valid JSON matching the requested schema
- Each recommendation must have a clear, explainable reasoning
- Consider: urgency (days until stockout), distance (shorter is better), transport feasibility
- Don't recommend transfers that would put the source facility at risk
- Don't recommend transferring more than the surplus can safely spare
- Prioritize critical medicines (insulin, antibiotics) over common ones (paracetamol)
- urgency_score should be 0-100 (100 = most urgent)
- Keep reasoning concise but informative — these appear on a dashboard for health officers
- The overall_plan should summarize the redistribution strategy in 2-3 sentences`;

export async function runLLMRedistribution(
  candidates: TransferCandidate[]
): Promise<LLMRedistributionResult> {
  if (candidates.length === 0) {
    return {
      recommendations: [],
      overall_plan: 'No redistribution needed — all facilities have adequate stock or no viable transfer routes exist.',
    };
  }

  const prompt = `Analyze these potential medicine transfers and recommend the best ones.

TRANSFER CANDIDATES (${candidates.length} options):
${JSON.stringify(candidates.map(c => ({
  source: {
    facility: c.surplus.facility_name,
    district: c.surplus.district,
    medicine: c.surplus.medicine_name,
    current_stock: c.surplus.current_quantity,
    surplus_available: c.surplus.surplus_quantity,
    burn_rate: c.surplus.burn_rate_per_day,
  },
  target: {
    facility: c.deficit.facility_name,
    district: c.deficit.district,
    medicine: c.deficit.medicine_name,
    current_stock: c.deficit.current_quantity,
    deficit_needed: c.deficit.deficit_quantity,
    days_until_stockout: c.deficit.days_until_stockout,
    urgency: c.deficit.urgency,
  },
  distance_km: c.distance_km,
  feasibility_score: c.feasibility_score,
})), null, 2)}

Select the best transfers (up to 10) and return JSON:
{
  "recommendations": [
    {
      "source_facility": "exact facility name from data",
      "target_facility": "exact facility name from data",
      "medicine_name": "exact medicine name",
      "transfer_quantity": number,
      "urgency_score": number (0-100),
      "reasoning": "1-2 sentences explaining why this transfer makes sense"
    }
  ],
  "overall_plan": "2-3 sentence summary of the redistribution strategy"
}`;

  try {
    return await callLLMJSON<LLMRedistributionResult>(prompt, REDISTRIBUTION_SYSTEM_PROMPT);
  } catch (err) {
    console.error('LLM redistribution failed, using fallback:', err);
    return generateFallbackRedistribution(candidates);
  }
}

// ─── Fallback (No LLM) ────────────────────────────────────

function generateFallbackRedistribution(
  candidates: TransferCandidate[]
): LLMRedistributionResult {
  // The surplus_quantity on each candidate already reflects the allocated
  // (deduplicated) amount from generateTransferCandidates, so we can
  // safely use it directly without further pool tracking.
  const recommendations = candidates.slice(0, 10).map(c => {
    const transferQty = c.surplus.surplus_quantity; // already capped by pool
    return {
      source_facility: c.surplus.facility_name,
      target_facility: c.deficit.facility_name,
      medicine_name: c.surplus.medicine_name,
      transfer_quantity: Math.round(transferQty),
      urgency_score: Math.round(c.deficit.urgency * 0.6 + c.feasibility_score * 0.4),
      reasoning: `Transfer ${Math.round(transferQty)} units of ${c.surplus.medicine_name} from ${c.surplus.facility_name} (allocated: ${c.surplus.surplus_quantity}) to ${c.deficit.facility_name} (${c.deficit.days_until_stockout !== null ? `stockout in ${c.deficit.days_until_stockout} days` : 'low stock'}). Distance: ${c.distance_km} km.`,
    };
  });

  return {
    recommendations,
    overall_plan: `${recommendations.length} medicine transfers recommended to prevent stock-outs at ${new Set(recommendations.map(r => r.target_facility)).size} facilities. Prioritized by urgency and transport distance.`,
  };
}

// ─── Run Full Redistribution Pipeline ──────────────────────

export async function runRedistribution(): Promise<{
  deficits: DeficitFacility[];
  surpluses: SurplusFacility[];
  candidates: TransferCandidate[];
  result: LLMRedistributionResult;
  savedCount: number;
}> {
  console.log('🔄 Running redistribution pipeline...');

  // Step 1: Get burn rate data
  const burnRateData = await gatherBurnRateData();

  // Step 2: Identify deficits and surpluses
  const { deficits, surpluses } = await identifyDeficitsAndSurpluses(burnRateData);
  console.log(`  Found ${deficits.length} deficit items, ${surpluses.length} surplus items`);

  // Step 3: Generate candidates
  const candidates = generateTransferCandidates(deficits, surpluses);
  console.log(`  Generated ${candidates.length} transfer candidates`);

  // Step 4: LLM reasoning
  const result = await runLLMRedistribution(candidates);
  console.log(`  LLM recommended ${result.recommendations.length} transfers`);

  // Step 5: Save to database
  let savedCount = 0;
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Mark old pending recommendations as superseded
    await client.query(
      `UPDATE redistribution_recommendations SET status = 'rejected'
       WHERE status = 'pending'`
    );

    for (const rec of result.recommendations) {
      // Look up facility IDs
      const sourceResult = await client.query(
        'SELECT id, latitude, longitude FROM facilities WHERE name = $1 LIMIT 1',
        [rec.source_facility]
      );
      const targetResult = await client.query(
        'SELECT id, latitude, longitude FROM facilities WHERE name = $1 LIMIT 1',
        [rec.target_facility]
      );

      if (sourceResult.rows.length === 0 || targetResult.rows.length === 0) continue;

      const source = sourceResult.rows[0];
      const target = targetResult.rows[0];
      const distance = haversineDistance(
        source.latitude, source.longitude,
        target.latitude, target.longitude
      );

      await client.query(
        `INSERT INTO redistribution_recommendations
         (source_facility_id, target_facility_id, medicine_name, recommended_quantity,
          urgency_score, distance_km, reasoning, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
        [
          source.id,
          target.id,
          rec.medicine_name,
          rec.transfer_quantity,
          rec.urgency_score,
          distance,
          rec.reasoning,
        ]
      );
      savedCount++;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log(`  Saved ${savedCount} recommendations to database`);
  console.log(`  Plan: ${result.overall_plan}`);

  return { deficits, surpluses, candidates, result, savedCount };
}
