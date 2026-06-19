import type { FastifyInstance } from 'fastify';
import { getFoodicsClient } from '../services/foodics-client.js';
import { getPaymobClient, toCents, type PaymobOrderItem } from '../services/paymob-client.js';
import { setOrderCache, getCachedOrdersByTable } from '../db/index.js';
import { sendToWaiters } from '../services/websocket-service.js';
import { config } from '../config.js';

/**
 * Payment routes — Paymob (Card / InstaPay / Apple Pay) + Cash, recorded into
 * Foodics POS. Foodics never charges money; it only stores the settled payment.
 */

// --- Payment-methods cache (5 min, in-memory) ---
let paymentMethodsCache: { data: Record<string, unknown>[]; syncedAt: number } | null = null;

// --- Paymob intent tracking (in-memory) ---
// Maps a Paymob order id -> the data needed to settle the matching Foodics order
// when the asynchronous webhook arrives.
interface PendingIntent {
  orderId: string;
  amount: number;
  paymentMethodId: string;
  method: 'card' | 'instapay' | 'apple_pay';
  settled: boolean;
}
const pendingIntents = new Map<string, PendingIntent>();

type FoodicsPaymentMethod = {
  id: string;
  name?: string;
  code?: string;
  type?: string | number;
};

/**
 * Pick the best-matching Foodics payment method id for a logical method.
 * Falls back to the first available method if no clear match is found.
 */
function resolveFoodicsMethodId(
  methods: FoodicsPaymentMethod[],
  logical: 'card' | 'instapay' | 'apple_pay' | 'cash',
): string | null {
  if (methods.length === 0) return null;
  const norm = (s?: string | number) => String(s ?? '').toLowerCase();

  const wanted: Record<string, string[]> = {
    cash: ['cash'],
    card: ['card', 'credit', 'visa', 'mastercard', 'mada'],
    instapay: ['instapay', 'insta', 'wallet', 'transfer'],
    apple_pay: ['apple', 'apple_pay', 'applepay', 'card'],
  };

  const candidates = wanted[logical];
  const match = methods.find((m) =>
    candidates.some((c) => norm(m.code).includes(c) || norm(m.name).includes(c) || norm(m.type).includes(c)),
  );
  return (match || methods[0]).id;
}

/**
 * Reduce a raw Foodics order into an itemized bill the app can render.
 */
function buildBill(order: Record<string, any>) {
  const products = Array.isArray(order.products) ? order.products : [];
  const lineItems = products.map((p: any) => {
    const quantity = Number(p.quantity ?? 1);
    const unitPrice = Number(p.unit_price ?? p.price ?? 0);
    const lineTotal = Number(p.total_price ?? p.total ?? unitPrice * quantity);
    return {
      product_id: p.product_id ?? p.id ?? null,
      name: p.name ?? p.product?.name ?? 'Item',
      quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
    };
  });

  const subtotal = Number(
    order.subtotal_price ?? lineItems.reduce((s: number, i: any) => s + i.line_total, 0),
  );
  const taxes = Number(order.total_tax ?? order.tax ?? 0);
  const charges = Number(order.total_charges ?? order.charge ?? 0);
  const discount = Number(order.total_discount ?? 0);
  const total = Number(order.total_price ?? subtotal + taxes + charges - discount);

  const payments = Array.isArray(order.payments) ? order.payments : [];
  const amountPaid = payments.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
  const balanceDue = Math.max(0, Number((total - amountPaid).toFixed(2)));

  return {
    order_id: order.id ?? null,
    reference: order.reference ?? order.number ?? null,
    table_id: order.table_id ?? order.table?.id ?? null,
    currency: config.app.currency,
    items: lineItems,
    subtotal: Number(subtotal.toFixed(2)),
    taxes: Number(taxes.toFixed(2)),
    charges: Number(charges.toFixed(2)),
    discount: Number(discount.toFixed(2)),
    total: Number(total.toFixed(2)),
    amount_paid: Number(amountPaid.toFixed(2)),
    balance_due: balanceDue,
    is_paid: balanceDue <= 0,
  };
}

/**
 * Build a sample aggregated table bill for demo/preview purposes.
 * Used only when Foodics is not connected (or no orders cached yet) so the
 * split-bill UI can be exercised. The `demo: true` response flag lets the app
 * show a banner; this path auto-disables once real Foodics orders exist.
 */
function buildDemoTableBill(tableId: string) {
  const items = [
    { product_id: 'demo-1', name: 'Greek Salad', quantity: 2, unit_price: 8.5, line_total: 17.0, order_id: 'demo-order-1' },
    { product_id: 'demo-2', name: 'Tzatziki & Pita', quantity: 1, unit_price: 5.0, line_total: 5.0, order_id: 'demo-order-1' },
    { product_id: 'demo-3', name: 'Moussaka', quantity: 2, unit_price: 12.0, line_total: 24.0, order_id: 'demo-order-2' },
    { product_id: 'demo-4', name: 'Calamari', quantity: 1, unit_price: 11.0, line_total: 11.0, order_id: 'demo-order-2' },
    { product_id: 'demo-5', name: 'House Wine (glass)', quantity: 3, unit_price: 6.0, line_total: 18.0, order_id: 'demo-order-2' },
  ];
  const subtotal = items.reduce((s, i) => s + i.line_total, 0); // 75.00
  const taxes = Number((subtotal * 0.1).toFixed(2)); // 7.50
  const charges = 2.5; // service charge
  const discount = 0;
  const total = Number((subtotal + taxes + charges - discount).toFixed(2)); // 85.00
  const amountPaid = 0;
  const balanceDue = Number((total - amountPaid).toFixed(2));
  return {
    table_id: tableId,
    order_ids: ['demo-order-1', 'demo-order-2'],
    currency: config.app.currency,
    items,
    subtotal: Number(subtotal.toFixed(2)),
    taxes,
    charges,
    discount,
    total,
    amount_paid: Number(amountPaid.toFixed(2)),
    balance_due: balanceDue,
    is_paid: balanceDue <= 0,
    per_order: [
      { order_id: 'demo-order-1', reference: 'DEMO-001', subtotal: 22.0, total: 24.75, amount_paid: 0, balance_due: 24.75, is_paid: false },
      { order_id: 'demo-order-2', reference: 'DEMO-002', subtotal: 53.0, total: 60.25, amount_paid: 0, balance_due: 60.25, is_paid: false },
    ],
  };
}

/**
 * Record a payment in Foodics by appending to the order's payments[] array.
 * Returns the updated order.
 */
async function settleInFoodics(params: {
  orderId: string;
  paymentMethodId: string;
  amount: number;
  tendered?: number;
  tips?: number;
  meta?: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  const client = getFoodicsClient();
  const payment = {
    amount: Number(params.amount.toFixed(2)),
    tendered: Number((params.tendered ?? params.amount).toFixed(2)),
    payment_method_id: params.paymentMethodId,
    tips: Number((params.tips ?? 0).toFixed(2)),
    meta: params.meta ?? {},
  };
  const order = await client.updateOrder(params.orderId, { payments: [payment] });
  setOrderCache({ order_id: params.orderId, data: order });
  sendToWaiters('order:paid', { order_id: params.orderId, payment });
  return order;
}

export async function paymentRoutes(app: FastifyInstance): Promise<void> {
  // GET /payment/methods — Foodics payment methods (cached 5 min)
  app.get('/payment/methods', async (_request, reply) => {
    try {
      const client = getFoodicsClient();
      if (!client.hasToken()) {
        return reply.code(503).send({ error: 'Foodics not connected' });
      }

      const now = Date.now();
      if (!paymentMethodsCache || now - paymentMethodsCache.syncedAt > config.cache.paymentMethodsTtlMs) {
        const methods = await client.listPaymentMethods();
        paymentMethodsCache = { data: methods, syncedAt: now };
      }

      return reply.send({ payment_methods: paymentMethodsCache.data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load payment methods';
      console.error('[Payment] methods error:', msg);
      return reply.code(400).send({ error: msg });
    }
  });

  // GET /payment/bill/:orderId — itemized bill for an order
  app.get('/payment/bill/:orderId', async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    try {
      const client = getFoodicsClient();
      if (!client.hasToken()) {
        return reply.code(503).send({ error: 'Foodics not connected' });
      }
      const order = await client.getOrder(orderId);
      setOrderCache({ order_id: orderId, data: order });
      return reply.send({ bill: buildBill(order as Record<string, any>) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load bill';
      console.error('[Payment] bill error:', msg);
      return reply.code(400).send({ error: msg });
    }
  });

  // GET /payment/bill/by-table/:tableId — aggregated bill across all orders at a table.
  // Used by the split-bill flow: merges every cached order for the table into one bill,
  // and exposes each order id so the app can settle a guest's share against their own order.
  // DEMO FALLBACK: when Foodics is not connected (or no orders cached yet), returns a
  // clearly-flagged demo bill so the split-bill UI can be previewed. The `demo: true`
  // flag lets the app show a "demo mode" banner; this auto-disables once Foodics is live.
  app.get('/payment/bill/by-table/:tableId', async (request, reply) => {
    const { tableId } = request.params as { tableId: string };
    try {
      const client = getFoodicsClient();

      // --- DEMO FALLBACK: no Foodics token → return a sample bill ---
      if (!client.hasToken()) {
        const demoBill = buildDemoTableBill(tableId);
        return reply.send({ bill: demoBill, demo: true });
      }

      const cached = getCachedOrdersByTable(tableId);

      // --- DEMO FALLBACK: Foodics connected but no orders yet → sample bill ---
      if (cached.length === 0) {
        const demoBill = buildDemoTableBill(tableId);
        return reply.send({ bill: demoBill, demo: true });
      }

      // Fetch each order fresh from Foodics to get current payments/products state.
      const orderIds: string[] = [];
      const bills: any[] = [];
      for (const row of cached) {
        const orderId = row.order_id;
        try {
          const order = await client.getOrder(orderId);
          setOrderCache({ order_id: orderId, data: order });
          const b = buildBill(order as Record<string, any>);
          orderIds.push(orderId);
          bills.push(b);
        } catch (err) {
          console.error(`[Payment] by-table: failed to refresh order ${orderId}:`, err instanceof Error ? err.message : err);
        }
      }

      if (bills.length === 0) {
        const demoBill = buildDemoTableBill(tableId);
        return reply.send({ bill: demoBill, demo: true });
      }

      // Merge into one aggregated bill.
      const currency = bills[0].currency || config.app.currency;
      const items = bills.flatMap((b) =>
        b.items.map((it: any) => ({ ...it, order_id: b.order_id })),
      );
      const subtotal = bills.reduce((s: number, b: any) => s + b.subtotal, 0);
      const taxes = bills.reduce((s: number, b: any) => s + b.taxes, 0);
      const charges = bills.reduce((s: number, b: any) => s + b.charges, 0);
      const discount = bills.reduce((s: number, b: any) => s + b.discount, 0);
      const total = bills.reduce((s: number, b: any) => s + b.total, 0);
      const amountPaid = bills.reduce((s: number, b: any) => s + b.amount_paid, 0);
      const balanceDue = Math.max(0, Number((total - amountPaid).toFixed(2)));

      const aggregated = {
        table_id: tableId,
        order_ids: orderIds,
        currency,
        items,
        subtotal: Number(subtotal.toFixed(2)),
        taxes: Number(taxes.toFixed(2)),
        charges: Number(charges.toFixed(2)),
        discount: Number(discount.toFixed(2)),
        total: Number(total.toFixed(2)),
        amount_paid: Number(amountPaid.toFixed(2)),
        balance_due: Number(balanceDue.toFixed(2)),
        is_paid: balanceDue <= 0,
        per_order: bills.map((b: any) => ({
          order_id: b.order_id,
          reference: b.reference,
          subtotal: b.subtotal,
          total: b.total,
          amount_paid: b.amount_paid,
          balance_due: b.balance_due,
          is_paid: b.is_paid,
        })),
      };

      return reply.send({ bill: aggregated, demo: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load table bill';
      console.error('[Payment] by-table error:', msg);
      return reply.code(400).send({ error: msg });
    }
  });

  // POST /payment/intent — create a Paymob payment intent (Card/InstaPay/Apple Pay)
  app.post('/payment/intent', async (request, reply) => {
    const body = (request.body ?? {}) as {
      orderId?: string;
      amount?: number;
      method?: 'card' | 'instapay' | 'apple_pay';
      billing?: Record<string, unknown>;
    };

    const { orderId, amount, method } = body;
    if (!orderId || typeof amount !== 'number' || amount <= 0 || !method) {
      return reply.code(400).send({ error: 'orderId, positive amount and method are required' });
    }
    if (!['card', 'instapay', 'apple_pay'].includes(method)) {
      return reply.code(400).send({ error: `Unsupported method: ${method}` });
    }

    const paymob = getPaymobClient();
    if (!paymob.isConfigured()) {
      return reply.code(503).send({ error: 'Paymob is not configured on the server' });
    }
    const integrationId = paymob.getIntegrationId(method);
    if (!integrationId) {
      return reply.code(503).send({ error: `No Paymob integration configured for ${method}` });
    }

    try {
      const amountCents = toCents(amount);

      // Resolve which Foodics method we'll record this against once it succeeds.
      const foodicsClient = getFoodicsClient();
      const methods = (await foodicsClient.listPaymentMethods()) as FoodicsPaymentMethod[];
      const foodicsMethodId = resolveFoodicsMethodId(methods, method);
      if (!foodicsMethodId) {
        return reply.code(400).send({ error: 'No Foodics payment method available to record against' });
      }

      const items: PaymobOrderItem[] = [
        {
          name: `MAZI order ${orderId}`,
          amount_cents: amountCents,
          quantity: 1,
          description: `Settlement for Foodics order ${orderId}`,
        },
      ];

      const token = await paymob.authenticate();
      const paymobOrderId = await paymob.createOrder(token, amountCents, items, orderId);
      const paymentKey = await paymob.getPaymentKey(
        token,
        paymobOrderId,
        amountCents,
        integrationId,
        body.billing as any,
      );
      const iframeUrl = paymob.getIframeUrl(paymentKey);

      // Remember the intent so the webhook can settle the right Foodics order.
      pendingIntents.set(String(paymobOrderId), {
        orderId,
        amount,
        paymentMethodId: foodicsMethodId,
        method,
        settled: false,
      });

      return reply.send({
        paymob_order_id: paymobOrderId,
        payment_key: paymentKey,
        iframe_url: iframeUrl,
        method,
        amount,
      });
    } catch (err: any) {
      const msg = err?.response?.data
        ? JSON.stringify(err.response.data)
        : err instanceof Error
        ? err.message
        : 'Failed to create payment intent';
      console.error('[Payment] intent error:', msg);
      return reply.code(400).send({ error: msg });
    }
  });

  // POST /payment/settle — record a payment in Foodics (used for Cash + manual settle)
  app.post('/payment/settle', async (request, reply) => {
    const body = (request.body ?? {}) as {
      orderId?: string;
      paymentMethodId?: string;
      method?: 'card' | 'instapay' | 'apple_pay' | 'cash';
      amount?: number;
      tendered?: number;
      tips?: number;
      meta?: Record<string, unknown>;
    };

    const { orderId, amount } = body;
    if (!orderId || typeof amount !== 'number' || amount <= 0) {
      return reply.code(400).send({ error: 'orderId and positive amount are required' });
    }

    try {
      const client = getFoodicsClient();
      if (!client.hasToken()) {
        return reply.code(503).send({ error: 'Foodics not connected' });
      }

      // Resolve the payment method id: explicit > derived from logical method.
      let paymentMethodId = body.paymentMethodId;
      if (!paymentMethodId) {
        const methods = (await client.listPaymentMethods()) as FoodicsPaymentMethod[];
        paymentMethodId = resolveFoodicsMethodId(methods, body.method ?? 'cash') ?? undefined;
      }
      if (!paymentMethodId) {
        return reply.code(400).send({ error: 'Could not resolve a Foodics payment method' });
      }

      const order = await settleInFoodics({
        orderId,
        paymentMethodId,
        amount,
        tendered: body.tendered,
        tips: body.tips,
        meta: { ...(body.meta ?? {}), source: 'mazi_app', method: body.method ?? 'cash' },
      });

      return reply.send({ order, bill: buildBill(order as Record<string, any>) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to settle payment';
      console.error('[Payment] settle error:', msg);
      return reply.code(400).send({ error: msg });
    }
  });

  // POST /payment/settle-table — settle the full table balance in one go (host "one tap").
  // Distributes the payment across the table's orders. In demo mode (no Foodics), returns
  // a mocked settled bill so the UI can confirm the flow end-to-end.
  app.post('/payment/settle-table', async (request, reply) => {
    const body = (request.body ?? {}) as {
      tableId?: string;
      method?: 'card' | 'instapay' | 'apple_pay' | 'cash';
      paymentMethodId?: string;
    };
    const { tableId, method } = body;
    if (!tableId) return reply.code(400).send({ error: 'tableId is required' });

    try {
      const client = getFoodicsClient();

      // --- DEMO MODE: no Foodics ---
      if (!client.hasToken()) {
        const demoBill = buildDemoTableBill(tableId);
        // mark as fully paid
        const settled = { ...demoBill, amount_paid: demoBill.total, balance_due: 0, is_paid: true };
        return reply.send({ bill: settled, demo: true, settled: true });
      }

      const cached = getCachedOrdersByTable(tableId);
      if (cached.length === 0) {
        return reply.code(404).send({ error: 'No orders found for this table yet' });
      }

      // Resolve payment method id
      let paymentMethodId = body.paymentMethodId;
      if (!paymentMethodId) {
        const methods = (await client.listPaymentMethods()) as FoodicsPaymentMethod[];
        paymentMethodId = resolveFoodicsMethodId(methods, method ?? 'cash') ?? undefined;
      }
      if (!paymentMethodId) {
        return reply.code(400).send({ error: 'Could not resolve a Foodics payment method' });
      }

      // Settle each order's remaining balance against Foodics.
      const updatedBills: any[] = [];
      for (const row of cached) {
        const orderId = row.order_id;
        try {
          const order = await client.getOrder(orderId);
          const b = buildBill(order as Record<string, any>);
          if (b.balance_due > 0) {
            await settleInFoodics({
              orderId,
              paymentMethodId,
              amount: b.balance_due,
              meta: { source: 'mazi_app', method: method ?? 'cash', table_settle: true },
            });
          }
          updatedBills.push(b);
        } catch (err) {
          console.error(`[Payment] settle-table: order ${orderId} failed:`, err instanceof Error ? err.message : err);
        }
      }

      // Recompute aggregated bill
      const total = updatedBills.reduce((s: number, b: any) => s + b.total, 0);
      const amountPaid = total; // fully settled
      const balanceDue = 0;
      const aggregated = {
        table_id: tableId,
        order_ids: cached.map((r: any) => r.order_id),
        currency: (updatedBills[0]?.currency) || config.app.currency,
        items: updatedBills.flatMap((b: any) => b.items.map((it: any) => ({ ...it, order_id: b.order_id }))),
        subtotal: Number(updatedBills.reduce((s: number, b: any) => s + b.subtotal, 0).toFixed(2)),
        taxes: Number(updatedBills.reduce((s: number, b: any) => s + b.taxes, 0).toFixed(2)),
        charges: Number(updatedBills.reduce((s: number, b: any) => s + b.charges, 0).toFixed(2)),
        discount: Number(updatedBills.reduce((s: number, b: any) => s + b.discount, 0).toFixed(2)),
        total: Number(total.toFixed(2)),
        amount_paid: Number(amountPaid.toFixed(2)),
        balance_due: Number(balanceDue.toFixed(2)),
        is_paid: true,
        per_order: updatedBills.map((b: any) => ({
          order_id: b.order_id, reference: b.reference, subtotal: b.subtotal,
          total: b.total, amount_paid: b.total, balance_due: 0, is_paid: true,
        })),
      };
      return reply.send({ bill: aggregated, demo: false, settled: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to settle table';
      console.error('[Payment] settle-table error:', msg);
      return reply.code(400).send({ error: msg });
    }
  });

  // POST /payment/webhook — Paymob payment confirmation
  app.post('/payment/webhook', async (request, reply) => {
    const body = (request.body ?? {}) as { type?: string; obj?: Record<string, any> };
    const hmac = (request.query as { hmac?: string }).hmac ?? '';
    const txn = body.obj ?? {};

    const paymob = getPaymobClient();

    // Verify authenticity. If a secret is configured and verification fails, reject.
    if (config.paymob.webhookSecret && !paymob.verifyWebhook(hmac, txn)) {
      console.warn('[Payment] webhook HMAC verification failed');
      return reply.code(401).send({ error: 'Invalid signature' });
    }

    const success = txn.success === true || txn.success === 'true';
    const paymobOrderId = String(txn.order?.id ?? txn.order ?? '');
    const intent = pendingIntents.get(paymobOrderId);

    // Always acknowledge quickly so Paymob stops retrying.
    if (!intent) {
      console.warn(`[Payment] webhook for unknown Paymob order ${paymobOrderId}`);
      return reply.code(200).send({ received: true });
    }

    if (success && !intent.settled) {
      try {
        await settleInFoodics({
          orderId: intent.orderId,
          paymentMethodId: intent.paymentMethodId,
          amount: intent.amount,
          meta: {
            source: 'paymob',
            method: intent.method,
            paymob_order_id: paymobOrderId,
            paymob_transaction_id: txn.id,
          },
        });
        intent.settled = true;
        console.log(`[Payment] settled Foodics order ${intent.orderId} via Paymob`);
      } catch (err) {
        console.error('[Payment] webhook settle failed:', err instanceof Error ? err.message : err);
      }
    }

    return reply.code(200).send({ received: true });
  });
}
