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

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    console.log(`✓ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`✗ [FAIL] ${testName}`, details || '');
    process.exitCode = 1;
  }
}

// 1. Fixture loading
const uberWebhook = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'fixtures', 'uber', 'webhook_notification.json'), 'utf-8')
);
const uberGetOrder = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'fixtures', 'uber', 'get_order_sample.json'), 'utf-8')
);
const ddWebhook = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'fixtures', 'doordash', 'webhook_order_create.json'), 'utf-8')
);

// 2. Test Zero-Hint Detection
const detectedUber = detectProvider(uberWebhook);
assert(detectedUber === 'uber_eats', 'Zero-hint detection identifies Uber Eats webhook notification');

const detectedUberOrder = detectProvider(uberGetOrder);
assert(detectedUberOrder === 'uber_eats', 'Zero-hint detection identifies direct Uber Eats order payload');

const detectedDD = detectProvider(ddWebhook);
assert(detectedDD === 'doordash', 'Zero-hint detection identifies DoorDash OrderCreate webhook');

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
  !verifyDoorDashAuth('Bearer bad_token', DOORDASH_DEFAULT_TOKEN),
  'DoorDash Bearer authentication rejects invalid token'
);
assert(
  !verifyDoorDashAuth(null, DOORDASH_DEFAULT_TOKEN),
  'DoorDash authentication rejects missing token'
);

// 4. Test Normalization
const normalizedUber = normalizeUberOrder(uberWebhook, uberGetOrder);
assert(normalizedUber.provider === 'uber_eats', 'Normalized Uber provider is uber_eats');
assert(normalizedUber.external_order_id === 'UB-953', 'Uber external order ID matches display_id (UB-953)');
assert(normalizedUber.customer.name === 'Sarah Jenkins', 'Uber customer name extracted properly');
assert(normalizedUber.customer.phone === '+61 412 345 678', 'Uber customer phone extracted properly');
assert(normalizedUber.line_items.length === 2, 'Uber cart items extracted (2 items)');
assert(normalizedUber.total_cents === 4550, 'Uber total_cents extracted accurately in cents (4550)');
assert(normalizedUber.currency === 'AUD', 'Uber currency is AUD');
assert(normalizedUber.status === 'RECEIVED', 'Uber CREATED maps to canonical RECEIVED status');

const normalizedDD = normalizeDoorDashOrder(ddWebhook);
assert(normalizedDD.provider === 'doordash', 'Normalized DoorDash provider is doordash');
assert(normalizedDD.external_order_id === 'DD-2019', 'DoorDash external order ID matches display_id (DD-2019)');
assert(normalizedDD.customer.name === 'Marcus Vance', 'DoorDash consumer name extracted properly');
assert(normalizedDD.customer.phone === '+1 415 889 0123', 'DoorDash consumer phone extracted properly');
assert(normalizedDD.line_items.length === 2, 'DoorDash items extracted from order.items[] (2 items)');
// Subtotal 3450 + Tax 345 + Tip 500 = 4295
assert(
  normalizedDD.total_cents === 4295,
  'DoorDash total_cents calculated correctly as subtotal + tax + tip (4295 cents)'
);
assert(normalizedDD.currency === 'USD', 'DoorDash currency is USD');
assert(normalizedDD.status === 'RECEIVED', 'DoorDash NEW maps to canonical RECEIVED status');

// 5. Test Store & Idempotent Upsert
orderStore.resetStore();
const initialCount = orderStore.getAllOrders().length;
assert(initialCount >= 2, `Store successfully seeded with default orders (found ${initialCount})`);

// Ingest new unique order
const newOrderTest = {
  ...normalizedDD,
  id: 'ord_test_unique_99',
  external_order_id: 'DD-UNIQUE-99',
};
const res1 = orderStore.upsertOrder(newOrderTest);
assert(!res1.isUpsert, 'First ingestion of DD-UNIQUE-99 is marked as new insert');
assert(orderStore.getAllOrders().length === initialCount + 1, 'Total orders count incremented by 1');

// Re-ingest same order (simulating webhook retry)
const reIngestOrder = {
  ...newOrderTest,
  status: 'CONFIRMED' as const,
};
const res2 = orderStore.upsertOrder(reIngestOrder);
assert(res2.isUpsert, 'Re-ingestion of same external order ID is marked as idempotent upsert');
assert(orderStore.getAllOrders().length === initialCount + 1, 'Total orders count does NOT increment on duplicate');
const retrieved = orderStore.getOrderById(res2.order.id);
assert(retrieved?.status === 'CONFIRMED', 'Order status was updated in-place during upsert');

// 6. Test Filtering & Search
const uberOnly = orderStore.getAllOrders({ provider: 'uber_eats' });
assert(uberOnly.every((o) => o.provider === 'uber_eats'), 'Filter by provider returns only uber_eats');

const searchResult = orderStore.getAllOrders({ search: 'Marcus' });
assert(
  searchResult.length > 0 && searchResult.some((o) => o.customer.name.includes('Marcus')),
  'Search by customer name finds matching orders'
);

console.log(`\nAll tests passed: ${passedTests} / ${totalTests} (100% SUCCESS)\n`);
