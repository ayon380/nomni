import { NextRequest, NextResponse } from 'next/server';
import { UBER_DEFAULT_SECRET, computeUberSignature } from '@/lib/normalizers/uber';
import { DOORDASH_DEFAULT_TOKEN } from '@/lib/normalizers/doordash';

const UBER_CUSTOMERS = [
  { name: 'Liam O’Connor', phone: '+61 412 884 192', item: 'Double Truffle Wagyu Burger', price: 1850 },
  { name: 'Chloe Davies', phone: '+61 413 559 201', item: 'Crispy Southern Fried Chicken Bao', price: 1650 },
  { name: 'Noah Smith', phone: '+61 498 123 774', item: 'Avocado Toast with Poached Eggs', price: 1550 },
  { name: 'Emma Wilson', phone: '+61 405 993 112', item: 'Smoked Salmon Poke Bowl', price: 1950 },
];

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
    const cust = UBER_CUSTOMERS[Math.floor(Math.random() * UBER_CUSTOMERS.length)];
    const uniqueOrderId = `uber-${Date.now()}-${randSuffix}`;
    const displayId = `UB-${randSuffix}`;

    // Full Uber order structure
    const payload = {
      id: uniqueOrderId,
      display_id: displayId,
      external_reference_id: `POS-${randSuffix}`,
      current_state: 'CREATED',
      type: 'DELIVERY_BY_UBER',
      placed_at: new Date().toISOString(),
      eater: {
        first_name: cust.name.split(' ')[0],
        last_name: cust.name.split(' ')[1] || '',
        phone: cust.phone,
      },
      cart: {
        items: [
          {
            id: `item_ub_${randSuffix}_1`,
            title: cust.item,
            quantity: 1,
            price: {
              unit_price: { amount: cust.price, currency_code: 'AUD' },
              total_price: { amount: cust.price, currency_code: 'AUD' },
            },
            special_instructions: 'Customer requested quick prep',
          },
          {
            id: `item_ub_${randSuffix}_2`,
            title: 'San Pellegrino Sparkling (500ml)',
            quantity: 1,
            price: {
              unit_price: { amount: 550, currency_code: 'AUD' },
              total_price: { amount: 550, currency_code: 'AUD' },
            },
          },
        ],
      },
      payment: {
        charges: {
          total: { amount: cust.price + 550, currency_code: 'AUD' },
          sub_total: { amount: cust.price + 550, currency_code: 'AUD' },
          tax: { amount: Math.round((cust.price + 550) * 0.1), currency_code: 'AUD' },
        },
      },
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

    const data = await res.json();
    return NextResponse.json({
      success: res.ok,
      provider: 'uber_eats',
      display_id: displayId,
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
          phone_number: cust.phone,
        },
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
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DOORDASH_DEFAULT_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    return NextResponse.json({
      success: res.ok,
      provider: 'doordash',
      display_id: displayId,
      status: res.status,
      data,
    });
  }
}
