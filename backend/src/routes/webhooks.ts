import type { FastifyInstance } from 'fastify';
import { logWebhookEvent } from '../db/index.js';
import { sendToWaiters, sendToTable } from '../services/websocket-service.js';

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

  // GET /webhooks/events — recent webhook events (for debugging)
  app.get('/webhooks/events', async (request, reply) => {
    const db = (await import('../db/index.js')).getDB();
    const events = db.prepare(`
      SELECT * FROM webhook_events ORDER BY received_at DESC LIMIT 50
    `).all();
    return reply.send({ events });
  });
}