import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/pool';
import { publishToStream, STREAMS } from '../redis/client';
import {
  StockUpdateRequest,
  BedUpdateRequest,
  AttendanceUpdateRequest,
} from '../types';

export async function ingestionRoutes(fastify: FastifyInstance) {

  // ─── Stock Update ────────────────────────────────────────
  fastify.post('/api/ingest/stock', async (
    request: FastifyRequest<{ Body: StockUpdateRequest }>,
    reply: FastifyReply
  ) => {
    const { facility_id, medicine_name, quantity, unit } = request.body;

    if (!facility_id || !medicine_name || quantity === undefined) {
      return reply.status(400).send({ error: 'Missing required fields: facility_id, medicine_name, quantity' });
    }

    // Upsert stock
    const result = await query(
      `INSERT INTO medicine_stock (facility_id, medicine_name, quantity, unit, last_updated)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (facility_id, medicine_name)
       DO UPDATE SET quantity = $3, unit = COALESCE($4, medicine_stock.unit), last_updated = NOW()
       RETURNING *`,
      [facility_id, medicine_name, quantity, unit || 'tablets']
    );

    // Record in history for burn-rate calculation
    await query(
      `INSERT INTO stock_history (facility_id, medicine_name, quantity, recorded_at)
       VALUES ($1, $2, $3, NOW())`,
      [facility_id, medicine_name, quantity]
    );

    // Publish to Redis stream
    await publishToStream(STREAMS.STOCK_UPDATES, {
      facility_id,
      medicine_name,
      quantity: String(quantity),
      unit: unit || 'tablets',
      timestamp: new Date().toISOString(),
    });

    return reply.status(200).send({
      success: true,
      data: result.rows[0],
    });
  });

  // ─── Bed Update ──────────────────────────────────────────
  fastify.post('/api/ingest/beds', async (
    request: FastifyRequest<{ Body: BedUpdateRequest }>,
    reply: FastifyReply
  ) => {
    const { facility_id, total, occupied } = request.body;

    if (!facility_id || occupied === undefined) {
      return reply.status(400).send({ error: 'Missing required fields: facility_id, occupied' });
    }

    const result = await query(
      `INSERT INTO beds (facility_id, total, occupied, last_updated)
       VALUES ($1, COALESCE($2, 10), $3, NOW())
       ON CONFLICT (facility_id)
       DO UPDATE SET
         total = COALESCE($2, beds.total),
         occupied = $3,
         last_updated = NOW()
       RETURNING *`,
      [facility_id, total || null, occupied]
    );

    await publishToStream(STREAMS.BED_UPDATES, {
      facility_id,
      total: String(result.rows[0].total),
      occupied: String(occupied),
      timestamp: new Date().toISOString(),
    });

    return reply.status(200).send({
      success: true,
      data: result.rows[0],
    });
  });

  // ─── Attendance Update ───────────────────────────────────
  fastify.post('/api/ingest/attendance', async (
    request: FastifyRequest<{ Body: AttendanceUpdateRequest }>,
    reply: FastifyReply
  ) => {
    const { facility_id, staff_id, role, status } = request.body;

    if (!facility_id || !staff_id || !role) {
      return reply.status(400).send({ error: 'Missing required fields: facility_id, staff_id, role' });
    }

    const checkedInAt = new Date();
    const result = await query(
      `INSERT INTO personnel_attendance (facility_id, staff_id, role, checked_in_at, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (staff_id, checked_in_at) DO UPDATE SET status = $5
       RETURNING *`,
      [facility_id, staff_id, role, checkedInAt, status || 'present']
    );

    await publishToStream(STREAMS.ATTENDANCE_UPDATES, {
      facility_id,
      staff_id,
      role,
      status: status || 'present',
      timestamp: checkedInAt.toISOString(),
    });

    return reply.status(200).send({
      success: true,
      data: result.rows[0],
    });
  });

  // ─── Bulk Stock Update (for seed data) ───────────────────
  fastify.post('/api/ingest/stock/bulk', async (
    request: FastifyRequest<{ Body: StockUpdateRequest[] }>,
    reply: FastifyReply
  ) => {
    const updates = request.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return reply.status(400).send({ error: 'Body must be a non-empty array of stock updates' });
    }

    const client = await (await import('../db/pool')).getClient();
    try {
      await client.query('BEGIN');

      for (const update of updates) {
        await client.query(
          `INSERT INTO medicine_stock (facility_id, medicine_name, quantity, unit, last_updated)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (facility_id, medicine_name)
           DO UPDATE SET quantity = $3, unit = COALESCE($4, medicine_stock.unit), last_updated = NOW()`,
          [update.facility_id, update.medicine_name, update.quantity, update.unit || 'tablets']
        );

        await client.query(
          `INSERT INTO stock_history (facility_id, medicine_name, quantity, recorded_at)
           VALUES ($1, $2, $3, NOW())`,
          [update.facility_id, update.medicine_name, update.quantity]
        );
      }

      await client.query('COMMIT');

      // Publish a summary event
      await publishToStream(STREAMS.STOCK_UPDATES, {
        type: 'bulk_update',
        count: String(updates.length),
        timestamp: new Date().toISOString(),
      });

      return reply.status(200).send({ success: true, updated: updates.length });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });
}
