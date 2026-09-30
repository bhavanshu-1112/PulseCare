/**
 * Live Simulation: Continuously generates plausible stock depletion,
 * occasional restocks, bed changes, and attendance updates.
 * Run as a background process alongside the server.
 *
 * Phase 2 fix: Added attendance simulation so the telemetry feed
 * includes staff check-in/check-out events.
 */

import { query } from '../db/pool';
import { publishToStream, STREAMS, redis, isRedisAvailable } from '../redis/client';

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

/**
 * Safely publish to Redis stream — silently skip if Redis is unavailable.
 */
async function safePublish(stream: string, data: Record<string, string>): Promise<void> {
  if (!isRedisAvailable()) return;
  try {
    await publishToStream(stream, data);
  } catch {
    // Redis may disconnect during runtime — don't crash the simulator
  }
}

async function simulateStockDepletion(): Promise<void> {
  const stocks = await query(`
    SELECT ms.*, f.name as facility_name
    FROM medicine_stock ms
    JOIN facilities f ON f.id = ms.facility_id
    WHERE ms.quantity > 0
    ORDER BY RANDOM()
    LIMIT 5
  `);

  for (const stock of stocks.rows) {
    const depletion = rand(1, Math.min(stock.quantity, 15));
    const newQty = Math.max(0, Math.round(stock.quantity - depletion));

    await query(
      `UPDATE medicine_stock SET quantity = $1, last_updated = NOW()
       WHERE facility_id = $2 AND medicine_name = $3`,
      [newQty, stock.facility_id, stock.medicine_name]
    );

    await query(
      `INSERT INTO stock_history (facility_id, medicine_name, quantity, recorded_at)
       VALUES ($1, $2, $3, NOW())`,
      [stock.facility_id, stock.medicine_name, newQty]
    );

    await safePublish(STREAMS.STOCK_UPDATES, {
      facility_id: stock.facility_id,
      facility_name: stock.facility_name,
      medicine_name: stock.medicine_name,
      quantity: String(newQty),
      previous_quantity: String(stock.quantity),
      timestamp: new Date().toISOString(),
    });

    if (newQty <= stock.reorder_level && stock.quantity > stock.reorder_level) {
      console.log(`  ⚠ ${stock.facility_name}: ${stock.medicine_name} dropped below reorder level (${newQty}/${stock.reorder_level})`);
    }
  }
}

async function simulateRestock(): Promise<void> {
  if (Math.random() > 0.10) return;

  const lowStock = await query(`
    SELECT ms.*, f.name as facility_name
    FROM medicine_stock ms
    JOIN facilities f ON f.id = ms.facility_id
    WHERE ms.quantity < ms.reorder_level
    ORDER BY RANDOM()
    LIMIT 1
  `);

  if (lowStock.rows.length === 0) return;

  const stock = lowStock.rows[0];
  const restockQty = Math.round(stock.max_capacity * rand(0.5, 0.8));

  await query(
    `UPDATE medicine_stock SET quantity = $1, last_updated = NOW()
     WHERE facility_id = $2 AND medicine_name = $3`,
    [restockQty, stock.facility_id, stock.medicine_name]
  );

  await query(
    `INSERT INTO stock_history (facility_id, medicine_name, quantity, recorded_at)
     VALUES ($1, $2, $3, NOW())`,
    [stock.facility_id, stock.medicine_name, restockQty]
  );

  await safePublish(STREAMS.STOCK_UPDATES, {
    facility_id: stock.facility_id,
    facility_name: stock.facility_name,
    medicine_name: stock.medicine_name,
    quantity: String(restockQty),
    previous_quantity: String(stock.quantity),
    event: 'restock',
    timestamp: new Date().toISOString(),
  });

  console.log(`  📦 Restocked ${stock.facility_name}: ${stock.medicine_name} → ${restockQty}`);
}

async function simulateBedChanges(): Promise<void> {
  const beds = await query(`
    SELECT b.*, f.name as facility_name
    FROM beds b
    JOIN facilities f ON f.id = b.facility_id
    ORDER BY RANDOM()
    LIMIT 2
  `);

  for (const bed of beds.rows) {
    const change = randInt(-2, 3);
    const newOccupied = Math.max(0, Math.min(bed.total, bed.occupied + change));

    if (newOccupied !== bed.occupied) {
      await query(
        `UPDATE beds SET occupied = $1, last_updated = NOW() WHERE facility_id = $2`,
        [newOccupied, bed.facility_id]
      );

      await safePublish(STREAMS.BED_UPDATES, {
        facility_id: bed.facility_id,
        facility_name: bed.facility_name,
        total: String(bed.total),
        occupied: String(newOccupied),
        timestamp: new Date().toISOString(),
      });
    }
  }
}

async function simulateAttendance(): Promise<void> {
  if (Math.random() > 0.15) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const absentStaff = await query(`
    SELECT pa.*, p.staff_name, f.name as facility_name
    FROM personnel_attendance pa
    JOIN personnel p ON p.id = pa.staff_id
    JOIN facilities f ON f.id = pa.facility_id
    WHERE pa.status = 'absent' AND pa.checked_in_at >= $1
    ORDER BY RANDOM()
    LIMIT 1
  `, [today]);

  if (absentStaff.rows.length === 0) return;

  const staff = absentStaff.rows[0];
  const lateCheckIn = new Date();

  await query(
    `UPDATE personnel_attendance SET status = 'present', checked_in_at = $1
     WHERE staff_id = $2 AND checked_in_at >= $3`,
    [lateCheckIn, staff.staff_id, today]
  );

  await safePublish(STREAMS.STOCK_UPDATES, {
    facility_id: staff.facility_id,
    facility_name: staff.facility_name,
    event: 'late_checkin',
    staff_name: staff.staff_name,
    role: staff.role,
    timestamp: lateCheckIn.toISOString(),
  });

  console.log(`  👤 Late arrival: ${staff.staff_name} (${staff.role}) at ${staff.facility_name}`);
}

export async function startSimulation(intervalMs: number = 5000): Promise<void> {
  console.log(`\n🔄 Starting live simulation (interval: ${intervalMs}ms)...\n`);

  // Only connect to Redis if available — simulation works without it (just no stream publishing)
  if (isRedisAvailable()) {
    try {
      await redis.connect();
    } catch {
      console.warn('⚠️  Redis unavailable for simulation — running DB-only mode');
    }
  } else {
    console.log('  ℹ Running simulation in DB-only mode (no Redis stream publishing)');
  }

  const tick = async () => {
    try {
      await simulateStockDepletion();
      await simulateRestock();
      await simulateBedChanges();
      await simulateAttendance();
    } catch (err) {
      console.error('Simulation tick error:', err);
    }
  };

  await tick();
  setInterval(tick, intervalMs);
}
