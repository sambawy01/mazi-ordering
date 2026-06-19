import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Product, Category, Table, Order, QRPayload } from '../types';

// Backend API URL — your live Railway deployment
const API_BASE = 'https://mazi-ordering-production.up.railway.app/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach auth token if present
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('mazi_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- Auth ---
export async function loginStaff(id: string, pin: string) {
  const res = await api.post('/auth/waiter', { app_id: id, pin });
  if (res.data.token) {
    await AsyncStorage.setItem('mazi_token', res.data.token);
  }
  return res.data;
}

export async function getAuthStatus() {
  const res = await api.get('/auth/status');
  return res.data;
}

// --- Phone Verification (Twilio) ---
export async function sendPhoneCode(phone: string) {
  const res = await api.post('/phone/send-code', { phone });
  return res.data;
}

export async function verifyPhoneCode(phone: string, code: string) {
  const res = await api.post('/phone/verify-code', { phone, code });
  return res.data;
}

export async function isPhoneVerified(phone: string) {
  const res = await api.get(`/phone/verified/${encodeURIComponent(phone)}`);
  return res.data;
}

// --- QR Code ---
export async function generateQRCode(tableId: string, reservationName: string, branchId?: string) {
  const res = await api.post('/qrcode/generate', {
    table_id: tableId,
    reservation_name: reservationName,
    branch_id: branchId,
  });
  return res.data;
}

export async function decodeQRPayload(payload: string) {
  const res = await api.post('/qrcode/decode', { payload });
  return res.data as QRPayload;
}

// --- Menu ---
export async function getMenu() {
  const res = await api.get('/menu');
  return {
    products: res.data.products as Product[],
    categories: res.data.categories as Category[],
  };
}

export async function getProducts() {
  const res = await api.get('/menu/products');
  return res.data.products as Product[];
}

export async function getCategories() {
  const res = await api.get('/menu/categories');
  return res.data.categories as Category[];
}

// --- Tables ---
export async function getTables() {
  const res = await api.get('/tables');
  return res.data.tables as Table[];
}

export async function getTable(id: string) {
  const res = await api.get(`/tables/${id}`);
  return res.data.table as Table;
}

// --- Orders ---
export async function createOrder(data: {
  branch_id: string;
  table_id?: string;
  type?: number;
  guests?: number;
  products?: any[];
  source?: string;
  reservation_name?: string;
  customer_phone?: string;
  customer_name?: string;
  kitchen_notes?: string;
}) {
  const res = await api.post('/orders', data);
  return res.data.order as Order;
}

export async function getOrder(id: string) {
  const res = await api.get(`/orders/${id}`);
  return res.data.order as Order;
}

export async function listOrders(branchId?: string) {
  const res = await api.get('/orders', { params: { branch_id: branchId } });
  return res.data.orders as Order[];
}

export async function addProductsToOrder(orderId: string, products: any[]) {
  const res = await api.post(`/orders/${orderId}/products`, { products });
  return res.data.order as Order;
}

// --- Payment ---
export interface BillItem {
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  order_id?: string;
}

export interface Bill {
  order_id: string | null;
  reference: string | null;
  table_id: string | null;
  currency: string;
  items: BillItem[];
  subtotal: number;
  taxes: number;
  charges: number;
  discount: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  is_paid: boolean;
}

export interface FoodicsPaymentMethod {
  id: string;
  name?: string;
  code?: string;
  type?: string | number;
}

export type PaymobMethod = 'card' | 'instapay' | 'apple_pay';

export async function getPaymentMethods() {
  const res = await api.get('/payment/methods');
  return res.data.payment_methods as FoodicsPaymentMethod[];
}

export async function getBill(orderId: string) {
  const res = await api.get(`/payment/bill/${encodeURIComponent(orderId)}`);
  return res.data.bill as Bill;
}

// Aggregated table bill (all orders at the table merged).
export interface TableBill extends Bill {
  order_ids: string[];
  per_order: {
    order_id: string;
    reference: string | null;
    subtotal: number;
    total: number;
    amount_paid: number;
    balance_due: number;
    is_paid: boolean;
  }[];
}

export async function getTableBill(tableId: string) {
  const res = await api.get(`/payment/bill/by-table/${encodeURIComponent(tableId)}`);
  return { bill: res.data.bill as TableBill, demo: res.data.demo === true };
}

export async function createPaymentIntent(data: {
  orderId: string;
  amount: number;
  method: PaymobMethod;
  billing?: Record<string, any>;
}) {
  const res = await api.post('/payment/intent', data);
  return res.data as {
    paymob_order_id: number;
    payment_key: string;
    iframe_url: string;
    method: PaymobMethod;
    amount: number;
  };
}

export async function settlePayment(data: {
  orderId: string;
  amount: number;
  method?: PaymobMethod | 'cash';
  paymentMethodId?: string;
  tendered?: number;
  tips?: number;
  meta?: Record<string, any>;
}) {
  const res = await api.post('/payment/settle', data);
  return res.data as { order: Order; bill: Bill };
}

// --- Webhooks (for testing) ---
export async function getWebhookEvents() {
  const res = await api.get('/webhooks/events');
  return res.data.events;
}

export { api };