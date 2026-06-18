import type { FastifyInstance } from 'fastify';
import { getCachedMenu, syncMenu } from '../services/cache-service.js';
import { validateSession } from '../services/auth-service.js';

export async function menuRoutes(app: FastifyInstance): Promise<void> {
  // GET /menu — cached products + categories
  app.get('/menu', async (_request, reply) => {
    let menu = getCachedMenu();
    if (!menu) {
      // First request — try syncing
      await syncMenu();
      menu = getCachedMenu();
    }
    if (!menu) {
      return reply.code(503).send({
        error: 'Menu not available. Ensure Foodics token is set.',
      });
    }
    return reply.send({
      products: menu.products,
      categories: menu.categories,
    });
  });

  // GET /menu/products — just products
  app.get('/menu/products', async (_request, reply) => {
    let menu = getCachedMenu();
    if (!menu) {
      await syncMenu();
      menu = getCachedMenu();
    }
    if (!menu) return reply.code(503).send({ error: 'Menu not available' });
    return reply.send({ products: menu.products });
  });

  // GET /menu/categories — just categories
  app.get('/menu/categories', async (_request, reply) => {
    let menu = getCachedMenu();
    if (!menu) {
      await syncMenu();
      menu = getCachedMenu();
    }
    if (!menu) return reply.code(503).send({ error: 'Menu not available' });
    return reply.send({ categories: menu.categories });
  });

  // POST /menu/sync — force sync (waiter only)
  app.post('/menu/sync', async (request, reply) => {
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'Waiter auth required' });
    const session = validateSession(auth.slice(7));
    if (!session) return reply.code(401).send({ error: 'Invalid or expired session' });
    await syncMenu();
    return reply.send({ ok: true, message: 'Menu sync triggered' });
  });
}