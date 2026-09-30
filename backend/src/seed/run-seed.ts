/**
 * Standalone seed script.
 * Usage: npx tsx src/seed/run-seed.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { runMigrations, dropAllTables } from '../db/migrations';
import { runFullSeed } from './generator';
import { pool } from '../db/pool';

async function main() {
  const args = process.argv.slice(2);
  const shouldReset = args.includes('--reset');
  const facilityCount = parseInt(process.env.SEED_FACILITY_COUNT || '25');

  try {
    if (shouldReset) {
      await dropAllTables();
    }

    await runMigrations();
    await runFullSeed(facilityCount);

    console.log('\n🎉 Database seeded successfully!');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
