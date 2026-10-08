# Nomni — Marketplace Order Unified System

A unified marketplace-order platform that ingests webhooks from **Uber Eats** and **DoorDash** into a canonical internal kitchen ticket dashboard.

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
- **Body**: Empty response body (0 bytes per official Uber Eats documentation)
- **Headers**: `x-nomni-order-id: ord_uber_f9f363d1e1c2`, `x-nomni-upsert: true`

---

### B. DoorDash Marketplace Webhook Ingestion

DoorDash Marketplace authenticates webhooks via integrator-configured credentials (supporting `Authorization: Bearer <TOKEN>` or `Basic <TOKEN>`, default: `doordash_marketplace_token_2026`).

```bash
curl -i -X POST http://localhost:3000/api/webhooks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer doordash_marketplace_token_2026" \
  --data-binary @fixtures/doordash/sample.json
```

**Expected Response**:

- **HTTP Status**: `200 OK`
- **Body**: Empty response body (0 bytes; acknowledges receipt and prevents automated retries; response body is unspecified in public documentation)
- **Headers**: `x-nomni-order-id: ord_dd_abc12345`, `x-nomni-upsert: true`

---

## 3. Provider Field → Internal Field Mapping Table

The internal model is canonical and belongs to Nomni, decoupling internal operations from marketplace schema changes.

| Canonical Internal Field            | Uber Eats Source Field (`sample_order.json`)  | DoorDash Marketplace Source Field (`sample.json`) | Sample Example Values                   | Notes                                                |
| :---------------------------------- | :-------------------------------------------- | :------------------------------------------------- | :-------------------------------------- | :--------------------------------------------------- |
| `id`                                | `ord_uber_` + `order.id.slice(0, 12)`         | `ord_dd_` + `order.id`                             | `ord_uber_f9f363d1e1c2`, `ord_dd_abc12345` | Unique internal prefixed ID                         |
| `provider`                          | Normalized `'uber_eats'`                      | Normalized `'doordash'`                            | `'uber_eats'`, `'doordash'`             | Canonical provider discriminator                     |
| `external_order_id`                 | `display_id` (fallback: `id`)                 | `order.id` (fallback: `order.display_id`)          | `'BC953'`, `'abc12345'`                 | Display code seen by staff & delivery couriers       |
| `status`                            | `current_state` (`CREATED` → `RECEIVED`)      | `event.status` (`NEW` → `RECEIVED`)                | `'RECEIVED'`                            | Normalized into Nomni internal lifecycle             |
| `customer.name`                     | `eater.first_name` (+ optional `last_name`)   | `order.consumer.first_name` + `last_name`          | `'Larry'`, `'Kelley W.'`                | Customer display name (supports single-name eaters)  |
| `customer.phone`                    | `eater.phone`                                 | `order.consumer.phone`                             | `'+1 555-555-5555'`, `'+18559731040'`   | Customer contact phone                               |
| `line_items[].name`                 | `cart.items[].title`                          | `order.categories[].items[].name`                  | `'Fresh-baked muffin'`, `'Burrito Scram-Bowl'` | Product item name                                 |
| `line_items[].quantity`             | `cart.items[].quantity`                       | `item.quantity`                                    | `1`, `2`                                | Item unit count                                      |
| `line_items[].unit_price`           | `cart.items[].price.unit_price.amount`        | `item.price`                                       | `350` ($3.50), `0`                      | Integer in cents                                     |
| `line_items[].line_total`           | `cart.items[].price.total_price.amount`       | `item.price * item.quantity`                       | `350`, `0`                              | Integer in cents                                     |
| `line_items[].special_instructions` | `cart.items[].special_instructions`           | `item.special_instructions`                        | `'make it iced please'`                 | Kitchen prep instructions                            |
| `total_cents`                       | `payment.charges.total.amount`                | `subtotal + tax + tip - discount`                  | `1399` ($13.99), `2300` ($23.00)        | Total amount in integer cents                        |
| `currency`                          | `payment.charges.total.currency_code`         | `order.currency` (default `'USD'`)                 | `'USD'`                                 | ISO 4217 currency code                               |
| `created_at`                        | `placed_at`                                   | `order.estimated_pickup_time`                      | `'2019-05-14T15:16:54-05:00'`           | ISO 8601 timestamp string                            |
| `raw_payload`                       | `{ webhook, get_order_details }`              | Full webhook JSON payload                          | Complete JSON payload                   | Sequestered in expandable UI debug accordion         |

---

## 4. Conflicts Log — "Verify, Don't Trust"

Every working note in the brief was audited against the authoritative official documentation:

| #      | Working Note in Brief                                                                                      | Verification Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Verdict                                         | Authoritative Overruling Documentation                                                                                                                                                                                                                                                                                                                                                                                                        |
| :----- | :--------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**  | _Uber may include the full cart in the webhook; verify whether a Get Order call is still required._        | The `orders.notification` webhook delivers event metadata including `meta.resource_id` and `resource_href`; it does **not** contain the cart or line items. The full order, including cart data, must be retrieved using the referenced Get Order endpoint.                                                                                                                                                                                                                                                                  | **REJECTED / CHANGED**                          | [Uber Eats `orders.notification` API](https://developer.uber.com/docs/eats/references/api/webhooks.orders-notification) — **“Webhook Event Structure”**, **“Example Webhook”**; [Uber Eats Get Order API v2](https://developer.uber.com/docs/eats/references/api/v2/get-eats-order-orderid) — **“Response Body - Order”**                                                                                                                     |
| **2**  | _DoorDash Marketplace line items may use a top-level `items[]`._                                           | In the official DoorDash Marketplace Order schema, line items are nested under `order.categories[].items[]`. The webhook envelope contains the top-level `event` and `order` objects; there is no documented top-level `order.items[]` field.                                                                                                                                                                                                                                                                                | **REJECTED / CHANGED**                          | [DoorDash Marketplace API Specification](https://developer.doordash.com/en-US/api/marketplace/#tag/Models/Order) — **“Order”** schema, specifically **`categories` → `items`**; [DoorDash Order Integration](https://developer.doordash.com/en-US/docs/marketplace/how_to/order_integration/) — **“Receiving Orders from DoorDash”**                                                                                                          |
| **3**  | _Verify which DoorDash monetary field should become `total_cents` and whether tax is included._            | DoorDash documents `subtotal` and `tax` as separate integer monetary fields. `tax` is therefore not represented as part of the documented `subtotal`. The Marketplace Order schema also documents `merchant_tip_amount` and `tip_amount`; `tip_amount` is specifically the delivery tip for Self Delivery orders. The current official schema does **not** document a `total_cents` or `total_discount_amount` field/formula. Therefore, the previous formula should not be represented as an official DoorDash calculation. | **VERIFIED & REFINED**                          | [DoorDash Marketplace API Specification](https://developer.doordash.com/en-US/api/marketplace/#tag/Models/Order) — **“Order”** schema, specifically **`subtotal`**, **`tax`**, **`merchant_tip_amount`**, and **`tip_amount`** fields                                                                                                                                                                                                         |
| **4**  | _Verify Uber webhook signature generation and the `X-Uber-Signature` header._                              | Uber signs the raw webhook request body using HMAC-SHA256 with the application's `client_secret`. The resulting hexadecimal digest is supplied in the `X-Uber-Signature` header.                                                                                                                                                                                                                                                                                                                                             | **VERIFIED AS CORRECT**                         | [Uber Eats Webhooks](https://developer.uber.com/docs/eats/guides/webhooks) — **“Webhook Security”**                                                                                                                                                                                                                                                                                                                                           |
| **5**  | _Verify the exact Uber webhook response status/body._                                                      | The webhook receiver must acknowledge the notification with HTTP `200 OK` and an **empty response body**. Therefore, the previous wording should not describe the response body as `{}`; `{}` is a JSON object rather than an empty body.                                                                                                                                                                                                                                                                                    | **VERIFIED / WORDING CORRECTED**                | [Uber Eats Webhooks](https://developer.uber.com/docs/eats/references/api/order_suite#tag/WebhookEvents/paths/webhookEvents/post) — **“Expected response”**                                                                                                                                                                                                                                                                                    |
| **6**  | _DoorDash Drive webhooks are optional._                                                                    | DoorDash Drive is a separate white-label delivery/fulfillment API. The integration under review handles DoorDash **Marketplace** orders and its `OrderCreate`/order webhook flow. Drive webhooks are therefore **out of scope**, rather than an optional component of the Marketplace integration.                                                                                                                                                                                                                           | **VERIFIED AS OUT OF SCOPE**                    | [DoorDash Drive Webhooks](https://developer.doordash.com/en-US/docs/drive/how_to/webhooks/) — **“Webhooks”**                                                                                                                                                                                                                                                                                                                                  |
| **7**  | _Verify whether Uber webhook `meta.resource_id` corresponds to the Get Order ID in the official examples._ | `meta.resource_id` identifies the order resource. The corresponding `resource_href` uses that identifier as the order ID for the Get Order request, matching the `{order_id}` path parameter documented by the Get Order API.                                                                                                                                                                                                                                                                                                | **VERIFIED AS CORRECT**                         | [Uber Eats `orders.notification` API](https://developer.uber.com/docs/eats/references/api/webhooks.orders-notification) — **“Webhook Event Structure”**, **“Example Webhook”**; [Uber Eats Get Order API v2](https://developer.uber.com/docs/eats/references/api/v2/get-eats-order-orderid) — **“Path Parameters” → `order_id`**                                                                                                              |
| **8**  | _Do not rely on a provider query parameter for normal provider detection._                                 | The implementation detects the provider using structural characteristics of the incoming payload rather than a provider query parameter. This is an **internal system-design decision**, not a behavior mandated by either provider's documentation.                                                                                                                                                                                                                                                                         | **VERIFIED AS INTERNAL DESIGN DECISION**        | **No provider documentation — internal integration invariant.** Uber's documented payload structure: [Uber Eats `orders.notification` API](https://developer.uber.com/docs/eats/references/api/webhooks.orders-notification) — **“Webhook Event Structure”**. DoorDash's documented payload structure: [DoorDash Marketplace](https://developer.doordash.com/en-US/docs/marketplace/how_to/order_integration/#receiving-orders-from-doordash) |
| **9**  | _Verify the documented location of DoorDash customer phone data._                                          | DoorDash places the customer phone number under `order.consumer.phone`. DoorDash also documents that this number may be masked depending on the integration/fulfillment configuration.                                                                                                                                                                                                                                                                                                                                       | **VERIFIED AS CORRECT**                         | [DoorDash Marketplace API Specification](https://developer.doordash.com/en-US/api/marketplace/#tag/Models/Order) — **“Order” → `consumer` → `phone`**; [DoorDash Masked Customer Phone Number](https://developer.doordash.com/en-US/docs/marketplace/retail/orders/features/masked_number/) — **“Get Started” → “Step 2”**                                                                                                                    |
| **10** | *Normalize marketplace statuses into the internal status model where appropriate.*                         | Uber documents order states including `CREATED` and `ACCEPTED`. DoorDash Marketplace sends incoming orders with status `NEW`; order confirmation is performed separately using `order_status: "success"` or `"fail"`. Therefore, mapping Uber `CREATED` → internal `RECEIVED`, DoorDash `NEW` → internal `RECEIVED`, and a successful DoorDash confirmation → internal `CONFIRMED` is an **internal canonical-domain mapping**, not a mapping from a DoorDash provider status named `CONFIRMED`. | **VERIFIED PROVIDER STATES / INTERNAL MAPPING** | [Uber Eats Get Order API v2](https://developer.uber.com/docs/eats/references/api/v2/get-eats-order-orderid) — **“Response Body - Order” → `current_state`**; [DoorDash Receive Orders](https://developer.doordash.com/en-US/docs/marketplace/how_to/order_integration/) — **“Receiving Orders from DoorDash”**; [DoorDash Order Confirmation](https://developer.doordash.com/en-US/docs/marketplace/retail/orders/reference/order_confirm/) — **“Sample order confirmation”** |

---

## 5. Architectural Highlights & Flowcharts

### A. Uber Eats Notification $\rightarrow$ Get Order Flow

```mermaid
sequenceDiagram
    autonumber
    actor Uber as Uber Eats Webhook
    participant API as Nomni Ingest Endpoint (/api/webhooks)
    participant Auth as Signature Verifier (HMAC-SHA256)
    participant Resolver as Order Details Resolver
    participant Store as Nomni Order Store

    Uber->>API: POST /api/webhooks (orders.notification)<br/>Header: X-Uber-Signature
    API->>Auth: Verify HMAC-SHA256(rawBody, client_secret)
    alt Invalid Signature
        Auth-->>API: Reject
        API-->>Uber: 401 Unauthorized
    else Valid Signature
        Auth-->>API: Signature Valid
        API->>Resolver: Resolve Order (meta.resource_id)
        Note over Resolver: Production: GET /v2/eats/order/{id} (Bearer Token)<br/>Offline Test: Load sample_order.json
        Resolver-->>API: Full Order Payload (cart, eater, charges)
        API->>Store: upsertOrder(canonicalOrder)
        Store-->>API: Persisted (isUpsert flag)
        API-->>Uber: HTTP 200 OK (Empty Body: 0 bytes)
    end
```

### B. DoorDash Marketplace OrderCreate Flow

```mermaid
sequenceDiagram
    autonumber
    actor DD as DoorDash Marketplace
    participant API as Nomni Ingest Endpoint (/api/webhooks)
    participant Auth as Auth Validator (Basic / Bearer)
    participant Normalizer as DoorDash Normalizer
    participant Store as Nomni Order Store

    DD->>API: POST /api/webhooks (OrderCreate)<br/>Header: Authorization (Basic/Bearer)
    API->>Auth: Validate configured credentials
    alt Unauthorized
        Auth-->>API: Invalid
        API-->>DD: 401 Unauthorized
    else Authorized
        Auth-->>API: Valid
        API->>Normalizer: Extract categories[].items, consumer.phone, subtotal, tax
        Normalizer-->>API: Internal Canonical Order
        API->>Store: upsertOrder(canonicalOrder)
        Store-->>API: Persisted (isUpsert flag)
        API-->>DD: HTTP 200 OK (Empty Body: acknowledges receipt, stops retries)
    end
```

### C. Kitchen State Machine & Redelivery Monotonic Guard

```mermaid
flowchart TD
    A[Incoming Webhook Ingested] --> B{Order already exists in Store?}
    B -- No: New Insert --> C[Set status = RECEIVED]
    C --> D[Persist to Store & Notify Kitchen Display]

    B -- Yes: Redelivery / Retry --> E{What is incoming status?}
    E -- CANCELLED --> F[Set status = CANCELLED]
    E -- Normal initial status: RECEIVED / NEW --> G{What is existing ticket status?}
    
    G -- Still RECEIVED --> H[Update order details, keep status = RECEIVED]
    G -- Advanced: CONFIRMED / PREPARING / READY / DELIVERED --> I[PRESERVE existing.status!<br/>Do NOT roll back kitchen progress]
    
    F --> D
    H --> D
    I --> D
```

### D. Kitchen Dashboard UI & Architecture
1. **Zero-Hint Routing**: Payload routing analyzes event discriminators without artificial query hints.
2. **State-Preserving Idempotency**: Webhook retries never roll back tickets that kitchen staff have moved forward.
3. **Obsidian & Glass Aesthetics**: Deep dark palette (`#09090b`) with violet accents (`#8b5cf6`) and translucent panels.
4. **Kitchen Usability**: Full keyboard navigation (`Tab` + `Enter`), URL query parameter persistence, and cleanly sequestered raw JSON debug panels.

