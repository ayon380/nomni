import { OrderProvider } from '../types';

/**
 * Detects the marketplace provider from raw payload structure alone.
 *
 * Requirements strictly honored:
 * 1. Does not require or add a 'provider' field to fixtures.
 * 2. Does not rely on provider query parameters.
 */
export function detectProvider(payload: Record<string, unknown>): OrderProvider | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const p = payload as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  // 1. Uber Eats Webhook Notification Fingerprint
  // Structure: { event_type: "orders.notification", meta: { resource_id: "..." }, resource_href: "..." }
  if (
    p.event_type === 'orders.notification' ||
    (p.meta && typeof p.meta.resource_id === 'string' && p.resource_href?.includes('uber.com'))
  ) {
    return 'uber_eats';
  }

  // Direct Uber Eats Order Payload Fingerprint (e.g. from GET /eats/order/ID)
  // Structure: { id: "...", current_state: "...", eater: { ... }, cart: { items: [...] } }
  if (
    p.current_state &&
    p.cart &&
    Array.isArray(p.cart.items) &&
    p.eater
  ) {
    return 'uber_eats';
  }

  // 2. DoorDash Marketplace Webhook Fingerprint
  // Structure: { event: { type: "OrderCreate", status: "NEW" }, order: { categories/items: [...], consumer: { ... } } }
  if (
    p.event?.type === 'OrderCreate' ||
    (p.order && (Array.isArray(p.order.items) || Array.isArray(p.order.categories)) && p.order.consumer) ||
    p.order?.experience === 'DOORDASH'
  ) {
    return 'doordash';
  }

  return null;
}
