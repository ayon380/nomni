import { NextRequest, NextResponse } from 'next/server';

function buildMockOrder(orderId: string): Record<string, unknown> {
  const seed = orderId.charCodeAt(0) % 5;

  const menus = [
    { id: 'Muffin', title: 'Fresh-baked muffin', unitPrice: 350 },
    { id: 'Coffee', title: 'Coffee', unitPrice: 300 },
    { id: 'Strawberry_Donut', title: 'Strawberry Donut', unitPrice: 250 },
    { id: 'Bagel', title: 'Everything Bagel', unitPrice: 400 },
    { id: 'OJ', title: 'Orange Juice', unitPrice: 275 },
  ] as const;

  const item1 = menus[seed];
  const item2 = menus[(seed + 1) % menus.length];
  const subTotal = item1.unitPrice + item2.unitPrice;
  const tax = Math.round(subTotal * 0.08);

  const firstNames = ['Larry', 'Dana', 'Morgan', 'Quinn', 'Alex'] as const;
  const storeIds = [
    'c7f1dc2f-fabe-4997-845c-cad26fdcb894',
    'a1b2c3d4-0001-4000-8000-000000000001',
    'a1b2c3d4-0002-4000-8000-000000000002',
    'a1b2c3d4-0003-4000-8000-000000000003',
    'a1b2c3d4-0004-4000-8000-000000000004',
  ] as const;

  const makePriceBlock = (amount: number) => ({
    unit_price: { amount, currency_code: 'USD', formatted_amount: `$${(amount / 100).toFixed(2)}` },
    total_price: { amount, currency_code: 'USD', formatted_amount: `$${(amount / 100).toFixed(2)}` },
    base_unit_price: { amount, currency_code: 'USD', formatted_amount: `$${(amount / 100).toFixed(2)}` },
  });

  const makeItem = (item: typeof menus[number], eaterUuid: string) => ({
    id: item.id,
    instance_id: `${item.id}-Instance`,
    title: item.title,
    external_data: `External data for ${item.title}`,
    quantity: 1,
    price: makePriceBlock(item.unitPrice),
    selected_modifier_groups: null,
    eater_id: eaterUuid,
  });

  const eaterUuid = `eater-uuid-000${seed}`;

  return {
    id: orderId,
    display_id: orderId === '153dd7f1-339d-4619-940c-418943c14636'
      ? 'BC953'
      : (orderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5) || 'UB001').toUpperCase(),
    external_reference_id: `Order-Mock-${seed}`,
    current_state: 'CREATED',
    store: {
      id: storeIds[seed],
      name: "Harry's Hamburgers",
      external_reference_id: `HARRY_${seed}`,
      integrator_store_id: `Store${seed}`,
      integrator_brand_id: 'Brand123',
      merchant_store_id: `HARRY_${seed}`,
    },
    eater: {
      first_name: firstNames[seed],
      phone: `+1 555-000-000${seed}`,
      phone_code: `55500${seed}`,
    },
    eaters: [{ id: eaterUuid, first_name: firstNames[seed] }],
    cart: {
      items: [makeItem(item1, eaterUuid), makeItem(item2, eaterUuid)],
      fulfillment_issues: [],
    },
    payment: {
      charges: {
        total: { amount: subTotal + tax, currency_code: 'USD', formatted_amount: `$${((subTotal + tax) / 100).toFixed(2)}` },
        sub_total: { amount: subTotal, currency_code: 'USD', formatted_amount: `$${(subTotal / 100).toFixed(2)}` },
        tax: { amount: tax, currency_code: 'USD', formatted_amount: `$${(tax / 100).toFixed(2)}` },
      },
    },
    placed_at: new Date().toISOString(),
    estimated_ready_for_pickup_at: new Date(Date.now() + 20 * 60_000).toISOString(),
    type: 'DELIVERY_BY_UBER',
    brand: 'UBER_EATS',
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // --- Auth ---
  const authHeader = req.headers.get('authorization') ?? '';
  const expectedToken = process.env.UBER_API_TOKEN || process.env.UBER_MOCK_TOKEN || 'uber_mock_dev_token';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token || token !== expectedToken) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Missing or invalid Authorization: Bearer <token>' },
      { status: 401 },
    );
  }

  // --- ID ---
  const { id } = await params;
  if (!id || id.trim() === '') {
    return NextResponse.json({ error: 'Missing order id' }, { status: 400 });
  }

  return NextResponse.json(buildMockOrder(id), {
    status: 200,
    headers: { 'X-Nomni-Mock': 'true' },
  });
}
