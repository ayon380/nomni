import { OrderProvider } from '../types';

/**
 * Detects the marketplace provider from raw payload structure alone.
 *
 * Requirements strictly honored:
 * 1. Does not require or add a 'provider' field to fixtures.
 * 2. Does not rely on provider query parameters.
 */
export function detectProvider(payload: Record<string, any>): OrderProvider | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  // 1. Uber Eats Webhook Notification Fingerprint
  // Structure: { event_type: "orders.notification", meta: { resource_id: "..." }, resource_href: "..." }
  if (
    payload.event_type === 'orders.notification' ||
    (payload.meta && typeof payload.meta.resource_id === 'string' && payload.resource_href?.includes('uber.com'))
  ) {
    return 'uber_eats';
  }

  // Direct Uber Eats Order Payload Fingerprint (e.g. from GET /eats/order/ID)
  // Structure: { id: "...", current_state: "...", eater: { ... }, cart: { items: [...] } }
  if (
    payload.current_state &&
    payload.cart &&
    Array.isArray(payload.cart.items) &&
    payload.eater
  ) {
    return 'uber_eats';
  }

  // 2. DoorDash Marketplace Webhook Fingerprint
  // Structure: { event: { type: "OrderCreate", status: "NEW" }, order: { id: "...", items: [...] } }
  if (
    payload.event?.type === 'OrderCreate' ||
    (payload.order && Array.isArray(payload.order.items) && payload.order.consumer)
  ) {
    return 'doordash';
  }

  return null;
}
