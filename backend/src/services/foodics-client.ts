import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../config.js';
import {
  FoodicsOAuthResponse,
  FoodicsListResponse,
  FoodicsSingleResponse,
  FoodicsTable,
  FoodicsProduct,
  FoodicsCategory,
  FoodicsBranch,
  FoodicsUser,
  FoodicsCustomer,
  CreateOrderRequest,
  OrderType,
} from '../types/index.js';

/**
 * Foodics API v5 client.
 * Handles OAuth token management, rate-limit-safe requests,
 * and all endpoint wrappers we need for the ordering app.
 */
export class FoodicsClient {
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;
  private http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: config.foodics.baseUrl,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    // Attach auth header interceptor
    this.http.interceptors.request.use((reqConfig) => {
      if (this.accessToken) {
        reqConfig.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      return reqConfig;
    });

    // Rate limit tracking
    this.http.interceptors.response.use(
      (res) => {
        const remaining = res.headers['x-ratelimit-remaining'];
        if (remaining !== undefined) {
          rateLimitRemaining = parseInt(remaining as string, 10);
        }
        return res;
      },
      (err: AxiosError) => {
        if (err.response?.status === 429) {
          const retryAfter = err.response.headers['retry-after'];
          rateLimitBlockedUntil = Date.now() + (parseInt(retryAfter as string, 10) || 60) * 1000;
          console.warn(`[Foodics] Rate limited. Blocked until ${new Date(rateLimitBlockedUntil).toISOString()}`);
        }
        return Promise.reject(err);
      },
    );
  }

  // --- OAuth ---

  /**
   * Exchange authorization code for access token (OAuth 2.0 Code Grant).
   * Called after the restaurant owner authorizes the app via Foodics apps store.
   */
  async exchangeAuthCode(code: string): Promise<string> {
    const res = await axios.post<FoodicsOAuthResponse>(
      `${config.foodics.baseUrl}/oauth/token`,
      {
        grant_type: 'authorization_code',
        code,
        client_id: config.foodics.clientId,
        client_secret: config.foodics.clientSecret,
        redirect_uri: config.foodics.redirectUri,
      },
      { headers: { 'Content-Type': 'application/json' } },
    );
    this.accessToken = res.data.access_token;
    // Tokens don't have explicit expiry in Foodics; assume 24h
    this.tokenExpiry = Date.now() + 24 * 60 * 60 * 1000;
    return this.accessToken;
  }

  /**
   * Set access token directly (for cases where token is already stored in DB).
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
    this.tokenExpiry = Date.now() + 24 * 60 * 60 * 1000;
  }

  /**
   * Check if we have a valid token.
   */
  hasToken(): boolean {
    return !!this.accessToken && (!this.tokenExpiry || Date.now() < this.tokenExpiry);
  }

  /**
   * For development: if you already have an access token from Foodics dashboard,
   * set it via env var FOODICS_ACCESS_TOKEN or call setAccessToken().
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  // --- Rate limit guard ---

  private checkRateLimit(): void {
    if (rateLimitBlockedUntil && Date.now() < rateLimitBlockedUntil) {
      throw new Error(`Rate limited until ${new Date(rateLimitBlockedUntil).toISOString()}`);
    }
  }

  // --- Branches ---

  async listBranches(params?: { per_page?: number }): Promise<FoodicsBranch[]> {
    this.checkRateLimit();
    const res = await this.http.get<FoodicsListResponse<FoodicsBranch>>('/branches', {
      params: { per_page: params?.per_page ?? 100 },
    });
    return res.data.data;
  }

  // --- Users (waiters/cashiers) ---

  async listUsers(): Promise<FoodicsUser[]> {
    this.checkRateLimit();
    const res = await this.http.get<FoodicsListResponse<FoodicsUser>>('/users', {
      params: { per_page: 100 },
    });
    return res.data.data;
  }

  async getUser(id: string): Promise<FoodicsUser> {
    this.checkRateLimit();
    const res = await this.http.get<FoodicsSingleResponse<FoodicsUser>>(`/users/${id}`);
    return res.data.data;
  }

  // --- Tables ---

  async listTables(params?: { per_page?: number; is_deleted?: 0 | 1 }): Promise<FoodicsTable[]> {
    this.checkRateLimit();
    const res = await this.http.get<FoodicsListResponse<FoodicsTable>>('/tables', {
      params: { per_page: params?.per_page ?? 100, is_deleted: params?.is_deleted ?? 0 },
    });
    return res.data.data;
  }

  async getTable(id: string): Promise<FoodicsTable> {
    this.checkRateLimit();
    const res = await this.http.get<FoodicsSingleResponse<FoodicsTable>>(`/tables/${id}`);
    return res.data.data;
  }

  // --- Categories ---

  async listCategories(): Promise<FoodicsCategory[]> {
    this.checkRateLimit();
    const res = await this.http.get<FoodicsListResponse<FoodicsCategory>>('/categories', {
      params: { per_page: 100 },
    });
    return res.data.data;
  }

  // --- Products ---

  async listProducts(params?: { per_page?: number; is_active?: 0 | 1 }): Promise<FoodicsProduct[]> {
    this.checkRateLimit();
    const res = await this.http.get<FoodicsListResponse<FoodicsProduct>>('/products', {
      params: { per_page: params?.per_page ?? 200, is_active: params?.is_active ?? 1 },
    });
    return res.data.data;
  }

  // --- Customers ---

  async createCustomer(data: {
    name: string;
    dial_code: number;
    phone: string;
    email?: string;
    gender?: number;
  }): Promise<FoodicsCustomer> {
    this.checkRateLimit();
    const res = await this.http.post<FoodicsSingleResponse<FoodicsCustomer>>('/customers', data);
    return res.data.data;
  }

  // --- Orders ---

  async createOrder(order: CreateOrderRequest): Promise<Record<string, unknown>> {
    this.checkRateLimit();
    const res = await this.http.post<FoodicsSingleResponse<Record<string, unknown>>>('/orders', order);
    return res.data.data;
  }

  async updateOrder(orderId: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    this.checkRateLimit();
    const res = await this.http.put<FoodicsSingleResponse<Record<string, unknown>>>(`/orders/${orderId}`, data);
    return res.data.data;
  }

  async getOrder(orderId: string): Promise<Record<string, unknown>> {
    this.checkRateLimit();
    const res = await this.http.get<FoodicsSingleResponse<Record<string, unknown>>>(`/orders/${orderId}`);
    return res.data.data;
  }

  async listOrders(params?: {
    per_page?: number;
    branch_id?: string;
    table_id?: string;
  }): Promise<Record<string, unknown>[]> {
    this.checkRateLimit();
    const res = await this.http.get<FoodicsListResponse<Record<string, unknown>>>('/orders', {
      params: {
        per_page: params?.per_page ?? 50,
        ...(params?.branch_id ? { branch_id: params.branch_id } : {}),
      },
    });
    return res.data.data;
  }

  // --- Whoami (verify token) ---

  async whoami(): Promise<Record<string, unknown>> {
    const res = await this.http.get<FoodicsSingleResponse<Record<string, unknown>>>('/whoami');
    return res.data.data;
  }
}

// Rate limit tracking (module-level)
let rateLimitRemaining: number = 90;
let rateLimitBlockedUntil: number | null = null;

export function getRateLimitStatus() {
  return { remaining: rateLimitRemaining, blockedUntil: rateLimitBlockedUntil };
}

// Singleton instance
let clientInstance: FoodicsClient | null = null;

export function getFoodicsClient(): FoodicsClient {
  if (!clientInstance) {
    clientInstance = new FoodicsClient();
    // If a token was pre-set in env, use it (for dev/testing)
    const envToken = process.env.FOODICS_ACCESS_TOKEN;
    if (envToken) {
      clientInstance.setAccessToken(envToken);
      console.log('[Foodics] Using access token from env var');
    }
  }
  return clientInstance;
}