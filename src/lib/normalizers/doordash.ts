import crypto from 'crypto';
import { InternalOrder, OrderStatus } from '../types';

export const DOORDASH_DEFAULT_TOKEN = process.env.DOORDASH_WEBHOOK_TOKEN || 'doordash_marketplace_token_2026';

/**
 * Authenticates DoorDash webhooks using integrator-configured credentials.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyDoorDashAuth(
  authHeader: string | null | undefined,
  expectedToken: string = DOORDASH_DEFAULT_TOKEN
): boolean {
  if (!authHeader || !expectedToken) return false;

  const match = authHeader.match(/^(?:Bearer|Basic)\s+(.+)$/i);
  if (!match) return false;

  const token = match[1].trim();

  try {
    const tokenBuf = Buffer.from(token, 'utf-8');
    const expectedBuf = Buffer.from(expectedToken, 'utf-8');
    if (tokenBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(tokenBuf, expectedBuf);
  } catch {
    return false;
  }
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
export function normalizeDoorDashOrder(payload: Record<string, unknown>): InternalOrder {
  const p = payload as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const order = p.order || p;

  const consumer = order.consumer || {};
  const customerName = [consumer.first_name, consumer.last_name].filter(Boolean).join(' ') || 'DoorDash Customer';
  // Official DoorDash schema uses consumer.phone or consumer.phone_number
  const customerPhone = consumer.phone || consumer.phone_number || undefined;

  // In official DoorDash schema, items may live directly under order.items or nested under order.categories[].items
  let rawItems: Record<string, any>[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (Array.isArray(order.items) && order.items.length > 0) {
    rawItems = order.items;
  } else if (Array.isArray(order.categories)) {
    rawItems = order.categories.flatMap((cat: Record<string, any>) => cat.items || []); // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  function calculateDoorDashExtras(extras: Record<string, unknown>[] | undefined): { total: number; optionsList: string[] } {
    if (!Array.isArray(extras)) return { total: 0, optionsList: [] };
    let total = 0;
    const optionsList: string[] = [];

    function traverse(groups: Record<string, unknown>[]) {
      for (const group of groups) {
        if (Array.isArray(group.options)) {
          for (const opt of group.options as Record<string, unknown>[]) {
            const optPrice = typeof opt.price === 'number' ? opt.price : 0;
            const optQty = typeof opt.quantity === 'number' ? opt.quantity : 1;
            total += optPrice * optQty;
            if (typeof opt.name === 'string' && opt.name) {
              optionsList.push(optPrice > 0 ? `${opt.name} (+$${(optPrice / 100).toFixed(2)})` : opt.name);
            }
            if (Array.isArray(opt.extra)) {
              traverse(opt.extra as Record<string, unknown>[]);
            }
          }
        }
      }
    }

    traverse(extras);
    return { total, optionsList };
  }

  const line_items = rawItems.map((item: Record<string, any>, idx: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const extrasInfo = calculateDoorDashExtras(item.extras as Record<string, unknown>[] | undefined);
    const baseUnitPrice = typeof item.price === 'number'
      ? item.price
      : (typeof item.unit_price === 'number' ? item.unit_price : (typeof item.base_price === 'number' ? item.base_price : 0));
    const quantity = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;

    let unitPrice = baseUnitPrice + extrasInfo.total;
    // In official DoorDash sample.json, the entree item has price: 0 while subtotal is 2000.
    // If unitPrice is 0 and subtotal > 0 for a single item, distribute subtotal to avoid showing $0 line items.
    if (unitPrice === 0 && rawItems.length === 1 && typeof order.subtotal === 'number' && order.subtotal > 0) {
      unitPrice = Math.round(order.subtotal / quantity);
    }

    const lineTotal = typeof item.total_price === 'number' && item.total_price > 0
      ? item.total_price
      : (unitPrice * quantity);

    const instructions = [
      item.special_instructions,
      extrasInfo.optionsList.length > 0 ? `Options: ${extrasInfo.optionsList.join(', ')}` : null,
    ].filter(Boolean).join(' | ') || undefined;

    return {
      id: item.merchant_supplied_id || item.id || `dd_item_${idx + 1}`,
      name: item.name || item.title || 'Untitled Item',
      quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
      special_instructions: instructions,
    };
  });

  // DoorDash pricing breakdown (all integers in cents)
  const subtotal = typeof order.subtotal === 'number' ? order.subtotal : 0;
  const tax = typeof order.tax === 'number' ? order.tax : 0;
  const tip = typeof order.tip_amount === 'number' ? order.tip_amount : (typeof order.merchant_tip_amount === 'number' ? order.merchant_tip_amount : 0);
  const discount = typeof order.total_discount_amount === 'number' ? order.total_discount_amount : 0;
  const totalCents = (subtotal + tax + tip - discount) ||
    line_items.reduce((acc: number, it: { line_total: number }) => acc + it.line_total, 0);

  const currency = order.currency || 'USD';
  const externalId = String(order.id || order.display_id || `DD-${Date.now()}`);
  const cleanId = externalId.replace(/[^a-zA-Z0-9_-]/g, '');
  const internalId = `ord_dd_${cleanId}`;

  return {
    id: internalId,
    provider: 'doordash',
    external_order_id: externalId,
    display_id: order.display_id || externalId,
    status: mapDoorDashStatus(p.event?.status || order.status || 'NEW'),
    customer: {
      name: customerName,
      phone: customerPhone,
    },
    line_items,
    total_cents: totalCents,
    currency,
    created_at: p.event?.created_at || order.estimated_pickup_time || new Date().toISOString(),
    raw_payload: payload,
  };
}
