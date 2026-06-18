import type { FastifyInstance } from 'fastify';
import { loginWaiter, validateSession, logoutWaiter } from '../services/auth-service.js';
import { getFoodicsClient } from '../services/foodics-client.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /auth/waiter — waiter login by app_id + pin
  app.post('/auth/waiter', async (request, reply) => {
    const { app_id, pin } = (request.body ?? {}) as { app_id?: string; pin?: string };
    if (!app_id || !pin) {
      return reply.code(400).send({ error: 'app_id and pin are required' });
    }
    try {
      const session = await loginWaiter(app_id, pin);
      return reply.send({
        token: session.token,
        user: session.user,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      return reply.code(401).send({ error: msg });
    }
  });

  // POST /auth/logout — invalidate session
  app.post('/auth/logout', async (request, reply) => {
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'No token' });
    const token = auth.slice(7);
    logoutWaiter(token);
    return reply.send({ ok: true });
  });

  // GET /auth/me — validate current session
  app.get('/auth/me', async (request, reply) => {
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'No token' });
    const token = auth.slice(7);
    const session = validateSession(token);
    if (!session) return reply.code(401).send({ error: 'Invalid or expired session' });
    return reply.send({ user: session });
  });

  // POST /auth/oauth/callback — exchange authorization code for access token
  app.post('/auth/oauth/callback', async (request, reply) => {
    const { code } = (request.body ?? {}) as { code?: string };
    if (!code) return reply.code(400).send({ error: 'code is required' });
    try {
      const client = getFoodicsClient();
      const token = await client.exchangeAuthCode(code);
      // Store token server-side only — do NOT return it to the client
      // The token is now in the FoodicsClient singleton and will be used for all API calls
      return reply.send({ ok: true, connected: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OAuth exchange failed';
      return reply.code(400).send({ error: msg });
    }
  });

  // GET /auth/status — check if Foodics token is configured
  app.get('/auth/status', async (_request, reply) => {
    const client = getFoodicsClient();
    return reply.send({
      foodics_connected: client.hasToken(),
    });
  });
}