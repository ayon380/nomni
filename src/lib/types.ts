export type OrderProvider = 'uber_eats' | 'doordash';

export type OrderStatus =
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface OrderCustomer {
  name: string;
  phone?: string;
}

export interface OrderLineItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number; // in cents
  line_total: number; // in cents (quantity * unit_price)
  special_instructions?: string;
}

export interface InternalOrder {
  id: string;
  provider: OrderProvider;
  external_order_id: string;
  status: OrderStatus;
  customer: OrderCustomer;
  line_items: OrderLineItem[];
  total_cents: number;
  currency: string;
  created_at: string;
  raw_payload: Record<string, unknown>;
}

export interface OrdersFilterParams {
  provider?: string;
  status?: string;
  search?: string;
  sort?: 'time_desc' | 'time_asc';
}

export interface WebhookIngestResult {
  order: InternalOrder;
  isUpsert: boolean;
  provider: OrderProvider;
  acknowledgment: Record<string, unknown>;
}
