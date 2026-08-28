export type UserRole = 'admin' | 'manager' | 'staff' | 'viewer';

export interface Business {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  subscription_tier: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessUser {
  id: string;
  business_id: string;
  user_id: string;
  role: UserRole;
  full_name: string | null;
  email: string | null;
  permissions: Record<string, boolean>;
  active: boolean;
  joined_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  customer_type: string;
  credit_limit: number;
  total_purchases: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  sku: string | null;
  category: string;
  unit_price: number;
  cost_price: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  business_id: string;
  product_id: string;
  quantity_on_hand: number;
  reorder_level: number;
  reorder_quantity: number;
  last_counted_at: string | null;
  updated_at: string;
}

export interface Sale {
  id: string;
  business_id: string;
  customer_id: string | null;
  sale_date: string;
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
  payment_status: string;
  payment_method: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  business_id: string;
  category: string;
  description: string | null;
  amount: number;
  expense_date: string;
  payment_method: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  business_id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  changes: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}
