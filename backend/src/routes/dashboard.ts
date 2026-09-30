import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/pool';

export async function dashboardRoutes(fastify: FastifyInstance) {

  // ─── All Facilities ──────────────────────────────────────
  fastify.get('/api/facilities', async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await query(
      `SELECT f.*,
        (SELECT json_build_object('total', b.total, 'occupied', b.occupied)
         FROM beds b WHERE b.facility_id = f.id) as bed_status
       FROM facilities f
       ORDER BY f.state, f.district, f.name`
    );
    return reply.send({ data: result.rows });
  });

  // ─── Single Facility Detail ──────────────────────────────
  fastify.get('/api/facilities/:id', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    const facility = await query('SELECT * FROM facilities WHERE id = $1', [id]);
    if (facility.rows.length === 0) {
      return reply.status(404).send({ error: 'Facility not found' });
    }

    const stocks = await query(
      'SELECT * FROM medicine_stock WHERE facility_id = $1 ORDER BY medicine_name',
      [id]
    );

    const beds = await query('SELECT * FROM beds WHERE facility_id = $1', [id]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const attendance = await query(
      `SELECT pa.*, p.staff_name
       FROM personnel_attendance pa
       JOIN personnel p ON p.id = pa.staff_id
       WHERE pa.facility_id = $1 AND pa.checked_in_at >= $2
       ORDER BY pa.checked_in_at DESC`,
      [id, today]
    );

    const totalStaff = await query(
      'SELECT COUNT(*) as count FROM personnel WHERE facility_id = $1',
      [id]
    );

    return reply.send({
      data: {
        facility: facility.rows[0],
        stocks: stocks.rows,
        beds: beds.rows[0] || { total: 0, occupied: 0 },
        attendance: attendance.rows,
        total_staff: parseInt(totalStaff.rows[0].count),
      },
    });
  });

  // ─── District-level Stock Summary ────────────────────────
  fastify.get('/api/dashboard/stock-summary', async (
    request: FastifyRequest<{ Querystring: { state?: string; district?: string } }>,
    reply: FastifyReply
  ) => {
    const { state, district } = request.query as any;
    let sql = `
      SELECT
        f.id as facility_id,
        f.name as facility_name,
        f.district,
        f.state,
        f.latitude,
        f.longitude,
        ms.medicine_name,
        ms.quantity,
        ms.unit,
        ms.reorder_level,
        ms.max_capacity,
        ms.last_updated,
        CASE
          WHEN ms.quantity <= 0 THEN 'stockout'
          WHEN ms.quantity <= ms.reorder_level THEN 'low'
          WHEN ms.quantity <= ms.reorder_level * 2 THEN 'medium'
          ELSE 'adequate'
        END as stock_status
      FROM facilities f
      JOIN medicine_stock ms ON ms.facility_id = f.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (state) {
      params.push(state);
      conditions.push(`f.state = $${params.length}`);
    }
    if (district) {
      params.push(district);
      conditions.push(`f.district = $${params.length}`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY f.state, f.district, f.name, ms.medicine_name';

    const result = await query(sql, params);
    return reply.send({ data: result.rows });
  });

  // ─── Bed Occupancy Summary ───────────────────────────────
  fastify.get('/api/dashboard/bed-summary', async (
    request: FastifyRequest<{ Querystring: { state?: string; district?: string } }>,
    reply: FastifyReply
  ) => {
    const { state, district } = request.query as any;
    let sql = `
      SELECT
        f.id as facility_id,
        f.name as facility_name,
        f.district,
        f.state,
        f.latitude,
        f.longitude,
        b.total,
        b.occupied,
        ROUND((b.occupied::numeric / NULLIF(b.total, 0)) * 100, 1) as occupancy_pct
      FROM facilities f
      JOIN beds b ON b.facility_id = f.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (state) {
      params.push(state);
      conditions.push(`f.state = $${params.length}`);
    }
    if (district) {
      params.push(district);
      conditions.push(`f.district = $${params.length}`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY occupancy_pct DESC';

    const result = await query(sql, params);
    return reply.send({ data: result.rows });
  });

  // ─── Attendance Summary ──────────────────────────────────
  fastify.get('/api/dashboard/attendance-summary', async (
    request: FastifyRequest<{ Querystring: { state?: string; district?: string } }>,
    reply: FastifyReply
  ) => {
    const { state, district } = request.query as any;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let sql = `
      SELECT
        f.id as facility_id,
        f.name as facility_name,
        f.district,
        f.state,
        (SELECT COUNT(*) FROM personnel p WHERE p.facility_id = f.id) as total_staff,
        (SELECT COUNT(*) FROM personnel_attendance pa
         WHERE pa.facility_id = f.id AND pa.checked_in_at >= $1 AND pa.status = 'present'
        ) as present_count
      FROM facilities f
    `;
    const params: any[] = [today];
    const conditions: string[] = [];

    if (state) {
      params.push(state);
      conditions.push(`f.state = $${params.length}`);
    }
    if (district) {
      params.push(district);
      conditions.push(`f.district = $${params.length}`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY f.state, f.district, f.name';

    const result = await query(sql, params);
    return reply.send({
      data: result.rows.map((row: any) => ({
        ...row,
        attendance_pct: row.total_staff > 0
          ? Math.round((row.present_count / row.total_staff) * 100)
          : 0,
      })),
    });
  });

  // ─── Alerts ──────────────────────────────────────────────
  fastify.get('/api/alerts', async (
    request: FastifyRequest<{ Querystring: { resolved?: string; limit?: string } }>,
    reply: FastifyReply
  ) => {
    const { resolved, limit } = request.query as any;
    const showResolved = resolved === 'true';
    const lim = parseInt(limit) || 50;

    const result = await query(
      `SELECT a.*, f.name as facility_name, f.district, f.state
       FROM alerts a
       JOIN facilities f ON f.id = a.facility_id
       WHERE a.is_resolved = $1
       ORDER BY
         CASE a.severity
           WHEN 'critical' THEN 0
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           ELSE 3
         END,
         a.created_at DESC
       LIMIT $2`,
      [showResolved, lim]
    );

    return reply.send({ data: result.rows });
  });

  // ─── Redistribution Recommendations ──────────────────────
  fastify.get('/api/redistributions', async (
    request: FastifyRequest<{ Querystring: { status?: string } }>,
    reply: FastifyReply
  ) => {
    const { status } = request.query as any;

    let sql = `
      SELECT r.*,
        sf.name as source_facility_name, sf.district as source_district,
        sf.latitude as source_lat, sf.longitude as source_lng,
        tf.name as target_facility_name, tf.district as target_district,
        tf.latitude as target_lat, tf.longitude as target_lng
      FROM redistribution_recommendations r
      JOIN facilities sf ON sf.id = r.source_facility_id
      JOIN facilities tf ON tf.id = r.target_facility_id
    `;

    const params: any[] = [];
    if (status) {
      params.push(status);
      sql += ` WHERE r.status = $1`;
    }

    sql += ' ORDER BY r.urgency_score DESC, r.created_at DESC LIMIT 50';

    const result = await query(sql, params);
    return reply.send({ data: result.rows });
  });

  // ─── District/State list for filters ─────────────────────
  fastify.get('/api/filters', async (_request: FastifyRequest, reply: FastifyReply) => {
    const states = await query('SELECT DISTINCT state FROM facilities ORDER BY state');
    const districts = await query('SELECT DISTINCT district, state FROM facilities ORDER BY state, district');
    return reply.send({
      states: states.rows.map((r: any) => r.state),
      districts: districts.rows,
    });
  });

  // ─── Update Redistribution Status ────────────────────────
  fastify.patch('/api/redistributions/:id', async (
    request: FastifyRequest<{ Params: { id: string }; Body: { status: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const { status } = request.body || {};
    if (!status) {
      return reply.status(400).send({ error: 'Status is required' });
    }
    await query('UPDATE redistribution_recommendations SET status = $1 WHERE id = $2', [status, id]);
    return reply.send({ success: true, id, status });
  });

  // ─── Resolve / Unresolve Alert ───────────────────────────
  fastify.patch('/api/alerts/:id', async (
    request: FastifyRequest<{ Params: { id: string }; Body: { is_resolved: boolean } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const { is_resolved } = request.body || {};
    await query('UPDATE alerts SET is_resolved = $1 WHERE id = $2', [is_resolved !== false, id]);
    return reply.send({ success: true, id, is_resolved: is_resolved !== false });
  });
}
