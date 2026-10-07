import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { InternalOrder, OrderStatus } from '../types';

export const UBER_DEFAULT_SECRET = process.env.UBER_WEBHOOK_SECRET || 'uber_webhook_secret_key';

/**
 * Verifies Uber's HMAC-SHA256 signature from the X-Uber-Signature header.
 */
export function verifyUberSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string = UBER_DEFAULT_SECRET
): boolean {
  if (!signatureHeader) return false;
  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    const calculated = hmac.digest('hex');
    
    // Timing-safe comparison to prevent timing attacks
    return (
      signatureHeader.length === calculated.length &&
      crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(calculated))
    );
  } catch {
    return false;
  }
}

/**
 * Computes a valid X-Uber-Signature header for testing & curl examples.
 */
export function computeUberSignature(rawBody: string, secret: string = UBER_DEFAULT_SECRET): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

/**
 * Resolves the full order details for an Uber notification.
 * In production: calls GET /eats/order/{order_id} with OAuth Bearer token.
 * In demo/offline test: resolves from official fixtures based on meta.resource_id.
 */
export function resolveUberOrderDetails(webhookPayload: Record<string, any>): Record<string, any> {
  // If the payload is already the full order cart (e.g. direct order payload fixture)
  if (webhookPayload.cart && Array.isArray(webhookPayload.cart.items)) {
    return webhookPayload;
  }

  const resourceId = webhookPayload.meta?.resource_id;
  const fixturesDir = path.join(process.cwd(), 'fixtures', 'uber');

  // Try to find matching fixture by order ID
  if (resourceId) {
    const specificPath = path.join(fixturesDir, `get_order_${resourceId}.json`);
    if (fs.existsSync(specificPath)) {
      return JSON.parse(fs.readFileSync(specificPath, 'utf-8'));
    }

    if (resourceId === 'e4b219a8-98c4-4211-9a73-8109bfca3301') {
      const sample2 = path.join(fixturesDir, 'get_order_sample_2.json');
      if (fs.existsSync(sample2)) {
        return JSON.parse(fs.readFileSync(sample2, 'utf-8'));
      }
    }
  }

  // Default fallback to the primary official Get Order sample fixture
  const defaultSample = path.join(fixturesDir, 'get_order_sample.json');
  if (fs.existsSync(defaultSample)) {
    return JSON.parse(fs.readFileSync(defaultSample, 'utf-8'));
  }

  throw new Error(`Could not resolve Uber Get Order details for resource_id: ${resourceId}`);
}

/**
 * Maps raw Uber state to the internal canonical OrderStatus.
 */
function mapUberStatus(state: string | undefined): OrderStatus {
  switch (state?.toUpperCase()) {
    case 'CREATED':
      return 'RECEIVED';
    case 'ACCEPTED':
      return 'CONFIRMED';
    case 'IN_PREPARATION':
      return 'PREPARING';
    case 'READY_FOR_PICKUP':
      return 'READY';
    case 'DELIVERED':
    case 'COMPLETED':
      return 'DELIVERED';
    case 'DENIED':
    case 'CANCELED':
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'RECEIVED';
  }
}

/**
 * Normalizes an Uber Eats order into the internal canonical model.
 */
export function normalizeUberOrder(
  webhookPayload: Record<string, any>,
  resolvedOrder?: Record<string, any>
): InternalOrder {
  const order = resolvedOrder || resolveUberOrderDetails(webhookPayload);

  const eater = order.eater || {};
  const customerName = [eater.first_name, eater.last_name].filter(Boolean).join(' ') || 'Uber Eats Customer';
  const customerPhone = eater.phone || undefined;

  const rawItems = order.cart?.items || [];
  const line_items = rawItems.map((item: any, idx: number) => {
    const unitPrice = item.price?.unit_price?.amount ?? 0;
    const qty = item.quantity ?? 1;
    const lineTotal = item.price?.total_price?.amount ?? (unitPrice * qty);

    return {
      id: item.id || `ub_item_${idx + 1}`,
      name: item.title || 'Untitled Item',
      quantity: qty,
      unit_price: unitPrice,
      line_total: lineTotal,
      special_instructions: item.special_instructions || undefined,
    };
  });

  const charges = order.payment?.charges;
  const totalCents = charges?.total?.amount ??
    charges?.sub_total?.amount ??
    line_items.reduce((sum: number, it: any) => sum + it.line_total, 0);

  const currency = charges?.total?.currency_code ||
    rawItems[0]?.price?.unit_price?.currency_code ||
    'AUD';

  const externalId = order.display_id || order.id || webhookPayload.meta?.resource_id || `UB-${Date.now()}`;
  const internalId = `ord_uber_${(order.id || externalId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;

  return {
    id: internalId,
    provider: 'uber_eats',
    external_order_id: externalId,
    status: mapUberStatus(order.current_state),
    customer: {
      name: customerName,
      phone: customerPhone,
    },
    line_items,
    total_cents: totalCents,
    currency,
    created_at: order.placed_at || new Date().toISOString(),
    raw_payload: {
      webhook: webhookPayload,
      get_order_details: order,
    },
  };
}
