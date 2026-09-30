import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

let redisAvailable = true;

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) {
      redisAvailable = false;
      console.warn('⚠️  Redis unavailable — running without real-time features');
      return null; // Stop retrying
    }
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true,
});

// Separate client for subscriptions (Redis requires dedicated connections for pub/sub)
export const redisSub = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) return null;
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true,
});

redis.on('error', (err) => {
  if (redisAvailable) {
    console.error('Redis connection error:', err.message);
  }
});

redisSub.on('error', (err) => {
  // Silently ignore if Redis is known to be unavailable
});

// Stream names
export const STREAMS = {
  STOCK_UPDATES: 'pulsecare:stock_updates',
  BED_UPDATES: 'pulsecare:bed_updates',
  ATTENDANCE_UPDATES: 'pulsecare:attendance_updates',
  ALERTS: 'pulsecare:alerts',
} as const;

export function isRedisAvailable(): boolean {
  return redisAvailable;
}

/**
 * Publish an event to a Redis stream.
 * Silently no-ops if Redis is unavailable.
 */
export async function publishToStream(
  stream: string,
  data: Record<string, string>
): Promise<string> {
  if (!redisAvailable) return '0-0';

  try {
    const fields: string[] = [];
    for (const [key, value] of Object.entries(data)) {
      fields.push(key, value);
    }
    const result = await redis.xadd(stream, '*', ...fields);
    return result!;
  } catch {
    return '0-0';
  }
}
