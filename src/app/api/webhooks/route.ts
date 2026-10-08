import { NextRequest, NextResponse } from 'next/server';
import { detectProvider } from '@/lib/normalizers/detector';
import { verifyUberSignature, normalizeUberOrder } from '@/lib/normalizers/uber';
import { verifyDoorDashAuth, normalizeDoorDashOrder } from '@/lib/normalizers/doordash';
import { orderStore } from '@/lib/store';

/**
 * Single Unified Ingest Webhook Endpoint
 * Accepts official Uber Eats and DoorDash payloads.
 *
 * Requirements strictly honored:
 * 1. Single HTTP endpoint.
 * 2. Detects provider from payload (no provider field in payload or query params required).
 * 3. Authenticates each provider according to official documentation.
 * 4. Resolves full order details according to provider flow.
 * 5. Persists one internal order row with idempotent upsert.
 * 6. Returns the official documented webhook response/status.
 */
export async function POST(req: NextRequest) {
  let rawBodyText: string;
  let bodyJson: Record<string, unknown>;

  try {
    rawBodyText = await req.text();
    bodyJson = JSON.parse(rawBodyText);
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload received' },
      { status: 400 }
    );
  }

  // 1. Detect provider with zero hints
  const provider = detectProvider(bodyJson);
  if (!provider) {
    return NextResponse.json(
      {
        error: 'Unrecognized webhook payload structure.',
        details: 'Expected Uber Eats (orders.notification) or DoorDash (OrderCreate). Do not include artificial provider fields.',
      },
      { status: 400 }
    );
  }

  // 2. Authenticate and process by provider
  if (provider === 'uber_eats') {
    const signature = req.headers.get('x-uber-signature');
    const isValid = verifyUberSignature(rawBodyText, signature);

    if (!isValid) {
      return NextResponse.json(
        {
          error: 'Unauthorized: Missing or invalid X-Uber-Signature header.',
          hint: 'Uber webhooks require an HMAC-SHA256 signature in the X-Uber-Signature header.',
        },
        { status: 401 }
      );
    }

    try {
      // Normalize and upsert
      const internalOrder = normalizeUberOrder(bodyJson);
      const { order, isUpsert } = orderStore.upsertOrder(internalOrder);

      // Official Uber Eats documentation: Return HTTP 200 OK with an empty body
      return new NextResponse(null, {
        status: 200,
        headers: {
          'X-Nomni-Order-Id': order.id,
          'X-Nomni-Upsert': isUpsert ? 'true' : 'false',
        },
      });
    } catch (err: unknown) {
      console.error('Error processing Uber order:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json(
        { error: 'Failed to process Uber order', message },
        { status: 500 }
      );
    }
  }

  if (provider === 'doordash') {
    const authHeader = req.headers.get('authorization') || req.headers.get('x-doordash-signature');
    const isValid = verifyDoorDashAuth(authHeader);

    if (!isValid) {
      return NextResponse.json(
        {
          error: 'Unauthorized: Missing or invalid Authorization header.',
          hint: 'DoorDash webhooks are authenticated via integrator-configured credentials (Authorization: Bearer <TOKEN> or Basic).',
        },
        { status: 401 }
      );
    }

    try {
      // Normalize and upsert
      const internalOrder = normalizeDoorDashOrder(bodyJson);
      const { order, isUpsert } = orderStore.upsertOrder(internalOrder);

      // Official DoorDash documentation: Return HTTP 200 OK to acknowledge receipt and prevent retries.
      // (The public docs do not specify any response body schema).
      return new NextResponse(null, {
        status: 200,
        headers: {
          'X-Nomni-Order-Id': order.id,
          'X-Nomni-Upsert': isUpsert ? 'true' : 'false',
        },
      });
    } catch (err: unknown) {
      console.error('Error processing DoorDash order:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json(
        { error: 'Failed to process DoorDash order', message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
}
