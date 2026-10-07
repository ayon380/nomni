import { NextRequest, NextResponse } from 'next/server';
import { orderStore } from '@/lib/store';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const provider = searchParams.get('provider') || undefined;
  const status = searchParams.get('status') || undefined;
  const search = searchParams.get('search') || undefined;
  const sort = (searchParams.get('sort') as 'time_desc' | 'time_asc') || 'time_desc';

  const orders = orderStore.getAllOrders({
    provider,
    status,
    search,
    sort,
  });

  return NextResponse.json({
    orders,
    total: orders.length,
  });
}
