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

// --- Webhooks (for testing) ---
export async function getWebhookEvents() {
  const res = await api.get('/webhooks/events');
  return res.data.events;
}

export { api };