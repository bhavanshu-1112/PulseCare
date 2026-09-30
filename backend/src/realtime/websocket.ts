/**
 * Redis Stream → WebSocket bridge.
 * Consumes updates from Redis streams and pushes them to connected dashboard clients.
 */

import { FastifyInstance } from 'fastify';
import { redis, STREAMS, isRedisAvailable, registerDirectBroadcastListener } from '../redis/client';
import Redis from 'ioredis';

interface ConnectedClient {
  id: string;
  socket: any; // WebSocket
  filters?: {
    state?: string;
    district?: string;
  };
}

const clients: Map<string, ConnectedClient> = new Map();

/**
 * Broadcast a message to all connected WebSocket clients.
 */
export function broadcast(message: Record<string, any>): void {
  const payload = JSON.stringify(message);
  for (const [, client] of clients) {
    try {
      if (client.socket.readyState === 1) { // OPEN
        client.socket.send(payload);
      }
    } catch (err) {
      console.error(`Error sending to client ${client.id}:`, err);
    }
  }
}

// Register direct in-memory broadcast for when Redis streams are not used
registerDirectBroadcastListener((stream, data) => {
  let updateType = 'unknown';
  if (stream.includes('stock')) updateType = 'stock';
  else if (stream.includes('bed')) updateType = 'bed';
  else if (stream.includes('attendance')) updateType = 'attendance';
  else if (stream.includes('alert')) updateType = 'alert';

  broadcast({
    type: 'update',
    updateType,
    stream,
    data,
    timestamp: new Date().toISOString(),
  });
});

export function setupWebSocket(fastify: FastifyInstance): void {
  fastify.get('/ws', { websocket: true }, (socket, req) => {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    console.log(`WebSocket client connected: ${clientId}`);

    clients.set(clientId, { id: clientId, socket });

    // Handle messages from client (e.g., filter updates)
    socket.on('message', (rawMsg: Buffer) => {
      try {
        const msg = JSON.parse(rawMsg.toString());
        if (msg.type === 'set_filters') {
          const client = clients.get(clientId);
          if (client) {
            client.filters = msg.filters;
            console.log(`Client ${clientId} set filters:`, msg.filters);
          }
        }
      } catch {
        // Ignore malformed messages
      }
    });

    socket.on('close', () => {
      console.log(`WebSocket client disconnected: ${clientId}`);
      clients.delete(clientId);
    });

    // Send initial connection confirmation
    socket.send(JSON.stringify({
      type: 'connected',
      clientId,
      timestamp: new Date().toISOString(),
    }));
  });
}

/**
 * Start consuming Redis streams and forwarding to WebSocket clients.
 */
export async function startStreamConsumer(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!isRedisAvailable() || !redisUrl || !redisUrl.trim()) {
    console.log('ℹ  Stream consumer: Redis not configured, running with direct WebSocket telemetry');
    return;
  }

  let streamReader: Redis;
  try {
    streamReader = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) return null;
        return 2000;
      },
    });

    streamReader.on('error', () => {
      // Prevent unhandled error event
    });

    await streamReader.connect();
  } catch (err: any) {
    console.warn(`⚠️  Could not connect stream reader (${err.message}) — running with direct WebSocket telemetry`);
    return;
  }

  const streamNames = Object.values(STREAMS);
  const lastIds: Record<string, string> = {};

  // Start from latest
  for (const stream of streamNames) {
    lastIds[stream] = '$';
  }

  console.log('Stream consumer started, listening on:', streamNames.join(', '));

  const consume = async () => {
    while (true) {
      try {
        const xreadArgs = streamNames.map(stream => ({
          key: stream,
          id: lastIds[stream],
        }));

        const results = await streamReader.xread(
          'COUNT', 10, 'BLOCK', 2000,
          'STREAMS', ...streamNames, ...streamNames.map(s => lastIds[s])
        ) as any;

        if (!results) continue;

        for (const [stream, messages] of results) {
          for (const [id, fields] of messages) {
            lastIds[stream] = id;

            // Convert flat field array to object
            const data: Record<string, string> = {};
            for (let i = 0; i < fields.length; i += 2) {
              data[fields[i]] = fields[i + 1];
            }

            // Determine update type from stream name
            let updateType = 'unknown';
            if (stream.includes('stock')) updateType = 'stock';
            else if (stream.includes('bed')) updateType = 'bed';
            else if (stream.includes('attendance')) updateType = 'attendance';
            else if (stream.includes('alert')) updateType = 'alert';

            broadcast({
              type: 'update',
              updateType,
              stream,
              data,
              timestamp: new Date().toISOString(),
            });
          }
        }
      } catch (err: any) {
        if (err.message?.includes('Connection is closed')) {
          console.log('Stream consumer: Redis connection closed, exiting');
          break;
        }
        console.error('Stream consumer error:', err);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  };

  // Run in background
  consume().catch(err => {
    console.error('Stream consumer fatal error:', err);
  });
}
