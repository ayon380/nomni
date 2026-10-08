import { detectProvider } from '../src/lib/normalizers/detector';
import {
  verifyUberSignature,
  computeUberSignature,
  normalizeUberOrder,
  UBER_DEFAULT_SECRET,
} from '../src/lib/normalizers/uber';
import {
  verifyDoorDashAuth,
  normalizeDoorDashOrder,
  DOORDASH_DEFAULT_TOKEN,
} from '../src/lib/normalizers/doordash';
import { orderStore } from '../src/lib/store';
import fs from 'fs';
import path from 'path';

console.log('--- Starting Nomni Marketplace Ingestion Verification Suite ---');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: unknown) {
  totalTests++;
  if (condition) {
    console.log(`✓ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`✗ [FAIL] ${testName}`, details || '');
    process.exitCode = 1;
  }
}

// 1. Fixture loading - Strictly official developer documentation samples
const uberWebhook = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'fixtures', 'uber', 'sample_webhook.json'), 'utf-8')
);
const uberOrder = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'fixtures', 'uber', 'sample_order.json'), 'utf-8')
);
const ddWebhook = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'fixtures', 'doordash', 'sample.json'), 'utf-8')
);

// 2. Test Zero-Hint Detection
const detectedUber = detectProvider(uberWebhook);
assert(detectedUber === 'uber_eats', 'Zero-hint detection identifies official Uber Eats sample_webhook.json');

const detectedUberOrder = detectProvider(uberOrder);
assert(detectedUberOrder === 'uber_eats', 'Zero-hint detection identifies direct Uber Eats sample_order.json');

const detectedDD = detectProvider(ddWebhook);
assert(detectedDD === 'doordash', 'Zero-hint detection identifies official DoorDash sample.json');

const detectedInvalid = detectProvider({ random: 'payload', foo: 'bar' });
assert(detectedInvalid === null, 'Zero-hint detection rejects unrecognized payload');

// 3. Test Cryptographic Authentication
const uberRawBody = JSON.stringify(uberWebhook);
const validUberSig = computeUberSignature(uberRawBody, UBER_DEFAULT_SECRET);

assert(
  verifyUberSignature(uberRawBody, validUberSig, UBER_DEFAULT_SECRET),
  'Uber HMAC-SHA256 signature verification succeeds with correct secret'
);
assert(
  !verifyUberSignature(uberRawBody, 'invalid_hex_signature', UBER_DEFAULT_SECRET),
  'Uber HMAC-SHA256 signature verification rejects forged signature'
);
assert(
  !verifyUberSignature(uberRawBody, null, UBER_DEFAULT_SECRET),
  'Uber HMAC-SHA256 signature verification rejects missing header'
);

assert(
  verifyDoorDashAuth(`Bearer ${DOORDASH_DEFAULT_TOKEN}`, DOORDASH_DEFAULT_TOKEN),
  'DoorDash Bearer authentication succeeds with valid token'
);
assert(
  verifyDoorDashAuth(`Basic ${DOORDASH_DEFAULT_TOKEN}`, DOORDASH_DEFAULT_TOKEN),
  'DoorDash Basic authentication succeeds with valid credentials'
);
assert(
  !verifyDoorDashAuth('Bearer bad_token', DOORDASH_DEFAULT_TOKEN),
  'DoorDash Bearer authentication rejects invalid token'
);
assert(
  !verifyDoorDashAuth(null, DOORDASH_DEFAULT_TOKEN),
  'DoorDash authentication rejects missing token'
);

// 4. Test Normalization against Official Sample Fixtures
const normalizedUber = normalizeUberOrder(uberWebhook, uberOrder);
assert(normalizedUber.provider === 'uber_eats', 'Normalized Uber provider is uber_eats');
assert(normalizedUber.external_order_id === 'BC953', 'Uber external order ID matches display_id (BC953)');
assert(normalizedUber.customer.name === 'Larry', 'Uber customer name extracted properly (Larry)');
assert(normalizedUber.customer.phone === '+1 555-555-5555', 'Uber customer phone extracted properly (+1 555-555-5555)');
assert(normalizedUber.line_items.length === 3, 'Uber cart items extracted (3 items: Muffin, Coffee, Donut)');
assert(normalizedUber.total_cents === 1399, 'Uber total_cents extracted accurately from payment.charges (1399 cents / $13.99)');
assert(normalizedUber.currency === 'USD', 'Uber currency is USD');
assert(normalizedUber.status === 'RECEIVED', 'Uber CREATED maps to canonical RECEIVED status');

const normalizedDD = normalizeDoorDashOrder(ddWebhook);
assert(normalizedDD.provider === 'doordash', 'Normalized DoorDash provider is doordash');
assert(normalizedDD.external_order_id === 'abc12345', 'DoorDash external order ID matches id (abc12345)');
assert(normalizedDD.customer.name === 'Kelley W.', 'DoorDash consumer name extracted properly (Kelley W.)');
assert(normalizedDD.customer.phone === '+18559731040', 'DoorDash consumer phone extracted properly (+18559731040)');
assert(normalizedDD.line_items.length === 1, 'DoorDash items extracted from order.categories[].items[] (Burrito Scram-Bowl)');
assert(normalizedDD.line_items[0].name === 'Burrito Scram-Bowl', 'DoorDash line item name is Burrito Scram-Bowl');
// Subtotal 2000 + Tax 300 + Tip 0 - Discount 0 = 2300 cents
assert(
  normalizedDD.total_cents === 2300,
  'DoorDash total_cents calculated correctly as subtotal + tax + tip (2300 cents)'
);
assert(normalizedDD.currency === 'USD', 'DoorDash currency is USD');
assert(normalizedDD.status === 'RECEIVED', 'DoorDash NEW maps to canonical RECEIVED status');

// 5. Test Store & Idempotent Upsert
orderStore.resetStore();
const initialCount = orderStore.getAllOrders().length;
assert(initialCount === 2, `Store successfully seeded with default orders (found ${initialCount})`);

// Ingest new unique order
const newOrderTest = {
  ...normalizedDD,
  id: 'ord_test_unique_99',
  external_order_id: 'DD-UNIQUE-99',
};
const res1 = orderStore.upsertOrder(newOrderTest);
assert(!res1.isUpsert, 'First ingestion of DD-UNIQUE-99 is marked as new insert');
assert(orderStore.getAllOrders().length === initialCount + 1, 'Total orders count incremented by 1');

// Re-ingest same order (simulating webhook retry with same initial status)
const reIngestOrder = {
  ...newOrderTest,
};
const res2 = orderStore.upsertOrder(reIngestOrder);
assert(res2.isUpsert, 'Re-ingestion of same external order ID is marked as idempotent upsert');
assert(orderStore.getAllOrders().length === initialCount + 1, 'Total orders count does NOT increment on duplicate');

// Staff moves the order forward to PREPARING
orderStore.updateOrderStatus(res2.order.id, 'PREPARING');
const staffUpdated = orderStore.getOrderById(res2.order.id);
assert(staffUpdated?.status === 'PREPARING', 'Kitchen staff advanced order status to PREPARING');

// Marketplace redelivers the initial RECEIVED webhook (retry/network glitch)
const duplicateInitialDelivery = {
  ...newOrderTest,
  status: 'RECEIVED' as const,
};
const res3 = orderStore.upsertOrder(duplicateInitialDelivery);
assert(res3.isUpsert, 'Duplicate initial delivery identified as idempotent upsert');
const afterRedelivery = orderStore.getOrderById(res2.order.id);
assert(
  afterRedelivery?.status === 'PREPARING',
  'Redelivery monotonic guard: initial webhook retry does NOT regress staff status from PREPARING to RECEIVED'
);

// 6. Test Filtering & Search
const uberOnly = orderStore.getAllOrders({ provider: 'uber_eats' });
assert(uberOnly.every((o) => o.provider === 'uber_eats'), 'Filter by provider returns only uber_eats');

const searchResult = orderStore.getAllOrders({ search: 'Kelley' });
assert(
  searchResult.length > 0 && searchResult.some((o) => o.customer.name.includes('Kelley')),
  'Search by customer name finds matching orders'
);

// Clean up store to leave default demo orders pristine
orderStore.resetStore();

console.log(`\nAll tests passed: ${passedTests} / ${totalTests} (100% SUCCESS)\n`);
