import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

export const config = {
  foodics: {
    baseUrl: process.env.FOODICS_BASE_URL || 'https://api-sandbox.foodics.com/v5',
    clientId: process.env.FOODICS_CLIENT_ID || '',
    clientSecret: process.env.FOODICS_CLIENT_SECRET || '',
    redirectUri: process.env.FOODICS_REDIRECT_URI || 'https://yourapp.com/callback',
    branchId: process.env.FOODICS_BRANCH_ID || '',
  },
  backend: {
    port: parseInt(process.env.PORT || process.env.BACKEND_PORT || '3000', 10),
    jwtSecret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-secret-change-me'),
    dbPath: process.env.DB_PATH || './data/foodics.db',
  },
  app: {
    name: process.env.APP_NAME || 'Foodics Ordering',
    currency: process.env.DEFAULT_CURRENCY || 'EGP',
  },
  paymob: {
    // Base URL for the Paymob Accept API (Egypt region by default).
    baseUrl: process.env.PAYMOB_BASE_URL || 'https://accept.paymob.com',
    apiKey: process.env.PAYMOB_API_KEY || '',
    // One integration ID per supported payment method.
    integrationCardId: process.env.PAYMOB_INTEGRATION_ID_CARD || '',
    integrationInstapayId: process.env.PAYMOB_INTEGRATION_ID_INSTAPAY || '',
    integrationApplePayId: process.env.PAYMOB_INTEGRATION_ID_APPLE_PAY || '',
    // Iframe used to render the hosted card/instapay/apple-pay form.
    iframeId: process.env.PAYMOB_IFRAME_ID || '',
    // HMAC secret used to verify webhook authenticity.
    webhookSecret: process.env.PAYMOB_WEBHOOK_HMAC_SECRET || '',
  },
  cache: {
    menuTtlMs: 5 * 60 * 1000,     // 5 minutes
    tableTtlMs: 30 * 1000,          // 30 seconds
    branchTtlMs: 60 * 60 * 1000,    // 1 hour
    paymentMethodsTtlMs: 5 * 60 * 1000, // 5 minutes
  },
} as const;