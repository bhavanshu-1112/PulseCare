/**
 * PulseCare Synthetic Data Generator
 *
 * Generates a realistic network of PHCs across Indian states/districts
 * with staff, medicine stock, bed data, and ongoing simulated updates.
 *
 * Phase 2 fixes:
 * - 3 states × 4 districts × ~4 PHCs each = ~48 facilities (realistic clustering)
 * - Attendance seeded relative to TODAY with proper check-in timestamps
 * - More variance in stock levels to create interesting deficit/surplus patterns
 */

import { query, getClient } from '../db/pool';
import { v4 as uuid } from 'uuid';

// ─── Reference Data ────────────────────────────────────────
// Reduced to 3 states × 4 districts for realistic multi-PHC-per-district clustering

const STATES_DISTRICTS: Record<string, string[]> = {
  'Maharashtra': ['Pune', 'Nagpur', 'Nashik', 'Aurangabad'],
  'Rajasthan': ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Salem'],
};

const MEDICINES = [
  { name: 'Paracetamol 500mg', unit: 'tablets', daily_usage_range: [5, 30] },
  { name: 'Amoxicillin 250mg', unit: 'capsules', daily_usage_range: [3, 15] },
  { name: 'ORS Packets', unit: 'packets', daily_usage_range: [2, 20] },
  { name: 'Metformin 500mg', unit: 'tablets', daily_usage_range: [5, 25] },
  { name: 'Amlodipine 5mg', unit: 'tablets', daily_usage_range: [3, 12] },
  { name: 'Iron Folic Acid', unit: 'tablets', daily_usage_range: [10, 40] },
  { name: 'Chloroquine', unit: 'tablets', daily_usage_range: [1, 8] },
  { name: 'Cotrimoxazole', unit: 'tablets', daily_usage_range: [2, 10] },
  { name: 'Povidone Iodine', unit: 'bottles', daily_usage_range: [0.5, 3] },
  { name: 'Insulin (Regular)', unit: 'vials', daily_usage_range: [0.2, 2] },
];

const STAFF_ROLES = [
  { role: 'Doctor', count_range: [1, 3] },
  { role: 'Nurse', count_range: [2, 5] },
  { role: 'Pharmacist', count_range: [1, 2] },
  { role: 'Lab Technician', count_range: [0, 2] },
  { role: 'Health Worker', count_range: [2, 4] },
  { role: 'Admin Staff', count_range: [1, 2] },
];

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan',
  'Ananya', 'Diya', 'Saanvi', 'Isha', 'Kiara', 'Riya', 'Priya', 'Neha',
  'Meera', 'Kavya', 'Tanvi', 'Pooja', 'Rahul', 'Amit', 'Suresh', 'Rajesh',
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Singh', 'Kumar', 'Gupta', 'Reddy', 'Nair',
  'Das', 'Joshi', 'Rao', 'Iyer', 'Pillai', 'Chauhan', 'Yadav', 'Malhotra',
];

// ─── Helpers ───────────────────────────────────────────────

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateCoords(state: string): { lat: number; lng: number } {
  // Approximate bounding boxes for each state
  const bounds: Record<string, { lat: [number, number]; lng: [number, number] }> = {
    'Maharashtra': { lat: [17.5, 21.0], lng: [72.5, 77.5] },
    'Rajasthan': { lat: [24.0, 30.0], lng: [69.5, 76.5] },
    'Tamil Nadu': { lat: [8.0, 13.5], lng: [76.0, 80.5] },
  };
  const b = bounds[state] || { lat: [20, 25], lng: [75, 80] };
  return {
    lat: rand(b.lat[0], b.lat[1]),
    lng: rand(b.lng[0], b.lng[1]),
  };
}

/**
 * Get midnight of the current day in local time.
 */
function todayMidnight(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

// ─── Seed Functions ────────────────────────────────────────

/**
 * Seed facilities with 3-5 PHCs per district across 3 states × 4 districts.
 * Total: ~36-60 facilities.
 */
export async function seedFacilities(targetCount: number = 48): Promise<string[]> {
  console.log(`Seeding facilities (~${targetCount})...`);
  const facilityIds: string[] = [];

  const states = Object.keys(STATES_DISTRICTS);
  const totalDistricts = states.reduce((sum, s) => sum + STATES_DISTRICTS[s].length, 0);
  const phcsPerDistrict = Math.max(3, Math.ceil(targetCount / totalDistricts));

  for (const state of states) {
    const districts = STATES_DISTRICTS[state];
    for (const district of districts) {
      const numPHCs = randInt(Math.max(3, phcsPerDistrict - 1), phcsPerDistrict + 1);
      for (let i = 0; i < numPHCs; i++) {
        const coords = generateCoords(state);
        const id = uuid();
        const totalBeds = randInt(5, 30);
        const name = `PHC ${district}-${i + 1}`;

        await query(
          `INSERT INTO facilities (id, name, facility_type, district, state, latitude, longitude, total_beds, contact_phone)
           VALUES ($1, $2, 'PHC', $3, $4, $5, $6, $7, $8)
           ON CONFLICT DO NOTHING`,
          [id, name, district, state, coords.lat, coords.lng, totalBeds, `+91-${randInt(7000000000, 9999999999)}`]
        );

        facilityIds.push(id);
      }
    }
  }

  console.log(`  Created ${facilityIds.length} facilities across ${totalDistricts} districts.`);
  return facilityIds;
}

export async function seedMedicineStock(facilityIds: string[]): Promise<void> {
  console.log('Seeding medicine stock...');
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Build batch inserts for stock
    const stockValues: any[] = [];
    const stockPlaceholders: string[] = [];
    let stockIdx = 1;

    const historyValues: any[] = [];
    const historyPlaceholders: string[] = [];
    let histIdx = 1;

    for (const facilityId of facilityIds) {
      for (const med of MEDICINES) {
        const maxCapacity = randInt(200, 2000);
        const reorderLevel = Math.round(maxCapacity * rand(0.1, 0.25));

        // Create more interesting variance: 20% low, 5% stockout, 75% normal
        const roll = Math.random();
        let quantity: number;
        if (roll < 0.05) {
          quantity = 0; // Stockout
        } else if (roll < 0.20) {
          quantity = randInt(1, reorderLevel); // Low stock
        } else if (roll < 0.35) {
          quantity = randInt(reorderLevel, reorderLevel * 2); // Moderate
        } else {
          quantity = randInt(reorderLevel * 2, maxCapacity); // Healthy surplus
        }

        stockPlaceholders.push(
          `($${stockIdx++}, $${stockIdx++}, $${stockIdx++}, $${stockIdx++}, $${stockIdx++}, $${stockIdx++}, NOW())`
        );
        stockValues.push(facilityId, med.name, quantity, med.unit, reorderLevel, maxCapacity);

        // History points (past 7 days) — simulate realistic depletion
        for (let day = 7; day >= 0; day--) {
          const dailyUsage = rand(med.daily_usage_range[0], med.daily_usage_range[1]);
          const historicalQty = Math.max(0, quantity + Math.round(dailyUsage * day * rand(0.5, 1.5)));
          const recordedAt = new Date();
          recordedAt.setDate(recordedAt.getDate() - day);
          recordedAt.setHours(randInt(6, 22), randInt(0, 59), 0, 0);

          historyPlaceholders.push(
            `($${histIdx++}, $${histIdx++}, $${histIdx++}, $${histIdx++})`
          );
          historyValues.push(facilityId, med.name, Math.round(historicalQty), recordedAt);
        }
      }
    }

    // Execute stock batch (single INSERT)
    if (stockPlaceholders.length > 0) {
      await client.query(
        `INSERT INTO medicine_stock (facility_id, medicine_name, quantity, unit, reorder_level, max_capacity, last_updated)
         VALUES ${stockPlaceholders.join(', ')}
         ON CONFLICT (facility_id, medicine_name)
         DO UPDATE SET quantity = EXCLUDED.quantity, last_updated = NOW()`,
        stockValues
      );
      console.log(`  Inserted ${stockPlaceholders.length} stock entries.`);
    }

    // Execute history in batches of 500 to stay within param limits
    const BATCH_SIZE = 500;
    for (let i = 0; i < historyPlaceholders.length; i += BATCH_SIZE) {
      const batchValues: any[] = [];
      const reindexedPlaceholders: string[] = [];
      let bIdx = 1;

      for (let j = i; j < Math.min(i + BATCH_SIZE, historyPlaceholders.length); j++) {
        const baseIdx = j * 4; // 4 params per row
        batchValues.push(historyValues[baseIdx], historyValues[baseIdx + 1], historyValues[baseIdx + 2], historyValues[baseIdx + 3]);
        reindexedPlaceholders.push(`($${bIdx++}, $${bIdx++}, $${bIdx++}, $${bIdx++})`);
      }

      await client.query(
        `INSERT INTO stock_history (facility_id, medicine_name, quantity, recorded_at)
         VALUES ${reindexedPlaceholders.join(', ')}`,
        batchValues
      );
    }
    console.log(`  Inserted ${historyPlaceholders.length} history records.`);

    await client.query('COMMIT');
    console.log(`  Stocked ${facilityIds.length * MEDICINES.length} medicine entries with history.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function seedBeds(facilityIds: string[]): Promise<void> {
  console.log('Seeding bed data...');

  // First, get all facilities' total_beds in one query
  const result = await query(
    `SELECT id, total_beds FROM facilities WHERE id = ANY($1)`,
    [facilityIds]
  );
  const bedMap = new Map(result.rows.map((r: any) => [r.id, r.total_beds || 10]));

  // Build batch insert
  const values: any[] = [];
  const placeholders: string[] = [];
  let idx = 1;

  for (const facilityId of facilityIds) {
    const total = bedMap.get(facilityId) || 10;
    const occupied = randInt(0, total);
    placeholders.push(`($${idx++}, $${idx++}, $${idx++}, NOW())`);
    values.push(facilityId, total, occupied);
  }

  await query(
    `INSERT INTO beds (facility_id, total, occupied, last_updated)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (facility_id)
     DO UPDATE SET occupied = EXCLUDED.occupied, last_updated = NOW()`,
    values
  );

  console.log(`  Created bed data for ${facilityIds.length} facilities.`);
}

export async function seedPersonnel(facilityIds: string[]): Promise<Map<string, string[]>> {
  console.log('Seeding personnel...');
  const staffMap = new Map<string, string[]>();
  const client = await getClient();

  try {
    await client.query('BEGIN');

    const values: any[] = [];
    const placeholders: string[] = [];
    let idx = 1;

    for (const facilityId of facilityIds) {
      const staffIds: string[] = [];

      for (const { role, count_range } of STAFF_ROLES) {
        const count = randInt(count_range[0], count_range[1]);
        for (let i = 0; i < count; i++) {
          const id = uuid();
          const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
          placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++})`);
          values.push(id, facilityId, name, role);
          staffIds.push(id);
        }
      }

      staffMap.set(facilityId, staffIds);
    }

    // Single batch insert
    if (placeholders.length > 0) {
      await client.query(
        `INSERT INTO personnel (id, facility_id, staff_name, role) VALUES ${placeholders.join(', ')}`,
        values
      );
    }

    await client.query('COMMIT');

    const totalStaff = Array.from(staffMap.values()).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`  Created ${totalStaff} personnel across ${facilityIds.length} facilities.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return staffMap;
}

/**
 * Seed today's attendance with realistic check-in times.
 * 
 * FIX: Uses today's date (not the server-start date) and generates
 * timestamps between 07:00-10:00 for present staff, ensuring the
 * dashboard midnight filter always finds matching records.
 * Attendance rate: 70-95% per facility (realistic).
 */
export async function seedTodayAttendance(staffMap: Map<string, string[]>): Promise<void> {
  console.log("Seeding today's attendance...");
  const client = await getClient();

  // Base time: today at 07:00
  const baseCheckIn = todayMidnight();
  baseCheckIn.setHours(7, 0, 0, 0);

  // Get all personnel roles in one query
  const allStaffIds = Array.from(staffMap.values()).flat();
  const rolesResult = await client.query(
    `SELECT id, role FROM personnel WHERE id = ANY($1)`,
    [allStaffIds]
  );
  const roleMap = new Map(rolesResult.rows.map((r: any) => [r.id, r.role]));

  try {
    await client.query('BEGIN');

    const values: any[] = [];
    const placeholders: string[] = [];
    let idx = 1;

    for (const [facilityId, staffIds] of staffMap) {
      // Each facility has 70-95% attendance
      const attendanceRate = rand(0.70, 0.95);

      for (const staffId of staffIds) {
        const role = roleMap.get(staffId) || 'Health Worker';
        const isPresent = Math.random() < attendanceRate;
        const status = isPresent ? 'present' : (Math.random() < 0.6 ? 'absent' : 'on_leave');

        // Check-in time: today between 07:00 - 10:00 (spread over 180 min)
        const checkIn = new Date(baseCheckIn);
        checkIn.setMinutes(checkIn.getMinutes() + randInt(0, 180));

        placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
        values.push(facilityId, staffId, role, checkIn, status);
      }
    }

    // Batch insert in chunks of 500
    const BATCH = 500;
    for (let i = 0; i < placeholders.length; i += BATCH) {
      const batchPlaceholders: string[] = [];
      const batchValues: any[] = [];
      let bIdx = 1;

      for (let j = i; j < Math.min(i + BATCH, placeholders.length); j++) {
        const baseIdx = j * 5;
        batchValues.push(values[baseIdx], values[baseIdx + 1], values[baseIdx + 2], values[baseIdx + 3], values[baseIdx + 4]);
        batchPlaceholders.push(`($${bIdx++}, $${bIdx++}, $${bIdx++}, $${bIdx++}, $${bIdx++})`);
      }

      await client.query(
        `INSERT INTO personnel_attendance (facility_id, staff_id, role, checked_in_at, status)
         VALUES ${batchPlaceholders.join(', ')}
         ON CONFLICT (staff_id, checked_in_at) DO NOTHING`,
        batchValues
      );
    }

    await client.query('COMMIT');
    console.log('  Attendance seeded for today.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Full Seed ─────────────────────────────────────────────

export async function runFullSeed(facilityCount: number = 48): Promise<void> {
  console.log('═══════════════════════════════════════════');
  console.log('  PulseCare Synthetic Data Generator');
  console.log('═══════════════════════════════════════════\n');

  const facilityIds = await seedFacilities(facilityCount);
  await seedMedicineStock(facilityIds);
  await seedBeds(facilityIds);
  const staffMap = await seedPersonnel(facilityIds);
  await seedTodayAttendance(staffMap);

  console.log('\n✅ Seed complete!');
  console.log(`   ${facilityIds.length} facilities`);
  console.log(`   ${facilityIds.length * MEDICINES.length} stock entries`);
  console.log(`   ${Array.from(staffMap.values()).reduce((s, a) => s + a.length, 0)} personnel`);
}
