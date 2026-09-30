import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL;

let redisAvailable = false;

// Dummy client for when Redis is disabled
const noopRedis = {
  connect: async () => {},
  quit: async () => {},
  on: () => noopRedis,
  xadd: async () => '0-0',
} as unknown as Redis;

export let redis: Redis = noopRedis;
export let redisSub: Redis = noopRedis;

if (redisUrl && redisUrl.trim()) {
  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          redisAvailable = false;
          return null; // Stop retrying
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redisSub = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redis.on('error', () => {
      redisAvailable = false;
    });

    redisSub.on('error', () => {
      redisAvailable = false;
    });

    redisAvailable = true;
  } catch {
    redisAvailable = false;
    redis = noopRedis;
    redisSub = noopRedis;
  }
}

// Stream names
export const STREAMS = {
  STOCK_UPDATES: 'pulsecare:stock_updates',
  BED_UPDATES: 'pulsecare:bed_updates',
  ATTENDANCE_UPDATES: 'pulsecare:attendance_updates',
  ALERTS: 'pulsecare:alerts',
} as const;

export function isRedisAvailable(): boolean {
  return redisAvailable && Boolean(redisUrl && redisUrl.trim());
}

// Callback hook for direct WebSocket broadcast fallback when running without Redis
type BroadcastListener = (stream: string, data: Record<string, string>) => void;
let directBroadcastListener: BroadcastListener | null = null;

export function registerDirectBroadcastListener(listener: BroadcastListener): void {
  directBroadcastListener = listener;
}

/**
 * Publish an event to a Redis stream, or falls back to direct WebSocket broadcast
 * when running without Redis.
 */
export async function publishToStream(
  stream: string,
  data: Record<string, string>
): Promise<string> {
  // Always trigger direct broadcast if registered
  if (directBroadcastListener) {
    try {
      directBroadcastListener(stream, data);
    } catch {}
  }

  if (!isRedisAvailable() || !redis) return '0-0';

  try {
    const fields: string[] = [];
    for (const [key, value] of Object.entries(data)) {
      fields.push(key, value);
    }
    const result = await redis.xadd(stream, '*', ...fields);
    return result || '0-0';
  } catch {
    return '0-0';
  }
}
