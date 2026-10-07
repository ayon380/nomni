Goal

Build a small marketplace-order system where Uber Eats and DoorDash appear as the same internal kitchen ticket.

One repo. API + React admin.

Primary docs — these are authoritative

Uber webhook: https://developer.uber.com/docs/eats/references/api/webhooks.orders-notification

Uber Get Order: https://developer.uber.com/docs/eats/references/api/v2/get-eats-order-orderid

DoorDash Order Integration: https://developer.doordash.com/en-US/docs/marketplace/how_to/order_integration/

DoorDash sample order linked from the above documentation

Docs win over this brief. If something here conflicts with the official docs, follow the docs and record the conflict in the README.

1. Ingest API

Create one HTTP endpoint that accepts the official Uber and DoorDash webhook payloads.

Requirements:

Detect the provider from the payload.

Do not require or add a provider field to fixtures.

Authenticate each provider according to its official documentation.

A webhook notification is not necessarily the order itself. Follow each provider's documented flow.

Persist one internal order row.

Upsert when the same marketplace order is received again.

Use the official documentation for the correct webhook response/status.

Use the official examples as fixtures under:

/fixtures
Keep webhook and Get Order examples separate where the providers' docs do.

2. Internal Order Model

Use this internal model:

id
provider
external_order_id
status
customer
line_items[]
total_cents
currency
created_at
raw_payload
The model is ours, not a copy of either marketplace schema.

In the README, include a short mapping table showing which official provider field maps to each internal field.

3. React Admin

/

Show only the internal model:

Provider

External order ID

Customer name

Status

Total as money — not raw cents

Time

Include:

Provider filter

Status filter

Search by customer name or order ID

Sort by time

Filters preserved in the query string

Back from detail preserves filters

Loading state

Empty state

Error state

Keyboard-accessible rows — Enter opens detail

Responsive at 1280px and 390px

/orders/:id

Show:

Customer

Line items

Name

Quantity

Unit price

Line total

Status

Totals

Allow status to move forward from the detail page.

The list should update without a full page/remount.

Raw cents and original marketplace JSON should appear only inside a debug <details> section.

Use only 2–5 orders for the demo, but structure the list as something that could grow.

4. README

Before the walkthrough, include:

Run instructions

How to start the API and admin.

Curl examples

One working curl for each provider using the headers/auth required by the official docs.

Mapping table

Provider field → internal field.

Conflicts log

Review the working notes below and explicitly record:

Which were verified as correct

Which were rejected/changed

Which official documentation overruled them

Working Notes — Verify, Don't Trust

These may be stale. The official docs always win.

Uber may include the full cart in the webhook; verify whether a Get Order call is still required.

DoorDash Marketplace line items may use a top-level items[].

Verify which DoorDash monetary field should become total_cents and whether tax is included.

Verify Uber webhook signature generation and the X-Uber-Signature header.

Verify the exact Uber webhook response status/body.

DoorDash Drive webhooks are optional.

Verify whether Uber webhook meta.resource_id corresponds to the Get Order id in the official examples.

Do not rely on a provider query parameter for normal provider detection.

Verify the documented location of DoorDash customer phone data.

Normalize marketplace statuses into the internal status model where appropriate.

Out of Scope

Authentication/login

Live Uber/DoorDash accounts

Swiggy

Kafka

Component-library work

Production deployment

10,000+ dummy records

Handoff

At the end of the booked slot:

API + admin must run.

Both provider curl examples must work.

README must contain the mapping table and conflicts log.

Be ready to explain the implementation and defend the important decisions.

--
Anivar A Aravind
VP Engineering, Platform
Nomni
anivar@nomni.ai
