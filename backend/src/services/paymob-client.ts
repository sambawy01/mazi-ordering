import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { config } from '../config.js';

/**
 * Paymob Accept API client.
 *
 * Paymob is the payment gateway that actually CHARGES the customer (Card,
 * InstaPay, Apple Pay). Once a charge succeeds, the payment is recorded in
 * Foodics POS via the payments[] array — Foodics itself never processes money.
 *
 * The classic Paymob "Accept" flow is three steps:
 *   1. authenticate()      -> short-lived auth token
 *   2. createOrder()       -> a Paymob order (the thing being paid for)
 *   3. getPaymentKey()     -> a payment token scoped to one integration
 * The payment token is then loaded into a hosted iframe where the customer
 * enters their details. Paymob calls our webhook with the final result.
 *
 * IMPORTANT: every amount handed to Paymob is in the smallest currency unit
 * (piasters/cents). Convert from major units (EGP) before calling.
 */

export interface PaymobBillingData {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  // Paymob rejects empty billing objects — every field must be present.
  apartment?: string;
  floor?: string;
  street?: string;
  building?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
}

export interface PaymobOrderItem {
  name: string;
  amount_cents: number;
  quantity: number;
  description?: string;
}

/** Convert a major-unit amount (e.g. 91.25 EGP) to integer cents (9125). */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Fill a billing object with Paymob's required "NA" defaults. */
function normaliseBilling(billing?: PaymobBillingData): Required<PaymobBillingData> {
  const NA = 'NA';
  return {
    first_name: billing?.first_name || NA,
    last_name: billing?.last_name || NA,
    email: billing?.email || 'guest@mazi.app',
    phone_number: billing?.phone_number || NA,
    apartment: billing?.apartment || NA,
    floor: billing?.floor || NA,
    street: billing?.street || NA,
    building: billing?.building || NA,
    city: billing?.city || NA,
    state: billing?.state || NA,
    country: billing?.country || NA,
    postal_code: billing?.postal_code || NA,
  };
}

export class PaymobClient {
  private http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: config.paymob.baseUrl,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    });
  }

  /** True once an API key is configured. */
  isConfigured(): boolean {
    return !!config.paymob.apiKey;
  }

  /**
   * Step 1 — exchange the merchant API key for a short-lived auth token.
   */
  async authenticate(): Promise<string> {
    const res = await this.http.post<{ token: string }>('/api/auth/tokens', {
      api_key: config.paymob.apiKey,
    });
    return res.data.token;
  }

  /**
   * Step 2 — register an order with Paymob. Returns the Paymob order id.
   * `merchantOrderId` ties the Paymob order back to our Foodics order so the
   * webhook can settle the correct order later.
   */
  async createOrder(
    token: string,
    amountCents: number,
    items: PaymobOrderItem[],
    merchantOrderId?: string,
  ): Promise<number> {
    const res = await this.http.post<{ id: number }>('/api/ecommerce/orders', {
      auth_token: token,
      delivery_needed: false,
      amount_cents: amountCents,
      currency: config.app.currency === 'SAR' ? 'EGP' : config.app.currency,
      ...(merchantOrderId ? { merchant_order_id: merchantOrderId } : {}),
      items,
    });
    return res.data.id;
  }

  /**
   * Step 3 — generate a payment key (token) for a specific integration.
   * The returned token is loaded into the hosted iframe.
   */
  async getPaymentKey(
    token: string,
    paymobOrderId: number,
    amountCents: number,
    integrationId: string,
    billing?: PaymobBillingData,
  ): Promise<string> {
    const res = await this.http.post<{ token: string }>('/api/acceptance/payment_keys', {
      auth_token: token,
      amount_cents: amountCents,
      expiration: 3600,
      order_id: paymobOrderId,
      currency: config.app.currency === 'SAR' ? 'EGP' : config.app.currency,
      integration_id: Number(integrationId),
      billing_data: normaliseBilling(billing),
      lock_order_when_paid: true,
    });
    return res.data.token;
  }

  /**
   * Build the hosted iframe URL the app loads in a WebView.
   */
  getIframeUrl(paymentKey: string, iframeId?: string): string {
    const frame = iframeId || config.paymob.iframeId;
    return `${config.paymob.baseUrl}/api/acceptance/iframes/${frame}?payment_token=${paymentKey}`;
  }

  /**
   * Resolve a logical method name to the configured integration id.
   */
  getIntegrationId(method: 'card' | 'instapay' | 'apple_pay'): string {
    switch (method) {
      case 'card':
        return config.paymob.integrationCardId;
      case 'instapay':
        return config.paymob.integrationInstapayId;
      case 'apple_pay':
        return config.paymob.integrationApplePayId;
    }
  }

  /**
   * Verify a Paymob webhook HMAC signature.
   *
   * Paymob concatenates a fixed, lexicographically-ordered subset of the
   * transaction object fields, SHA-512 HMACs it with the merchant secret, and
   * sends the result as the `hmac` query param. We recompute and compare.
   */
  verifyWebhook(hmac: string, obj: Record<string, unknown>): boolean {
    if (!config.paymob.webhookSecret || !hmac) return false;

    // Order is mandated by Paymob — do not sort or reorder.
    const keys = [
      'amount_cents',
      'created_at',
      'currency',
      'error_occured',
      'has_parent_transaction',
      'id',
      'integration_id',
      'is_3d_secure',
      'is_auth',
      'is_capture',
      'is_refunded',
      'is_standalone_payment',
      'is_voided',
      'order.id',
      'owner',
      'pending',
      'source_data.pan',
      'source_data.sub_type',
      'source_data.type',
      'success',
    ];

    const concatenated = keys
      .map((path) => {
        const value = path.split('.').reduce<unknown>((acc, part) => {
          if (acc && typeof acc === 'object') {
            return (acc as Record<string, unknown>)[part];
          }
          return undefined;
        }, obj);
        if (value === true) return 'true';
        if (value === false) return 'false';
        if (value === null || value === undefined) return '';
        return String(value);
      })
      .join('');

    const computed = crypto
      .createHmac('sha512', config.paymob.webhookSecret)
      .update(concatenated)
      .digest('hex');

    // Constant-time comparison to avoid timing leaks.
    try {
      return crypto.timingSafeEqual(
        Buffer.from(computed, 'hex'),
        Buffer.from(hmac, 'hex'),
      );
    } catch {
      return false;
    }
  }
}

// Singleton instance
let clientInstance: PaymobClient | null = null;

export function getPaymobClient(): PaymobClient {
  if (!clientInstance) {
    clientInstance = new PaymobClient();
  }
  return clientInstance;
}
