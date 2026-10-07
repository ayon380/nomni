# Nomni — Marketplace Order Unified System

A unified marketplace-order platform that ingests webhooks from **Uber Eats** and **DoorDash** into a canonical internal kitchen ticket, with an Apple-grade minimalist dark admin dashboard.

Built for **Nomni Kitchen OS**.

---

## 1. Quickstart & Run Instructions

### Prerequisites

- Node.js 18+ (tested on Node v26)
- npm 9+

### Installation & Run

```bash
# 1. Install dependencies
npm install

# 2. Run automated verification suite (tests detection, auth, normalization, upsert)
npx tsx scripts/verify.ts

# 3. Start development server (API + React Admin)
npm run dev
```

The application runs on **http://localhost:3000**:

- **React Admin UI**: `http://localhost:3000`
- **Single Ingest Webhook API**: `POST http://localhost:3000/api/webhooks`
- **Orders Query API**: `GET http://localhost:3000/api/orders`
- **Order Status Patch API**: `PATCH http://localhost:3000/api/orders/:id`

---

## 2. Working Curl Examples

Both curls target the single unified ingest endpoint: `POST http://localhost:3000/api/webhooks`.

### A. Uber Eats Webhook Ingestion

Uber Eats requires an HMAC-SHA256 signature in the `X-Uber-Signature` header computed from the raw request body using the webhook secret (default: `uber_webhook_secret_key`).

```bash
curl -i -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -H "X-Uber-Signature: 8ae3a0cfc778ece54a4691525e2965240c67826654ec41ad7616992c32ded45b" \
  --data-binary @fixtures/uber/sample_webhook.json
```

**Expected Response**:

- **HTTP Status**: `200 OK`
- **Body**: `{}` (Empty JSON object per official Uber documentation)
- **Headers**: `x-nomni-order-id: ord_uber_f9f363d1e1c2`, `x-nomni-upsert: true`

---

### B. DoorDash Marketplace Webhook Ingestion

DoorDash Marketplace requires an `Authorization: Bearer <DOORDASH_TOKEN>` header (default: `doordash_marketplace_token_2026`).

```bash
curl -i -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer doordash_marketplace_token_2026" \
  --data-binary @fixtures/doordash/sample.json
```

**Expected Response**:

- **HTTP Status**: `200 OK`
- **Body**: `{"order_id":"abc12345","status":"acknowledged"}`
- **Headers**: `x-nomni-order-id: ord_dd_abc12345`, `x-nomni-upsert: true`

---

## 3. Provider Field → Internal Field Mapping Table

The internal model is canonical and belongs to Nomni, decoupling internal operations from marketplace schema changes.

| Canonical Internal Field            | Uber Eats Source Field                        | DoorDash Marketplace Source Field                    | Notes                                |
| :---------------------------------- | :-------------------------------------------- | :--------------------------------------------------- | :----------------------------------- |
| `id`                                | Generated (`ord_uber_<id>`)                   | Generated (`ord_dd_<id>`)                            | Unique internal UUID/prefixed ID     |
| `provider`                          | Normalized `'uber_eats'`                      | Normalized `'doordash'`                              | Canonical provider discriminator     |
| `external_order_id`                 | `display_id` (fallback: `id`)                 | `order.display_id` (fallback: `order.id`)            | Display code seen by staff & dashers |
| `status`                            | `current_state` (e.g. `CREATED` → `RECEIVED`) | `event.status` / `order.status` (`NEW` → `RECEIVED`) | Normalized into internal lifecycle   |
| `customer.name`                     | `eater.first_name` (+ optional `last_name`)   | `order.consumer.first_name` + `last_name`            | Customer display name                |
| `customer.phone`                    | `eater.phone` / `eater.phone_number`          | `order.consumer.phone` / `phone_number`              | Customer contact / masked number     |
| `line_items[].name`                 | `cart.items[].title`                          | `order.categories[].items[].name` / `items[].name`   | Product name                         |
| `line_items[].quantity`             | `cart.items[].quantity`                       | `item.quantity`                                      | Count of units                       |
| `line_items[].unit_price`           | `cart.items[].price.unit_price.amount`        | `item.price`                                         | Integer in cents                     |
| `line_items[].line_total`           | `cart.items[].price.total_price.amount`       | `item.price * quantity`                              | Integer in cents                     |
| `line_items[].special_instructions` | `cart.items[].special_instructions`           | `item.special_instructions`                          | Modifiers / kitchen notes            |
| `total_cents`                       | `payment.charges.total.amount`                | `subtotal + tax + tip - discount`                    | Integer in cents                     |
| `currency`                          | `payment.charges.total.currency_code`         | `order.currency` (default `'USD'`)                   | ISO currency (`AUD`, `USD`)          |
| `created_at`                        | `placed_at`                                   | `estimated_pickup_time` / `event.created_at`         | ISO 8601 timestamp string            |
| `raw_payload`                       | `{ webhook, get_order_details }`              | Full webhook JSON payload                            | Stored for debugging & telemetry     |

---

## 4. Conflicts Log — "Verify, Don't Trust"

Every working note in the brief was audited against the authoritative official documentation:

| #      | Working Note in Brief                                                                                      | Verification Finding                                                                                                                                                                                 | Verdict                 | Authoritative Overruling Documentation                                                                                     |
| :----- | :--------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| **1**  | _Uber may include the full cart in the webhook; verify whether a Get Order call is still required._        | The `orders.notification` webhook delivers **only metadata** (`meta.resource_id`). It **does not** contain cart or line items. A `GET /eats/order/{id}` call is strictly required to fetch the cart. | **REJECTED / CHANGED**  | [Uber Eats orders.notification API Spec](https://developer.uber.com/docs/eats/references/api/webhooks.orders-notification) |
| **2**  | _DoorDash Marketplace line items may use a top-level `items[]`._                                           | In the official DoorDash Marketplace specification (`sample.json`), line items are nested under `order.categories[].items[]`, not top-level `items[]`. Top-level payloads only contain `event` and `order`. | **REJECTED / CHANGED**  | [DoorDash Order Integration Spec](https://developer.doordash.com/en-US/docs/marketplace/how_to/order_integration/)         |
| **3**  | _Verify which DoorDash monetary field should become total_cents and whether tax is included._            | DoorDash supplies integer cents for subtotal and tax (tax is not included in subtotal). tip_amount is optional (default 0 for DoorDash fulfillment). If discounts apply, total_discount_amount must be subtracted. Canonical total_cents is: subtotal + tax + (tip_amount \|\| 0) - (total_discount_amount \|\| 0). | **VERIFIED & REFINED** | DoorDash Marketplace Order API Specification / Pricing Schema                                                             |
| **4**  | _Verify Uber webhook signature generation and the `X-Uber-Signature` header._                              | Uber signs payloads using HMAC-SHA256 hex digest of the raw body using the app's `client_secret` in the `X-Uber-Signature` header.                                                                   | **VERIFIED AS CORRECT** | Uber Eats Webhook Security Documentation                                                                                   |
| **5**  | _Verify the exact Uber webhook response status/body._                                                      | The webhook receiver must respond with HTTP `200 OK` and an empty body (`{}`) immediately to avoid retries.                                                                                          | **VERIFIED AS CORRECT** | Uber Eats Webhook Acknowledgment Spec                                                                                      |
| **6**  | _DoorDash Drive webhooks are optional._                                                                    | DoorDash Drive is white-label fulfillment, whereas this integration handles DoorDash **Marketplace** orders (`OrderCreate`). Drive is completely out of scope.                                       | **VERIFIED AS CORRECT** | DoorDash Developer Portal Matrix                                                                                           |
| **7**  | _Verify whether Uber webhook `meta.resource_id` corresponds to the Get Order id in the official examples._ | `meta.resource_id` in `orders.notification` is precisely the UUID used in `GET /eats/order/{order_id}`.                                                                                              | **VERIFIED AS CORRECT** | [Uber Eats Get Order API v2](https://developer.uber.com/docs/eats/references/api/v2/get-eats-order-orderid)                |
| **8**  | _Do not rely on a provider query parameter for normal provider detection._                                 | Implemented zero-hint detection: detects provider purely by structural fingerprinting of the payload.                                                                                                | **VERIFIED AS CORRECT** | System Design Invariant                                                                                                    |
| **9**  | _Verify the documented location of DoorDash customer phone data._                                          | Located under `order.consumer.phone`, often masked for privacy.                                                                                                                                      | **VERIFIED AS CORRECT** | DoorDash Consumer Schema Spec                                                                                              |
| **10** | _Normalize marketplace statuses into the internal status model where appropriate._                         | Uber `CREATED` and DoorDash `NEW` map to canonical `RECEIVED`. Uber `ACCEPTED` and DoorDash `CONFIRMED` map to `CONFIRMED`.                                                                          | **VERIFIED AS CORRECT** | Nomni Canonical Domain Spec                                                                                                |

---

## 5. Architectural Highlights

1. **Zero-Hint Detection**: Payload routing contains zero hardcoded vendor query parameters. The engine analyzes event discriminators (`event_type === 'orders.notification'` vs `event.type === 'OrderCreate'`).
2. **Idempotent Upsert**: Guaranteed by composite indexing on `(provider, external_order_id)`. Re-delivered webhooks update the record in-place rather than generating duplicate kitchen tickets.
3. **Apple Minimalist UI**:
   - Deep obsidian canvas (`#09090b`) with translucent glassmorphic surfaces (`backdrop-blur-xl`) and Nomni violet accents (`#8b5cf6`).
   - Query string filter preservation (`?provider=...&status=...&search=...`) survives navigating to `/orders/:id` and clicking back.
   - Keyboard accessible: Navigating with tab and pressing **Enter** opens ticket details.
   - Raw cents and marketplace payloads are strictly sequestered inside a collapsible `<details>` debug accordion.
   - Fully responsive and tested at **1280px** (desktop kitchen terminal) and **390px** (iPhone).
