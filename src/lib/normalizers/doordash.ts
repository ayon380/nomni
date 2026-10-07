import { InternalOrder, OrderStatus } from '../types';

export const DOORDASH_DEFAULT_TOKEN = process.env.DOORDASH_WEBHOOK_TOKEN || 'doordash_marketplace_token_2026';

/**
 * Authenticates DoorDash webhooks using Bearer token or custom integration header.
 */
export function verifyDoorDashAuth(
  authHeader: string | null | undefined,
  expectedToken: string = DOORDASH_DEFAULT_TOKEN
): boolean {
  if (!authHeader) return false;
  
  // Format: "Bearer <token>" or raw token
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  return token === expectedToken;
}

/**
 * Maps raw DoorDash status to the canonical internal OrderStatus.
 */
function mapDoorDashStatus(status: string | undefined): OrderStatus {
  switch (status?.toUpperCase()) {
    case 'NEW':
      return 'RECEIVED';
    case 'CONFIRMED':
    case 'ACCEPTED':
      return 'CONFIRMED';
    case 'IN_PREPARATION':
      return 'PREPARING';
    case 'READY_FOR_PICKUP':
    case 'READY':
      return 'READY';
    case 'PICKED_UP':
    case 'DELIVERED':
    case 'COMPLETED':
      return 'DELIVERED';
    case 'CANCELLED':
    case 'CANCELED':
      return 'CANCELLED';
    default:
      return 'RECEIVED';
  }
}

/**
 * Normalizes a DoorDash Marketplace OrderCreate webhook into the canonical internal order model.
 *
 * Requirements strictly honored:
 * - Line items live under order.items[] (per official DoorDash Marketplace spec).
 * - total_cents is calculated as subtotal + tax + tip_amount (in cents).
 * - Customer info extracted from order.consumer.
 */
export function normalizeDoorDashOrder(payload: Record<string, any>): InternalOrder {
  const order = payload.order || payload;

  const consumer = order.consumer || {};
  const customerName = [consumer.first_name, consumer.last_name].filter(Boolean).join(' ') || 'DoorDash Customer';
  const customerPhone = consumer.phone_number || undefined;

  const rawItems = order.items || [];
  const line_items = rawItems.map((item: any, idx: number) => {
    const unitPrice = typeof item.price === 'number' ? item.price : 0;
    const quantity = typeof item.quantity === 'number' ? item.quantity : 1;
    const lineTotal = unitPrice * quantity;

    return {
      id: item.id || `dd_item_${idx + 1}`,
      name: item.name || 'Untitled Item',
      quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
      special_instructions: item.special_instructions || undefined,
    };
  });

  // DoorDash pricing breakdown (all integers in cents)
  const subtotal = typeof order.subtotal === 'number' ? order.subtotal : 0;
  const tax = typeof order.tax === 'number' ? order.tax : 0;
  const tip = typeof order.tip_amount === 'number' ? order.tip_amount : 0;
  const totalCents = (subtotal + tax + tip) ||
    line_items.reduce((acc: number, it: any) => acc + it.line_total, 0);

  const currency = order.currency || 'USD';
  const externalId = order.display_id || order.id || `DD-${Date.now()}`;
  const internalId = `ord_dd_${String(order.id || externalId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;

  return {
    id: internalId,
    provider: 'doordash',
    external_order_id: String(externalId),
    status: mapDoorDashStatus(payload.event?.status || order.status || 'NEW'),
    customer: {
      name: customerName,
      phone: customerPhone,
    },
    line_items,
    total_cents: totalCents,
    currency,
    created_at: payload.event?.created_at || new Date().toISOString(),
    raw_payload: payload,
  };
}
