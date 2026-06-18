// Foodics API type definitions

export interface FoodicsUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  number: string | null;
  pin: string;
  is_owner: boolean;
  lang: string;
}

export interface FoodicsTable {
  id: string;
  name: string;
  status: TableStatus | null;
  seats: number;
  section: {
    id: string;
    name: string;
  } | null;
  revenue_center: {
    id: string;
    name: string;
    type: number;
  } | null;
  accepts_reservations: boolean;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export enum TableStatus {
  Free = 1,
  Occupied = 2,
  CheckPrinted = 3,
  Reserved = 4,
}

export interface FoodicsCategory {
  id: string;
  name: string;
  name_localized: string | null;
  reference: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface FoodicsProduct {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  name_localized: string | null;
  description: string | null;
  description_localized: string | null;
  image: string | null;
  is_active: boolean;
  is_ready: boolean;
  is_non_revenue: boolean;
  is_stock_product: boolean;
  price: number | null;
  cost: number | null;
  calories: number | null;
  preparation_time: number;
  category: {
    id: string;
    name: string;
  } | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface FoodicsModifier {
  id: string;
  name: string;
  name_localized: string | null;
  options: FoodicsModifierOption[];
}

export interface FoodicsModifierOption {
  id: string;
  name: string;
  name_localized: string | null;
  sku: string;
  price: number;
  is_active: boolean;
  cost: number | null;
  calories: number | null;
}

export interface FoodicsBranch {
  id: string;
  name: string;
  name_localized: string | null;
  type: number;
  latitude: string | null;
  longitude: string | null;
  phone: string | null;
  opening_from: string;
  opening_to: string;
  reference: string | null;
}

export interface FoodicsCustomer {
  id: string;
  name: string;
  dial_code: number;
  phone: string;
  email: string;
  gender: number;
  is_blacklisted: boolean;
}

// Order types
export enum OrderType {
  DineIn = 1,
  Takeaway = 2,
  Delivery = 3,
}

// Order statuses (from API docs — statuses seen on order + products)
export enum OrderStatus {
  Open = 1,
  Sent = 2,
  Preparing = 3,
  Ready = 4,
  Served = 5,
  Closed = 6,
  Cancelled = 7,
}

// --- Create Order Request ---

export interface CreateOrderProduct {
  product_id: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
  discount_amount?: number;
  discount_id?: string;
  discount_type?: number;
  options?: {
    modifier_option_id: string;
    quantity: number;
    unit_price?: number;
    total_price?: number;
    taxes?: { id: string; rate: number; amount: number }[];
  }[];
  taxes?: { id: string; rate: number; amount: number }[];
  kitchen_notes?: string;
  meta?: Record<string, unknown>;
}

export interface CreateOrderRequest {
  type: OrderType;
  branch_id: string;
  table_id?: string;
  guests?: number;
  customer_id?: string;
  customer_notes?: string;
  kitchen_notes?: string;
  due_at?: string;
  discount_type?: number;
  discount_id?: string;
  discount_amount?: number;
  driver_id?: string;
  customer_address_id?: string;
  meta?: Record<string, unknown>;
  products?: CreateOrderProduct[];
  combos?: Record<string, unknown>[];
  charges?: {
    charge_id: string;
    amount: number;
    tax_exclusive_amount?: number;
    taxes?: { id: string; rate: number; amount: number }[];
  }[];
}

// --- API Response wrappers ---

export interface FoodicsListResponse<T> {
  data: T[];
  meta?: {
    pagination?: {
      count: number;
      total: number;
      per_page: number;
      current_page: number;
      total_pages: number;
      links: { [key: string]: string | null };
    };
  };
}

export interface FoodicsSingleResponse<T> {
  data: T;
}

export interface FoodicsOAuthResponse {
  token_type: string;
  access_token: string;
}

// --- Internal app types ---

export interface WaiterSession {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    is_owner: boolean;
  };
  createdAt: number;
}

export interface QRPayload {
  t: string;  // table_id
  r: string;  // reservation_name
  b: string;  // branch_id
}