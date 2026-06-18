import type { FastifyInstance } from 'fastify';
import { getCachedTablesList, getSingleCachedTable, getOrdersForTable, syncTables } from '../services/cache-service.js';
import { validateSession } from '../services/auth-service.js';

export async function tableRoutes(app: FastifyInstance): Promise<void> {
  // GET /tables — all cached tables with status
  app.get('/tables', async (_request, reply) => {
    let tables = getCachedTablesList();
    if (tables.length === 0) {
      await syncTables();
      tables = getCachedTablesList();
    }
    return reply.send({ tables });
  });

  // GET /tables/:id — single table with details
  app.get('/tables/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const table = getSingleCachedTable(id);
    if (!table) return reply.code(404).send({ error: 'Table not found' });
    return reply.send({ table });
  });

  // GET /tables/:id/orders — orders for a table
  app.get('/tables/:id/orders', async (request, reply) => {
    const { id } = request.params as { id: string };
    const orders = getOrdersForTable(id);
    return reply.send({ orders });
  });

  // POST /tables/sync — force table sync (waiter only)
  app.post('/tables/sync', async (request, reply) => {
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'Waiter auth required' });
    const session = validateSession(auth.slice(7));
    if (!session) return reply.code(401).send({ error: 'Invalid or expired session' });
    await syncTables();
    return reply.send({ ok: true, message: 'Table sync triggered' });
  });
}