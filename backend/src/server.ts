import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import dotenv from 'dotenv';

import { pool } from './db/pool';
import { runMigrations, dropAllTables } from './db/migrations';
import { redis, isRedisAvailable } from './redis/client';
import { ingestionRoutes } from './routes/ingestion';
import { dashboardRoutes } from './routes/dashboard';
import { aiRoutes } from './routes/ai';
import { setupWebSocket, startStreamConsumer } from './realtime/websocket';
import { runFullSeed } from './seed/generator';
import { startSimulation } from './seed/simulator';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3001');

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'development' ? 'info' : 'warn',
    },
  });

  // ─── Plugins ───────────────────────────────────────────
  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  await fastify.register(websocket);

  // ─── Routes ────────────────────────────────────────────
  await fastify.register(ingestionRoutes);
  await fastify.register(dashboardRoutes);
  await fastify.register(aiRoutes);

  // ─── WebSocket ─────────────────────────────────────────
  setupWebSocket(fastify);

  // ─── Health Check ──────────────────────────────────────
  fastify.get('/api/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      redis: isRedisAvailable() ? 'connected' : 'unavailable',
    };
  });

  return fastify;
}

async function main() {
  try {
    console.log('╔═══════════════════════════════════════════╗');
    console.log('║        PulseCare Backend Server           ║');
    console.log('╚═══════════════════════════════════════════╝\n');

    // ─── Connect to Redis (optional) ─────────────────────
    if (isRedisAvailable()) {
      console.log('Connecting to Redis...');
      try {
        await redis.connect();
        console.log('✅ Redis connected\n');
      } catch (err: any) {
        console.warn(`⚠️  Redis unavailable (${err.message}) — running with direct WebSocket telemetry\n`);
      }
    } else {
      console.log('ℹ  No REDIS_URL configured — running with direct in-memory WebSocket telemetry\n');
    }

    // ─── Database Setup ──────────────────────────────────
    const args = process.argv.slice(2);
    const shouldReset = args.includes('--reset');
    const shouldSeed = args.includes('--seed');
    const shouldSimulate = args.includes('--simulate');

    if (shouldReset) {
      await dropAllTables();
    }

    await runMigrations();

    if (shouldSeed) {
      const facilityCount = parseInt(process.env.SEED_FACILITY_COUNT || '25');
      await runFullSeed(facilityCount);
    }

    // ─── Start Server ────────────────────────────────────
    const fastify = await buildServer();
    await fastify.listen({ port: PORT, host: '0.0.0.0' });

    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`   WebSocket: ws://localhost:${PORT}/ws`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    console.log(`   Redis: ${isRedisAvailable() ? '✅ connected' : 'ℹ  direct WebSockets (no Redis required)'}\n`);

    // ─── Start Stream Consumer (if Redis available) ──────
    if (isRedisAvailable()) {
      await startStreamConsumer();
    }

    // ─── Start Simulation (if requested) ─────────────────
    if (shouldSimulate) {
      const interval = parseInt(process.env.SIMULATION_INTERVAL_MS || '5000');
      await startSimulation(interval);
    }

    // ─── Graceful Shutdown ───────────────────────────────
    const shutdown = async () => {
      console.log('\nShutting down...');
      await fastify.close();
      try { await redis.quit(); } catch {}
      await pool.end();
      console.log('Goodbye!');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();
