import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { config } from './config.js';
import { initDB } from './db/index.js';
import { startSyncLoops } from './services/cache-service.js';
import { getFoodicsClient } from './services/foodics-client.js';
import { addClient, removeClient, getConnectedCount, sendToWaiters } from './services/websocket-service.js';
import { v4 as uuidv4 } from 'uuid';

// Routes
import { authRoutes } from './routes/auth.js';
import { menuRoutes } from './routes/menu.js';
import { tableRoutes } from './routes/tables.js';
import { orderRoutes } from './routes/orders.js';
import { qrcodeRoutes } from './routes/qrcode.js';
import { webhookRoutes } from './routes/webhooks.js';

async function main(): Promise<void> {
  // Initialize SQLite
  initDB();

  // Create Fastify server
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // Register plugins
  await app.register(cors, {
    origin: true, // Allow all origins in dev (restrict in prod)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.register(websocket, {
    options: {
      maxPayload: 1024 * 1024, // 1MB
    },
  });

  // Register REST routes
  await app.register(authRoutes, { prefix: '/api' });
  await app.register(menuRoutes, { prefix: '/api' });
  await app.register(tableRoutes, { prefix: '/api' });
  await app.register(orderRoutes, { prefix: '/api' });
  await app.register(qrcodeRoutes, { prefix: '/api' });
  await app.register(webhookRoutes, { prefix: '/api' });

  // WebSocket endpoint at /ws
  app.get('/ws', { websocket: true }, (socket, request) => {
    const clientId = uuidv4();
    const role = (request.query as any).role as 'waiter' | 'client' | 'unknown' || 'unknown';
    const tableId = (request.query as any).table_id as string | undefined;
    const waiterId = (request.query as any).waiter_id as string | undefined;

    addClient({ ws: socket, id: clientId, role, tableId, waiterId });

    // Send welcome
    socket.send(JSON.stringify({
      event: 'connected',
      data: { client_id: clientId, role },
      timestamp: Date.now(),
    }));

    socket.on('message', (msg: Buffer) => {
      try {
        const parsed = JSON.parse(msg.toString());
        console.log(`[WS] Message from ${clientId}:`, parsed);
        // Handle incoming messages (e.g., "call_waiter", "request_check")
        switch (parsed.event) {
          case 'call_waiter':
            sendToWaiters('waiter:called', { table_id: parsed.table_id, message: 'Customer is calling the waiter' });
            break;
          case 'request_check':
            sendToWaiters('check:requested', { table_id: parsed.table_id, order_id: parsed.order_id });
            break;
        }
      } catch {
        // Ignore non-JSON messages
      }
    });

    socket.on('close', () => {
      removeClient(clientId);
    });

    socket.on('error', (err) => {
      console.error(`[WS] Socket error for ${clientId}:`, err);
      removeClient(clientId);
    });
  });

  // Health check
  app.get('/health', async () => {
    const client = getFoodicsClient();
    return {
      status: 'ok',
      foodics_connected: client.hasToken(),
      ws_clients: getConnectedCount(),
      timestamp: new Date().toISOString(),
    };
  });

  // Start server
  try {
    await app.listen({ port: config.backend.port, host: '0.0.0.0' });
    console.log(`
╔══════════════════════════════════════════════════╗
║  Foodics Ordering Backend                        ║
║  Port: ${String(config.backend.port).padEnd(38)}║
║  Foodics: ${config.foodics.baseUrl.padEnd(38)}║
║  Connected: ${String(getFoodicsClient().hasToken()).padEnd(36)}║
╚══════════════════════════════════════════════════╝
    `);
    console.log(`[Server] REST API: http://localhost:${config.backend.port}/api`);
    console.log(`[Server] WebSocket: ws://localhost:${config.backend.port}/ws`);
    console.log(`[Server] Health: http://localhost:${config.backend.port}/health`);

    // Start cache sync loops (menu, tables)
    startSyncLoops();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});