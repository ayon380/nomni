import { NextRequest, NextResponse } from 'next/server';
import { UBER_DEFAULT_SECRET, computeUberSignature } from '@/lib/normalizers/uber';
import { DOORDASH_DEFAULT_TOKEN } from '@/lib/normalizers/doordash';

const DOORDASH_CUSTOMERS = [
  { name: 'Sophia Martinez', phone: '+1 415 672 9011', item: 'Tonkotsu Black Garlic Ramen', price: 1950 },
  { name: 'Ethan Wright', phone: '+1 415 882 3410', item: 'Pan-Fried Gyoza & Kimchi Fried Rice', price: 2100 },
  { name: 'Olivia Brown', phone: '+1 415 339 8812', item: 'Spicy Dragon Roll & Edamame', price: 2450 },
  { name: 'Lucas Chen', phone: '+1 415 990 4421', item: 'Teriyaki Chicken Bento Box', price: 1800 },
];

/**
 * Server-side simulation route for testing webhook ingestion.
 * Runs on Node.js (with full crypto access) and exercises the real /api/webhooks endpoint.
 */
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const provider = searchParams.get('provider') || 'uber';

  const host = req.headers.get('host') || 'localhost:3000';
  const protocol = req.headers.get('x-forwarded-proto') || 'http';
  const webhookUrl = `${protocol}://${host}/api/webhooks`;

  const randSuffix = Math.floor(1000 + Math.random() * 9000);

  if (provider === 'uber') {
    const resourceId = crypto.randomUUID();
    const displayId = `UB-${randSuffix}`;
    const payload = {
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

    const rawBody = JSON.stringify(payload);
    const signature = computeUberSignature(rawBody, UBER_DEFAULT_SECRET);

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Uber-Signature': signature,
      },
      body: rawBody,
    });

    const rawText = await res.text();
    let data: unknown = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = null;
    }

    const orderId = res.headers.get('x-nomni-order-id');
    const isUpsert = res.headers.get('x-nomni-upsert');

    return NextResponse.json({
      success: res.ok,
      provider: 'uber_eats',
      display_id: displayId,
      order_id: orderId,
      is_upsert: isUpsert === 'true',
      status: res.status,
      data,
    });
  } else {
    // DoorDash Simulation
    const cust = DOORDASH_CUSTOMERS[Math.floor(Math.random() * DOORDASH_CUSTOMERS.length)];
    const uniqueId = `DD-${Date.now().toString().slice(-6)}-${randSuffix}`;
    const displayId = `DD-${randSuffix}`;
    const subtotal = cust.price + 600;
    const tax = Math.round(subtotal * 0.09);
    const tip = 400;

    const payload = {
      event: {
        type: 'OrderCreate',
        status: 'NEW',
        created_at: new Date().toISOString(),
      },
      order: {
        id: uniqueId,
        display_id: displayId,
        subtotal,
        tax,
        tip_amount: tip,
        currency: 'USD',
        is_pickup: false,
        consumer: {
          first_name: cust.name.split(' ')[0],
          last_name: cust.name.split(' ')[1] || '',
          phone: cust.phone,
        },
        categories: [
          {
            name: 'Entrees',
            items: [
              {
                id: `item_dd_${randSuffix}_1`,
                name: cust.item,
                price: cust.price,
                quantity: 1,
                special_instructions: 'Pack extra napkins',
              },
              {
                id: `item_dd_${randSuffix}_2`,
                name: 'Iced Jasmine Green Tea',
                price: 600,
                quantity: 1,
              },
            ],
          },
        ],
      },
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DOORDASH_DEFAULT_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const rawText = await res.text();
    let data: unknown = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = null;
    }

    const orderId = res.headers.get('x-nomni-order-id');
    const isUpsert = res.headers.get('x-nomni-upsert');

    return NextResponse.json({
      success: res.ok,
      provider: 'doordash',
      display_id: displayId,
      order_id: orderId,
      is_upsert: isUpsert === 'true',
      status: res.status,
      data,
    });
  }
}
