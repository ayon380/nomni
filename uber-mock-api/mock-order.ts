/**
 * Uber Eats Mock Order Builder
 *
 * Constructs mock order objects adhering strictly to the official Uber Eats
 * Get Order v2 documentation and response contract:
 * https://developer.uber.com/docs/eats/api/v2/get/eats-order-orderid
 */

export function buildMockOrder(orderId: string): Record<string, unknown> {
  const seed = (orderId.charCodeAt(0) + orderId.charCodeAt(orderId.length - 1)) % 5;

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

  const eaterUuid = `eater-uuid-${orderId.slice(-6)}`;

  const makeItem = (item: typeof menus[number], idx: number) => ({
    id: `${item.id}-${idx}`,
    instance_id: `${item.id}-Instance-${idx}`,
    title: item.title,
    external_data: `External data for ${item.title}`,
    quantity: 1,
    price: makePriceBlock(item.unitPrice),
    selected_modifier_groups: null,
    eater_id: eaterUuid,
  });

  // Short human-readable display code for restaurant ticket (Uber format e.g. "BC953" or "UB123")
  const cleanChars = orderId.replace(/[^a-zA-Z0-9]/g, '');
  const displayId = cleanChars.length >= 5
    ? cleanChars.slice(-5).toUpperCase()
    : `UB${cleanChars.toUpperCase()}`;

  return {
    id: orderId,
    display_id: displayId,
    external_reference_id: `Order-Mock-${cleanChars.slice(-6)}`,
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
      items: [makeItem(item1, 1), makeItem(item2, 2)],
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
