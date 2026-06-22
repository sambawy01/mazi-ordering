import type { FastifyInstance } from 'fastify';
import { getFoodicsClient } from '../services/foodics-client.js';
import { setOrderCache, getCachedOrder } from '../db/index.js';
import { sendToWaiters, sendToTable } from '../services/websocket-service.js';
import { config } from '../config.js';
import { OrderType } from '../types/index.js';
import type { CreateOrderRequest, CreateOrderProduct } from '../types/index.js';
import { isPhoneVerified } from './phone.js';
import { validateSession } from '../services/auth-service.js';

export async function orderRoutes(app: FastifyInstance): Promise<void> {
  // POST /orders — create order (waiter or client via QR)
  app.post('/orders', async (request, reply) => {
    const body = (request.body ?? {}) as CreateOrderRequest & {
      source?: 'waiter' | 'client_qr';
      reservation_name?: string;
      creator_user_id?: string;  // waiter's Foodics user ID
      phone?: string;            // for client_qr source, phone must be verified
    };

    // Auth: waiters need a valid JWT; clients need a verified phone.
    if (body.source === 'waiter') {
      const auth = request.headers.authorization;
      if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'Waiter auth required' });
      const session = validateSession(auth.slice(7));
      if (!session) return reply.code(401).send({ error: 'Invalid or expired session' });
    } else {
      // Client QR flow — must have verified phone.
      if (!body.phone || !isPhoneVerified(body.phone)) {
        return reply.code(403).send({ error: 'Phone verification required to place order' });
      }
    }

    // Build the order payload for Foodics
    const orderPayload: CreateOrderRequest = {
      type: body.type || OrderType.DineIn,
      branch_id: body.branch_id || config.foodics.branchId,
      table_id: body.table_id,
      guests: body.guests || 1,
      customer_notes: body.customer_notes,
      kitchen_notes: body.kitchen_notes,
      products: body.products,
      combos: body.combos,
      meta: {
        ...body.meta,
        source: body.source || 'waiter',
        ...(body.reservation_name ? { reservation_name: body.reservation_name } : {}),
      },
    };

    try {
      const client = getFoodicsClient();
      if (!client.hasToken()) {
        return reply.code(503).send({ error: 'Foodics not connected. Set access token first.' });
      }
      const order = await client.createOrder(orderPayload);

      // Cache the order
      const orderId = (order as any).id || 'unknown';
      setOrderCache({
        order_id: orderId,
        table_id: body.table_id,
        branch_id: orderPayload.branch_id,
        source: body.source || 'waiter',
        reservation_name: body.reservation_name,
        data: order,
      });

      // Notify waiters in real-time
      sendToWaiters('order:new', {
        order_id: orderId,
        table_id: body.table_id,
        source: body.source || 'waiter',
        reservation_name: body.reservation_name,
      });

      // If client initiated, notify the table
      if (body.table_id) {
        sendToTable(body.table_id, 'order:created', { order_id: orderId, order });
      }

      return reply.code(201).send({ order });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Order creation failed';
      console.error('[Orders] Create error:', msg);
      return reply.code(400).send({ error: msg });
    }
  });

  // PUT /orders/:id — update order (add products, change status) — waiter only
  app.put('/orders/:id', async (request, reply) => {
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'Waiter auth required' });
    const session = validateSession(auth.slice(7));
    if (!session) return reply.code(401).send({ error: 'Invalid or expired session' });

    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;

    try {
      const client = getFoodicsClient();
      if (!client.hasToken()) {
        return reply.code(503).send({ error: 'Foodics not connected' });
      }
      const order = await client.updateOrder(id, body);

      // Update cache
      setOrderCache({
        order_id: id,
        data: order,
      });

      // Broadcast update
      sendToWaiters('order:updated', { order_id: id, update: body });

      return reply.send({ order });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Order update failed';
      return reply.code(400).send({ error: msg });
    }
  });

  // GET /orders/:id — get order details
  app.get('/orders/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const client = getFoodicsClient();
      if (!client.hasToken()) {
        return reply.code(503).send({ error: 'Foodics not connected' });
      }
      const order = await client.getOrder(id);
      setOrderCache({ order_id: id, data: order });
      return reply.send({ order });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to get order';
      return reply.code(400).send({ error: msg });
    }
  });

  // GET /orders — list orders (optionally filtered by branch)
  app.get('/orders', async (request, reply) => {
    const query = request.query as { branch_id?: string };
    try {
      const client = getFoodicsClient();
      if (!client.hasToken()) {
        return reply.code(503).send({ error: 'Foodics not connected' });
      }
      const orders = await client.listOrders({
        branch_id: query.branch_id || config.foodics.branchId,
      });
      return reply.send({ orders });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to list orders';
      return reply.code(400).send({ error: msg });
    }
  });

  // POST /orders/:id/products — add products to an existing order — waiter only
  app.post('/orders/:id/products', async (request, reply) => {
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return reply.code(401).send({ error: 'Waiter auth required' });
    const session = validateSession(auth.slice(7));
    if (!session) return reply.code(401).send({ error: 'Invalid or expired session' });

    const { id } = request.params as { id: string };
    const { products } = (request.body ?? {}) as { products?: CreateOrderProduct[] };

    if (!products || !Array.isArray(products) || products.length === 0) {
      return reply.code(400).send({ error: 'products array is required' });
    }

    try {
      const client = getFoodicsClient();
      if (!client.hasToken()) {
        return reply.code(503).send({ error: 'Foodics not connected' });
      }
      // Update the order by adding products
      const order = await client.updateOrder(id, { products });

      // Broadcast
      sendToWaiters('order:products_added', { order_id: id, products });
      const cached = getCachedOrder(id);
      if (cached?.table_id) {
        sendToTable(cached.table_id, 'order:updated', { order_id: id, products });
      }

      return reply.send({ order });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add products';
      return reply.code(400).send({ error: msg });
    }
  });
}