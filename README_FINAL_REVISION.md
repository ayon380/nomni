# Nomni Marketplace Webhook Ingestion — Final Revision Notes




## 1. Summary of Reviewer Gaps & Resolutions

| # | Reviewer Feedback | Root Cause | Resolution | Verification |
|---|-------------------|------------|------------|--------------|
| **1** | Different orders merged into one (`bbbbbbb1-…`, `bbbbbbb2-…`, `bbbbbbb3-…`); 8 orders saved only 1. | 1. Deduplication matched on `display_id` (not unique across orders).<br>2. Internal IDs truncated UUIDs to 12 chars (`ord_uber_bbbbbbb1eeee`).<br>3. JSON-file storage lacked atomic concurrency. | Migrated storage to **SQLite (`node:sqlite`)** with WAL mode. Keys deduplication strictly on `(provider, external_order_id)`. Retains full UUID for internal ID. Decoupled `display_id` for display only. | `scripts/verify.ts` Tests 43–53 (8 sequential distinct orders + 4 concurrent inserts). `scripts/test-uber-webhook.ts` Test 4b. |
| **2** | "+ Uber Webhook" simulator button failed silently with 502. | Simulator posted a full cart payload instead of an official `orders.notification` event. | Updated simulator to generate authentic `orders.notification` with `meta.resource_id` and HMAC-SHA256 signature in `X-Uber-Signature`. | Simulated live via `/api/simulate?provider=uber` returning HTTP 200 and generating unique order IDs. |
| **3** | Official fixture `sample_order.json` was edited; log row 7 claimed "Verified as correct". | `sample_order.json` had its ID modified to match `sample_webhook.json` instead of leaving published conflict intact. | Restored published samples unedited. Fixture parser strips doc trailing commas without mutating source files. Row 7 of `CHANGES.md` updated to **"CONFLICT / DISCREPANCY IDENTIFIED"**. | Verified unedited fixtures in `fixtures/uber/`. Test 1–3 in `verify.ts` pass with pristine files. |
| **4** | Mock endpoint was part of production app; default token in code. | `/v2/eats/order/[id]` served in all environments with hardcoded token fallback. | Extracted mock into standalone `uber-mock-api/` directory. Next.js route `/v2/eats/order/[id]` returns HTTP 404 in production. Client defaults to `https://api.uber.com` in production. | Tested mock 401/200 auth in `test-uber-webhook.ts`. Verified production route guard. |
| **5** | Client fell back to `localhost:3000` (fails if PORT differs); no fetch timeout. | Base URL resolution assumed port 3000; fetch calls hung indefinitely on network partition. | Dynamic host resolution from request `Host` header. Added `AbortSignal.timeout(5000)` mapping timeouts to 502 Bad Gateway. | Tests pass across dynamic ports. Timeout handling verified. |
| **6a** | DoorDash token compared with `===`, multiple formats, hardcoded fallback. | Insecure string comparison and hardcoded token allowed in production. | Implemented `crypto.timingSafeEqual` with strict `Bearer <token>` / `Basic` parsing. Rejects hardcoded fallback in production. | `verify.ts` Tests 8–11 (valid, invalid, missing, Basic auth). |
| **6b** | DoorDash extras not priced ($0 line items). | Option prices inside `extras` were ignored, and 0-priced entrees showed $0. | Added `calculateDoorDashExtras` to recursively aggregate option prices and fallback to order subtotal when base unit price is 0. | `verify.ts` Tests 26–27 ($23.00 calculated line totals). |
| **6c** | Raw error messages returned in responses. | Catch block leaked internal errors and stack traces. | Sanitized responses to standard `{ error: 'Bad Gateway' }` (502) or `{ error: 'Internal Server Error' }` (500). | HTTP tests verify sanitized status and responses. |

---

## 2. Architecture & Implementation Deep Dive

### 2.1 SQLite Engine & Concurrency Safety (`src/lib/store.ts`)

Previous JSON-file storage suffered from file-overwrite race conditions under concurrent requests. We migrated storage to SQLite using native Node.js `DatabaseSync` (`node:sqlite`), requiring zero native C++ compilation or external dependencies:

```sql
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  external_order_id TEXT NOT NULL,
  status TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  total_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  created_at TEXT NOT NULL,
  data TEXT NOT NULL,
  UNIQUE(provider, external_order_id)
);
CREATE INDEX IF NOT EXISTS idx_orders_provider_ext ON orders(provider, external_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
```

* **Write-Ahead Logging (WAL)**: Initialized with `PRAGMA journal_mode = WAL;` and `PRAGMA busy_timeout = 5000;`, enabling concurrent reads while writes are queued safely.
* **Separation of True ID vs. Display ID**:
  * `external_order_id`: The true UUID (`order.id` from Uber or `order.id` from DoorDash).
  * `display_id`: Short human-readable restaurant ticket badge (e.g. `BC953` or `DD-1042`).
  * `id`: Full clean internal ID: `ord_uber_${order.id.replace(/[^a-zA-Z0-9-]/g, '')}` (no truncation).
* **Deduplication Invariant**: Strict atomic upsert on `UNIQUE(provider, external_order_id)`. Retries update existing orders without duplicating rows or regressing staff statuses (`PREPARING`, `READY`, `DELIVERED`).

### 2.2 Standalone Uber Mock API (`uber-mock-api/`)

The Uber Eats Get Order mock is completely decoupled from the production application:

```
uber-mock-api/
├── index.ts        # Exports buildMockOrder and createMockServer
├── mock-order.ts   # Deterministic Uber Eats v2 order generator
└── server.ts       # Standalone HTTP mock server (port 3001 or UBER_MOCK_PORT)
```

1. **Complete Deletion from Main App**:
   The `src/app/v2` route has been deleted completely from the main Next.js application. The main web application serves zero mock endpoints.
2. **Standalone Mock Server (`uber-mock-api/server.ts`)**:
   Runs as an independent HTTP server on port 3001 (runnable via `npm run mock:uber`).
3. **Production Client Routing**:
   In `src/lib/uber/client.ts`, `resolveBaseUrl()` automatically routes to `https://api.uber.com` in production environments, and points to the standalone mock server (`http://localhost:3001`) in development.
3. **Runnable Independently**:
   Run `npm run mock:uber` to launch the standalone mock server on `http://localhost:3001`.

### 2.3 Resilient Fixture Ingestion & Conflict Documentation

* **Published Fixtures Preserved**:
  * `fixtures/uber/sample_order.json` retains its original published ID (`f9f363d1-e1c2-4595-b477-c649845bc953`) and documentation trailing commas.
  * `fixtures/uber/sample_webhook.json` retains its original published ID (`153dd7f1-339d-4619-940c-418943c14636`).
* **Resilient Ingestion**:
  A regex cleaner `raw.replace(/,(\s*[}\]])/g, '$1')` in `store.ts` handles trailing commas in memory without touching or reformatting the published fixture files.
* **Documented Invariant**:
  Row 7 in `CHANGES.md` documents that the official examples disagree. When an incoming webhook notification's `meta.resource_id` does not match the fetched order ID, the application halts storage and returns HTTP 502 so Uber retries.

### 2.4 Timing-Safe Auth & DoorDash Extras Pricing

* **DoorDash Auth**:
  ```ts
  const bufReceived = Buffer.from(token);
  const bufExpected = Buffer.from(expectedToken);
  if (bufReceived.length !== bufExpected.length || !crypto.timingSafeEqual(bufReceived, bufExpected)) {
    return false;
  }
  ```
* **Extras & Options Pricing**:
  Recursive helper `calculateDoorDashExtras` traverses nested option groups, sums modifier amounts, formats selected options into `special_instructions`, and falls back to distributing order subtotal if base item unit price is published as 0.

---
