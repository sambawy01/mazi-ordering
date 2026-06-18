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
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
    dbPath: process.env.DB_PATH || './data/foodics.db',
  },
  app: {
    name: process.env.APP_NAME || 'Foodics Ordering',
    currency: process.env.DEFAULT_CURRENCY || 'SAR',
  },
  cache: {
    menuTtlMs: 5 * 60 * 1000,     // 5 minutes
    tableTtlMs: 30 * 1000,          // 30 seconds
    branchTtlMs: 60 * 60 * 1000,    // 1 hour
  },
} as const;