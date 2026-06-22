import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { logWebhookEvent } from '../db/index.js';
import { sendToWaiters, sendToTable } from '../services/websocket-service.js';
import { config } from '../config.js';
import { validateSession } from '../services/auth-service.js';

/**
 * Webhook receiver: Foodics sends event notifications here.
 * Configure the webhook URL in your Foodics app settings to point to:
 *   https://your-backend.com/webhooks/foodics
 *
 * Foodics sends events like:
 *   - order.created
 *   - order.updated
 *   - order.closed
 *   - table.updated
 *   - product.updated
 */
export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/webhooks/foodics', async (request, reply) => {
    // Foodics webhook signature verification.
    // Foodics sends a signature in the X-Foodics-Signature header (HMAC-SHA256 of the raw body).
    // If FOODICS_WEBHOOK_SECRET is set, verify it. In production without a secret, reject.
    const foodicsSecret = process.env.FOODICS_WEBHOOK_SECRET;
    const signature = request.headers['x-foodics-signature'] as string | undefined;

    if (config.backend.isProd && !foodicsSecret) {
      console.error('[Webhook] FOODICS_WEBHOOK_SECRET not set in production — rejecting Foodics webhook');
      return reply.code(500).send({ error: 'Webhook secret not configured' });
    }
    if (foodicsSecret) {
      if (!signature) {
        console.warn('[Webhook] Missing X-Foodics-Signature header');
        return reply.code(401).send({ error: 'Missing signature' });
      }
      // Verify HMAC-SHA256
      const rawBody = JSON.stringify(request.body ?? {});
      const computed = crypto
        .createHmac('sha256', foodicsSecret)
        .update(rawBody)
        .digest('hex');
      try {
        if (computed !== signature) {
          console.warn('[Webhook] Foodics signature mismatch');
          return reply.code(401).send({ error: 'Invalid signature' });
        }
      } catch {
        return reply.code(401).send({ error: 'Signature verification failed' });
      }
    }

    const body = (request.body ?? {}) as {
      event?: string;
      resource_type?: string;
      resource_id?: string;
      data?: Record<string, unknown>;
    };

    const eventType = body.event || 'unknown';
    const resourceType = body.resource_type || 'unknown';
    const resourceId = body.resource_id || '';

    // Log the webhook event
    logWebhookEvent({
      event_type: eventType,
      resource_type: resourceType,
      resource_id: resourceId,
      payload: JSON.stringify(body),
    });

    console.log(`[Webhook] ${eventType} for ${resourceType}/${resourceId}`);

    // Extract table_id once at the top — used by multiple cases
    const tableId: string | undefined = (
      (body.data as Record<string, unknown> | undefined)?.table_id
      ?? (body.data as { table?: { id?: string } } | undefined)?.table?.id
    ) as string | undefined;

    // Handle different event types
    switch (eventType) {
      case 'order.created':
      case 'order.updated':
        sendToWaiters('order:updated', { order_id: resourceId, data: body.data });
        if (tableId) {
          sendToTable(tableId, 'order:status', { order_id: resourceId, data: body.data });
        }
        break;

      case 'order.closed':
        sendToWaiters('order:closed', { order_id: resourceId });
        if (tableId) {
          sendToTable(tableId, 'order:closed', { order_id: resourceId });
        }
        break;

      case 'table.updated':
        sendToWaiters('table:updated', { table_id: resourceId, data: body.data });
        break;

      case 'product.updated':
      case 'product.created':
        // Menu changed — trigger cache sync (dynamic import avoids circular dep)
        import('../services/cache-service.js').then(({ syncMenu }) => syncMenu().catch(() => {}));
        break;

      default:
        console.log(`[Webhook] Unhandled event: ${eventType}`);
    }

    // Always return 200 quickly to Foodics
    return reply.code(200).send({ received: true });
  });

  // GET /webhooks/events — recent webhook events (waiter only, for debugging)
  app.get('/webhooks/events', async (request, reply) => {
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'Waiter auth required' });
    const session = validateSession(auth.slice(7));
    if (!session) return reply.code(401).send({ error: 'Invalid or expired session' });
    const db = (await import('../db/index.js')).getDB();
    const events = db.prepare(`
      SELECT * FROM webhook_events ORDER BY received_at DESC LIMIT 50
    `).all();
    return reply.send({ events });
  });
}