import { NextRequest, NextResponse } from 'next/server';
import { orderStore } from '@/lib/store';
import { OrderStatus } from '@/lib/types';

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

    const updated = orderStore.updateOrderStatus(id, newStatus);
    if (!updated) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ order: updated });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to update order', message: err.message }, { status: 500 });
  }
}
