// MAZI app types

export type TableStatus = 'free' | 'occupied' | 'reserved';

export interface Table {
  id: string;
  name: string;
  status: TableStatus;
  seats: number;
  section?: string;
  accepts_reservations?: boolean;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  category_id?: string;
  category_name?: string;
  preparation_time?: number;
  calories?: number;
}

export interface Category {
  id: string;
  name: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedOptions?: any[];
  kitchenNotes?: string;
}

export interface Order {
  id: string;
  table_id?: string;
  table_name?: string;
  branch_id?: string;
  status?: number;
  total?: number;
  source?: string;
  reservation_name?: string;
  products?: OrderProduct[];
}

export interface OrderProduct {
  product_id?: string;
  name?: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
}

export interface QRPayload {
  table_id: string;
  reservation_name: string;
  branch_id: string;
}

export interface Guest {
  id: string;
  name: string;
  phone: string;
  role: 'owner' | 'guest';
  approved: boolean;
}

export interface ApprovalRequest {
  id: string;
  name: string;
  phone: string;
  time: string;
  status: 'pending' | 'approved' | 'denied';
}