import { query } from './pool';

/**
 * Full schema migration for PulseCare.
 * Designed with federation in mind — each state instance runs this schema,
 * and the `state` column on facilities acts as the partition key.
 */
export async function runMigrations(): Promise<void> {
  console.log('Running database migrations...');

  await query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
  `);

  // -- Facilities (PHCs) --
  await query(`
    CREATE TABLE IF NOT EXISTS facilities (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name            VARCHAR(255) NOT NULL,
      facility_type   VARCHAR(50) NOT NULL DEFAULT 'PHC',
      district        VARCHAR(255) NOT NULL,
      state           VARCHAR(255) NOT NULL,
      latitude        DOUBLE PRECISION NOT NULL,
      longitude       DOUBLE PRECISION NOT NULL,
      total_beds      INTEGER NOT NULL DEFAULT 10,
      contact_phone   VARCHAR(20),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_facilities_district ON facilities(district);
    CREATE INDEX IF NOT EXISTS idx_facilities_state ON facilities(state);
  `);

  // -- Medicine Stock --
  await query(`
    CREATE TABLE IF NOT EXISTS medicine_stock (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      facility_id     UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      medicine_name   VARCHAR(255) NOT NULL,
      quantity         DOUBLE PRECISION NOT NULL DEFAULT 0,
      unit            VARCHAR(50) NOT NULL DEFAULT 'tablets',
      reorder_level   DOUBLE PRECISION NOT NULL DEFAULT 100,
      max_capacity    DOUBLE PRECISION NOT NULL DEFAULT 1000,
      last_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      UNIQUE(facility_id, medicine_name)
    );

    CREATE INDEX IF NOT EXISTS idx_medicine_stock_facility ON medicine_stock(facility_id);
    CREATE INDEX IF NOT EXISTS idx_medicine_stock_medicine ON medicine_stock(medicine_name);
  `);

  // -- Stock History (for burn-rate calculation) --
  await query(`
    CREATE TABLE IF NOT EXISTS stock_history (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      facility_id     UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      medicine_name   VARCHAR(255) NOT NULL,
      quantity         DOUBLE PRECISION NOT NULL,
      recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_stock_history_facility_medicine
      ON stock_history(facility_id, medicine_name, recorded_at DESC);
  `);

  // -- Bed Occupancy --
  await query(`
    CREATE TABLE IF NOT EXISTS beds (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      facility_id     UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      total           INTEGER NOT NULL DEFAULT 10,
      occupied        INTEGER NOT NULL DEFAULT 0,
      last_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      UNIQUE(facility_id)
    );

    CREATE INDEX IF NOT EXISTS idx_beds_facility ON beds(facility_id);
  `);

  // -- Personnel Attendance --
  await query(`
    CREATE TABLE IF NOT EXISTS personnel (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      facility_id     UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      staff_name      VARCHAR(255) NOT NULL,
      role            VARCHAR(100) NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_personnel_facility ON personnel(facility_id);
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS personnel_attendance (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      facility_id     UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      staff_id        UUID NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
      role            VARCHAR(100) NOT NULL,
      checked_in_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      checked_out_at  TIMESTAMPTZ,
      status          VARCHAR(20) NOT NULL DEFAULT 'present',

      UNIQUE(staff_id, checked_in_at)
    );

    CREATE INDEX IF NOT EXISTS idx_attendance_facility ON personnel_attendance(facility_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON personnel_attendance(checked_in_at);
  `);

  // -- Alerts --
  await query(`
    CREATE TABLE IF NOT EXISTS alerts (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      facility_id     UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      alert_type      VARCHAR(50) NOT NULL,
      severity        VARCHAR(20) NOT NULL DEFAULT 'medium',
      title           VARCHAR(500) NOT NULL,
      description     TEXT,
      medicine_name   VARCHAR(255),
      metadata        JSONB DEFAULT '{}',
      is_resolved     BOOLEAN NOT NULL DEFAULT false,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at     TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_alerts_facility ON alerts(facility_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(alert_type);
    CREATE INDEX IF NOT EXISTS idx_alerts_unresolved ON alerts(is_resolved) WHERE is_resolved = false;
  `);

  // -- Redistribution Recommendations --
  await query(`
    CREATE TABLE IF NOT EXISTS redistribution_recommendations (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      source_facility_id    UUID NOT NULL REFERENCES facilities(id),
      target_facility_id    UUID NOT NULL REFERENCES facilities(id),
      medicine_name         VARCHAR(255) NOT NULL,
      recommended_quantity  DOUBLE PRECISION NOT NULL,
      urgency_score         DOUBLE PRECISION NOT NULL DEFAULT 0,
      distance_km           DOUBLE PRECISION,
      reasoning             TEXT,
      status                VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actioned_at           TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_redistribution_status
      ON redistribution_recommendations(status);
  `);

  console.log('Migrations completed successfully.');
}

export async function dropAllTables(): Promise<void> {
  console.log('Dropping all tables...');
  await query(`
    DROP TABLE IF EXISTS redistribution_recommendations CASCADE;
    DROP TABLE IF EXISTS alerts CASCADE;
    DROP TABLE IF EXISTS personnel_attendance CASCADE;
    DROP TABLE IF EXISTS personnel CASCADE;
    DROP TABLE IF EXISTS stock_history CASCADE;
    DROP TABLE IF EXISTS medicine_stock CASCADE;
    DROP TABLE IF EXISTS beds CASCADE;
    DROP TABLE IF EXISTS facilities CASCADE;
  `);
  console.log('All tables dropped.');
}
