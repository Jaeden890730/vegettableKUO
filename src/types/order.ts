// Customer types
export interface Customer {
  id: string;
  user_id: string | null;
  name: string;
  phone: string | null;
  contact_person: string | null;
  settlement_cycle: 'weekly' | 'monthly';
  note: string | null;
  is_active: boolean;
  can_view_all_dates: boolean;
  can_view_item_stats_detail: boolean;
  created_at: string;
  updated_at: string;
}

// Order types
export type OrderStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface OrderItem {
  id: string;
  order_id: string;
  vegetable_id: string | null;
  custom_item_name: string | null;
  quantity: number;
  unit: string;
  packs: number;
  unit_price: number | null;
  note: string | null;
  created_at: string;
  vegetable?: {
    name: string;
  };
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  order_date: string;
  delivery_date: string | null;
  status: OrderStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  order_items?: OrderItem[];
}

// Settlement types
export type SettlementStatus = 'draft' | 'confirmed' | 'partial_paid' | 'paid';

export interface SettlementItem {
  id: string;
  settlement_id: string;
  order_item_id: string | null;
  item_name: string;
  settlement_quantity: number;
  settlement_unit: string;
  settlement_unit_price: number;
  subtotal: number;
  order_date: string | null;
  note: string | null;
  created_at: string;
}

export interface Settlement {
  id: string;
  settlement_number: string;
  customer_id: string;
  period_start: string;
  period_end: string;
  status: SettlementStatus;
  total_amount: number;
  paid_amount: number;
  note: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  settlement_items?: SettlementItem[];
  payments?: Payment[];
}

// Payment types
export type PaymentMethod = 'cash' | 'transfer' | 'check' | 'other';

export interface Payment {
  id: string;
  settlement_id: string;
  payment_date: string;
  amount: number;
  payment_method: PaymentMethod;
  note: string | null;
  created_at: string;
}

// Dashboard statistics
export interface DashboardStats {
  todayOrders: number;
  weekOrders: number;
  monthOrders: number;
  pendingSettlementAmount: number;
  outstandingAmount: number;
  paidAmount: number;
  customerStats: {
    customerId: string;
    customerName: string;
    outstanding: number;
    monthlyTotal: number;
  }[];
}
