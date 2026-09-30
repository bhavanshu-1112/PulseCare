/**
 * Tests for the redistribution surplus pool tracking.
 *
 * Verifies that generateTransferCandidates decrements the surplus pool
 * across multiple deficit facilities to prevent double-allocation.
 */

import { generateTransferCandidates, haversineDistance } from '../ai/redistribution';

// Helper to create a deficit facility stub
function makeDeficit(id: string, name: string, medicine: string, deficitQty: number, urgency: number) {
  return {
    facility_id: id,
    facility_name: name,
    district: 'TestDistrict',
    state: 'TestState',
    latitude: 18.5, // All close to each other for testing
    longitude: 73.9,
    medicine_name: medicine,
    current_quantity: 10,
    deficit_quantity: deficitQty,
    days_until_stockout: 2,
    urgency,
  };
}

// Helper to create a surplus facility stub
function makeSurplus(id: string, name: string, medicine: string, surplusQty: number) {
  return {
    facility_id: id,
    facility_name: name,
    district: 'TestDistrict',
    state: 'TestState',
    latitude: 18.52, // ~2km away
    longitude: 73.92,
    medicine_name: medicine,
    current_quantity: 1000,
    surplus_quantity: surplusQty,
    burn_rate_per_day: 5,
  };
}

describe('haversineDistance', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineDistance(18.5, 73.9, 18.5, 73.9)).toBe(0);
  });

  it('returns reasonable distance between Pune and Mumbai (~150km)', () => {
    const dist = haversineDistance(18.52, 73.85, 19.08, 72.88);
    expect(dist).toBeGreaterThan(100);
    expect(dist).toBeLessThan(200);
  });
});

describe('generateTransferCandidates', () => {
  it('generates candidates for matching medicine names', () => {
    const deficits = [makeDeficit('d1', 'PHC-D1', 'Paracetamol', 100, 80)];
    const surpluses = [makeSurplus('s1', 'PHC-S1', 'Paracetamol', 200)];

    const candidates = generateTransferCandidates(deficits, surpluses);
    expect(candidates.length).toBe(1);
    expect(candidates[0].surplus.medicine_name).toBe('Paracetamol');
  });

  it('does NOT match different medicine names', () => {
    const deficits = [makeDeficit('d1', 'PHC-D1', 'Paracetamol', 100, 80)];
    const surpluses = [makeSurplus('s1', 'PHC-S1', 'Amoxicillin', 200)];

    const candidates = generateTransferCandidates(deficits, surpluses);
    expect(candidates.length).toBe(0);
  });

  it('prevents double-allocation: two deficits competing for one surplus', () => {
    const deficits = [
      makeDeficit('d1', 'PHC-D1', 'Paracetamol', 150, 90),
      makeDeficit('d2', 'PHC-D2', 'Paracetamol', 200, 70),
    ];
    // Only 250 surplus available
    const surpluses = [makeSurplus('s1', 'PHC-S1', 'Paracetamol', 250)];

    const candidates = generateTransferCandidates(deficits, surpluses, 500);

    // Total allocated must not exceed 250
    const totalAllocated = candidates.reduce((sum, c) => sum + c.surplus.surplus_quantity, 0);
    expect(totalAllocated).toBeLessThanOrEqual(250);

    // d1 is more urgent (90 > 70) so it should be fulfilled first
    const d1Candidate = candidates.find(c => c.deficit.facility_id === 'd1');
    expect(d1Candidate).toBeDefined();
    expect(d1Candidate!.surplus.surplus_quantity).toBe(150); // gets full need

    // d2 gets the remaining 100
    const d2Candidate = candidates.find(c => c.deficit.facility_id === 'd2');
    expect(d2Candidate).toBeDefined();
    expect(d2Candidate!.surplus.surplus_quantity).toBe(100); // 250 - 150
  });

  it('excludes candidates beyond max distance', () => {
    const deficits = [
      {
        ...makeDeficit('d1', 'PHC-D1', 'Paracetamol', 100, 80),
        latitude: 18.5,
        longitude: 73.9,
      },
    ];
    const surpluses = [
      {
        ...makeSurplus('s1', 'PHC-S1', 'Paracetamol', 200),
        latitude: 28.6, // Delhi — very far from Pune
        longitude: 77.2,
      },
    ];

    const candidates = generateTransferCandidates(deficits, surpluses, 200);
    expect(candidates.length).toBe(0);
  });

  it('does not assign a facility as both source and target', () => {
    const deficits = [makeDeficit('f1', 'PHC-F1', 'Paracetamol', 100, 80)];
    const surpluses = [makeSurplus('f1', 'PHC-F1', 'Paracetamol', 200)]; // Same facility

    const candidates = generateTransferCandidates(deficits, surpluses);
    expect(candidates.length).toBe(0);
  });
});
