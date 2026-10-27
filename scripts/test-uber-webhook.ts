/**
 * scripts/test-uber-webhook.ts
 *
 * HTTP integration test suite for the Uber Eats webhook flow.
 * Requires the dev server to be running: `npm run dev`
 *
 * Usage:
 *   npx tsx scripts/test-uber-webhook.ts
 *   PORT=3001 npx tsx scripts/test-uber-webhook.ts
 *
 * What it tests
 * -------------
 * 1. Mock GET /v2/eats/order/{id} with valid token → 200, X-Nomni-Mock: true
 * 2. Mock GET without token → 401
 * 3. Two different resource_ids → two different order shapes
 * 4. Webhook with valid signature → 200, X-Nomni-Order-Id set
 * 5. Two different notifications → two different stored orders
 * 6. Idempotent retry of same resource_id → same order, X-Nomni-Upsert: true
 * 7. Missing signature → 401
 * 8. Forged signature → 401
 * 9. Webhook missing meta.resource_id → 502 (Uber retries)
 * 10. Unknown payload → 400
 */

import crypto from 'crypto';
import { createMockServer } from '../uber-mock-api/server';

const BASE = `http://localhost:${process.env.PORT ?? 3000}`;
const MOCK_PORT = Number(process.env.UBER_MOCK_PORT) || 3001;
const MOCK_BASE = `http://localhost:${MOCK_PORT}`;
const SECRET = process.env.UBER_WEBHOOK_SECRET || 'uber_webhook_secret_key';
const API_TOKEN = process.env.UBER_API_TOKEN || 'uber_mock_dev_token';

let passed = 0;
let failed = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hmac(body: string): string {
  return crypto.createHmac('sha256', SECRET).update(body).digest('hex');
}

function makeWebhook(resourceId: string) {
  return {
    event_type: 'orders.notification',
    event_id: crypto.randomUUID(),
    event_time: Math.floor(Date.now() / 1000),
    meta: {
      resource_id: resourceId,
      status: 'pos',
      user_id: crypto.randomUUID(),
    },
    resource_href: `https://api.uber.com/v2/eats/order/${resourceId}`,
  };
}


async function check(
  label: string,
  fn: () => Promise<void>
): Promise<void> {
  try {
    await fn();
    console.log(`✓ [PASS] ${label}`);
    passed++;
  } catch (err) {
    console.error(`✗ [FAIL] ${label}:`, (err as Error).message);
    failed++;
  }
}

function expect(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

async function runTests() {
  console.log(`\n=== Uber Eats Webhook HTTP Tests (${BASE}) & Mock (${MOCK_BASE}) ===\n`);

  // Ensure standalone mock server is active on MOCK_PORT
  let mockServer: ReturnType<typeof createMockServer> | null = null;
  try {
    mockServer = createMockServer();
    await new Promise<void>((resolve) => {
      mockServer!.listen(MOCK_PORT, () => resolve());
      mockServer!.on('error', (err: Error & { code?: string }) => {
        if (err.code === 'EADDRINUSE') {
          mockServer = null;
          resolve();
        }
      });
    });
  } catch {
    mockServer = null;
  }

  try {
    // ── 1. Mock route requires auth ──────────────────────────────────────────
    await check('GET /v2/eats/order/{id} without token returns 401', async () => {
      const id = '153dd7f1-339d-4619-940c-418943c14636';
      const res = await fetch(`${MOCK_BASE}/v2/eats/order/${id}`);
      expect(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await check('GET /v2/eats/order/{id} with wrong token returns 401', async () => {
      const id = '153dd7f1-339d-4619-940c-418943c14636';
      const res = await fetch(`${MOCK_BASE}/v2/eats/order/${id}`, {
        headers: { Authorization: 'Bearer wrong_token' },
      });
      expect(res.status === 401, `Expected 401, got ${res.status}`);
    });

    // ── 2. Mock route returns valid order with correct token ─────────────────
    await check('GET /v2/eats/order/{id} with valid token returns 200 + X-Nomni-Mock', async () => {
      const id = '153dd7f1-339d-4619-940c-418943c14636';
      const res = await fetch(`${MOCK_BASE}/v2/eats/order/${id}`, {
        headers: { Authorization: `Bearer ${API_TOKEN}` },
      });
      expect(res.status === 200, `Expected 200, got ${res.status}`);
      expect(res.headers.get('x-nomni-mock') === 'true', 'Expected X-Nomni-Mock: true');
      const body = await res.json() as Record<string, unknown>;
      expect(body.id === id, `Order id should match (${id})`);
      expect(body.current_state === 'CREATED', 'current_state should be CREATED');
      expect(typeof (body as Record<string, unknown>).cart === 'object', 'Response should have cart');
    });

    // ── 3. Two different resource_ids → different orders ────────────────────
    await check('Two different resource_ids return two different orders from mock', async () => {
      const id1 = 'aaaaaaaa-0000-4000-8000-000000000001';
      const id2 = 'bbbbbbbb-0000-4000-8000-000000000002';
      const auth = { Authorization: `Bearer ${API_TOKEN}` };
      const [r1, r2] = await Promise.all([
        fetch(`${MOCK_BASE}/v2/eats/order/${id1}`, { headers: auth }).then(r => r.json()) as Promise<Record<string, unknown>>,
        fetch(`${MOCK_BASE}/v2/eats/order/${id2}`, { headers: auth }).then(r => r.json()) as Promise<Record<string, unknown>>,
      ]);
      expect(r1.id === id1, `Order 1 id should be ${id1}`);
      expect(r2.id === id2, `Order 2 id should be ${id2}`);
      expect(r1.display_id !== r2.display_id, 'display_id should differ between orders');
    });

  // ── 3. Valid signed webhook → 200 ───────────────────────────────────────
  const resourceId1 = crypto.randomUUID();
  const wh1 = makeWebhook(resourceId1);
  const wh1Str = JSON.stringify(wh1);
  let orderId1: string | null = null;

  await check('Valid signed webhook returns 200 and X-Nomni-Order-Id', async () => {
    const sig = hmac(wh1Str);
    const res = await fetch(`${BASE}/api/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-uber-signature': sig },
      body: wh1Str,
    });
    expect(res.status === 200, `Expected 200, got ${res.status}: ${await res.text()}`);
    orderId1 = res.headers.get('x-nomni-order-id');
    expect(!!orderId1, 'X-Nomni-Order-Id header should be set');
  });

  // ── 4. Different resource_id → different internal order ─────────────────
  const resourceId2 = crypto.randomUUID();
  const wh2 = makeWebhook(resourceId2);
  const wh2Str = JSON.stringify(wh2);
  let orderId2: string | null = null;

  await check('Different resource_id creates a distinct order', async () => {
    const sig = hmac(wh2Str);
    const res = await fetch(`${BASE}/api/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-uber-signature': sig },
      body: wh2Str,
    });
    expect(res.status === 200, `Expected 200, got ${res.status}: ${await res.text()}`);
    orderId2 = res.headers.get('x-nomni-order-id');
    expect(!!orderId2, 'X-Nomni-Order-Id header should be set');
    expect(orderId1 !== orderId2, `Two notifications must produce two different orders (got ${orderId1} vs ${orderId2})`);
    expect(res.headers.get('x-nomni-upsert') !== 'true', 'Second notification should be a new insert, not an upsert');
  });

  // ── 4b. Three notifications with similar prefix (bbbbbbb1, bbbbbbb2, bbbbbbb3) ──
  await check('Three notifications with similar prefix save as three distinct orders', async () => {
    const runSuffix = Date.now().toString().slice(-4);
    const ids = [
      `bbbbbbb1-eeee-4000-8000-00000000${runSuffix}1`,
      `bbbbbbb2-eeee-4000-8000-00000000${runSuffix}2`,
      `bbbbbbb3-eeee-4000-8000-00000000${runSuffix}3`,
    ];
    const orderIds: string[] = [];

    for (const rid of ids) {
      const wh = makeWebhook(rid);
      const str = JSON.stringify(wh);
      const sig = hmac(str);
      const res = await fetch(`${BASE}/api/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-uber-signature': sig },
        body: str,
      });
      expect(res.status === 200, `Expected 200, got ${res.status}`);
      const oid = res.headers.get('x-nomni-order-id');
      expect(!!oid, 'Order ID must be returned');
      expect(res.headers.get('x-nomni-upsert') !== 'true', `Order ${rid} should be new insert`);
      orderIds.push(oid!);
    }

    const uniqueSet = new Set(orderIds);
    expect(uniqueSet.size === 3, `Expected 3 distinct internal order IDs, got ${uniqueSet.size}: ${orderIds.join(', ')}`);
  });

  // ── 5. Idempotent retry same resource_id → same order, upsert ───────────
  await check('Retry of same resource_id is idempotent (upsert)', async () => {
    const sig = hmac(wh1Str);
    const res = await fetch(`${BASE}/api/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-uber-signature': sig },
      body: wh1Str,
    });
    expect(res.status === 200, `Expected 200, got ${res.status}`);
    const retryOrderId = res.headers.get('x-nomni-order-id');
    expect(retryOrderId === orderId1, `Retry should return same order id (${orderId1}), got ${retryOrderId}`);
    expect(res.headers.get('x-nomni-upsert') === 'true', 'Retry should be flagged as upsert');
  });

  // ── 6. Missing signature → 401 ───────────────────────────────────────────
  await check('Webhook without X-Uber-Signature returns 401', async () => {
    const res = await fetch(`${BASE}/api/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: wh1Str,
    });
    expect(res.status === 401, `Expected 401, got ${res.status}`);
  });

  // ── 7. Forged signature → 401 ─────────────────────────────────────────────
  await check('Webhook with forged X-Uber-Signature returns 401', async () => {
    const res = await fetch(`${BASE}/api/webhooks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-uber-signature': 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      },
      body: wh1Str,
    });
    expect(res.status === 401, `Expected 401, got ${res.status}`);
  });

  // ── 8. Missing meta.resource_id → 502 ────────────────────────────────────
  await check('Webhook missing meta.resource_id returns 502 (Uber should retry)', async () => {
    const badPayload = {
      event_type: 'orders.notification',
      event_id: crypto.randomUUID(),
      event_time: Math.floor(Date.now() / 1000),
      meta: { status: 'pos' }, // no resource_id
    };
    const badStr = JSON.stringify(badPayload);
    const sig = hmac(badStr);
    const res = await fetch(`${BASE}/api/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-uber-signature': sig },
      body: badStr,
    });
    expect(res.status === 502, `Expected 502, got ${res.status}`);
  });

  // ── 9. Unknown payload → 400 ─────────────────────────────────────────────
  await check('Unknown payload structure returns 400', async () => {
    const unknown = { foo: 'bar', random: 123 };
    const unknownStr = JSON.stringify(unknown);
    const sig = hmac(unknownStr);
    const res = await fetch(`${BASE}/api/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-uber-signature': sig },
      body: unknownStr,
    });
    expect(res.status === 400, `Expected 400, got ${res.status}`);
  });
  } finally {
    if (mockServer) {
      try {
        if (typeof (mockServer as unknown as { closeAllConnections: () => void }).closeAllConnections === 'function') {
          (mockServer as unknown as { closeAllConnections: () => void }).closeAllConnections();
        }
        mockServer.close();
      } catch {}
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
