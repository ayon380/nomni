import { NextRequest, NextResponse } from 'next/server';
import { orderStore } from '@/lib/store';
import { OrderStatus } from '@/lib/types';
import { isValidStatusTransition } from '@/lib/utils';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = orderStore.getOrderById(id);

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  return NextResponse.json({ order });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const newStatus = body.status as OrderStatus;

    if (!newStatus) {
      return NextResponse.json({ error: 'Missing status in request body' }, { status: 400 });
    }

    const existing = orderStore.getOrderById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!isValidStatusTransition(existing.status, newStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status transition: cannot transition order from ${existing.status} to ${newStatus}`,
          current_status: existing.status,
          attempted_status: newStatus,
        },
        { status: 400 }
      );
    }

    const updated = orderStore.updateOrderStatus(id, newStatus);
    return NextResponse.json({ order: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to update order', message }, { status: 500 });
  }
}

