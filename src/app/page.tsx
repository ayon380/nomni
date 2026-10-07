'use client';

import React, { useState, useEffect, useTransition, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { InternalOrder, OrderProvider, OrderStatus } from '@/lib/types';
import { formatMoney, formatDateTime } from '@/lib/utils';
import { ProviderBadge } from '@/components/ProviderBadge';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  RefreshCw,
  ShoppingBag,
  Clock,
  ChevronRight,
  AlertCircle,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

function OrdersListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read initial states from URL query string
  const providerParam = searchParams.get('provider') || 'all';
  const statusParam = searchParams.get('status') || 'all';
  const searchParam = searchParams.get('search') || '';
  const sortParam = (searchParams.get('sort') as 'time_desc' | 'time_asc') || 'time_desc';

  const [provider, setProvider] = useState<string>(providerParam);
  const [status, setStatus] = useState<string>(statusParam);
  const [search, setSearch] = useState<string>(searchParam);
  const [sort, setSort] = useState<'time_desc' | 'time_asc'>(sortParam);

  const [orders, setOrders] = useState<InternalOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Sync state if URL searchParams change (e.g. back button)
  useEffect(() => {
    setProvider(searchParams.get('provider') || 'all');
    setStatus(searchParams.get('status') || 'all');
    setSearch(searchParams.get('search') || '');
    setSort((searchParams.get('sort') as 'time_desc' | 'time_asc') || 'time_desc');
  }, [searchParams]);

  // Push updated filter params to URL query string without remount
  const updateUrlParams = useCallback(
    (newFilters: { provider?: string; status?: string; search?: string; sort?: string }) => {
      const params = new URLSearchParams(searchParams.toString());

      const nextProvider = newFilters.provider !== undefined ? newFilters.provider : provider;
      const nextStatus = newFilters.status !== undefined ? newFilters.status : status;
      const nextSearch = newFilters.search !== undefined ? newFilters.search : search;
      const nextSort = newFilters.sort !== undefined ? newFilters.sort : sort;

      if (nextProvider && nextProvider !== 'all') params.set('provider', nextProvider);
      else params.delete('provider');

      if (nextStatus && nextStatus !== 'all') params.set('status', nextStatus);
      else params.delete('status');

      if (nextSearch && nextSearch.trim()) params.set('search', nextSearch.trim());
      else params.delete('search');

      if (nextSort && nextSort !== 'time_desc') params.set('sort', nextSort);
      else params.delete('sort');

      startTransition(() => {
        router.replace(`/?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams, provider, status, search, sort]
  );

  // Fetch orders from API
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (provider !== 'all') queryParams.set('provider', provider);
      if (status !== 'all') queryParams.set('status', status);
      if (search.trim()) queryParams.set('search', search.trim());
      queryParams.set('sort', sort);

      const res = await fetch(`/api/orders?${queryParams.toString()}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch kitchen orders');
    } finally {
      setLoading(false);
    }
  }, [provider, status, search, sort]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Debounced search input handler
  const handleSearchChange = (val: string) => {
    setSearch(val);
    updateUrlParams({ search: val });
  };

  const handleProviderChange = (val: string) => {
    setProvider(val);
    updateUrlParams({ provider: val });
  };

  const handleStatusChange = (val: string) => {
    setStatus(val);
    updateUrlParams({ status: val });
  };

  const handleSortToggle = () => {
    const nextSort = sort === 'time_desc' ? 'time_asc' : 'time_desc';
    setSort(nextSort);
    updateUrlParams({ sort: nextSort });
  };

  // Keyboard accessibility: Enter navigates to detail
  const handleRowKeyDown = (e: React.KeyboardEvent, orderId: string) => {
    if (e.key === 'Enter') {
      navigateToDetail(orderId);
    }
  };

  const navigateToDetail = (orderId: string) => {
    const currentQuery = searchParams.toString();
    const destination = currentQuery
      ? `/orders/${orderId}?${currentQuery}`
      : `/orders/${orderId}`;
    router.push(destination);
  };

  // Quick live simulation helper for demo walkthroughs
  const simulateIngest = async (fixtureType: 'uber' | 'doordash') => {
    setSimulating(fixtureType);
    try {
      let payload: Record<string, any>;
      let headers: Record<string, string> = { 'Content-Type': 'application/json' };

      if (fixtureType === 'uber') {
        payload = {
          event_id: `demo-${Date.now()}`,
          event_time: Math.floor(Date.now() / 1000),
          event_type: 'orders.notification',
          meta: {
            resource_id: 'f9f363d1-e1c2-4595-b477-c649845bc953',
            user_id: 'user_eats_9981',
          },
          resource_href: 'https://api.uber.com/v2/eats/order/f9f363d1-e1c2-4595-b477-c649845bc953',
        };
        // Compute test signature
        const crypto = await import('crypto');
        const hmac = crypto.createHmac('sha256', 'uber_webhook_secret_key');
        hmac.update(JSON.stringify(payload));
        headers['x-uber-signature'] = hmac.digest('hex');
      } else {
        payload = {
          event: {
            type: 'OrderCreate',
            status: 'NEW',
            created_at: new Date().toISOString(),
          },
          order: {
            id: `DD-DEMO-${Math.floor(1000 + Math.random() * 9000)}`,
            display_id: `DD-${Math.floor(1000 + Math.random() * 9000)}`,
            subtotal: 2850,
            tax: 285,
            tip_amount: 400,
            currency: 'USD',
            consumer: {
              first_name: 'Jessica',
              last_name: 'Taylor',
              phone_number: '+1 415 555 9821',
            },
            items: [
              {
                name: 'Spicy Miso Ramen',
                price: 1850,
                quantity: 1,
                special_instructions: 'Extra ajitsuke tamago',
              },
              {
                name: 'Iced Green Tea',
                price: 500,
                quantity: 2,
              },
            ],
          },
        };
        headers['authorization'] = 'Bearer doordash_marketplace_token_2026';
      }

      await fetch('/api/webhooks', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      await fetchOrders();
    } catch (e) {
      console.error('Simulation failed', e);
    } finally {
      setSimulating(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white flex items-center gap-2.5">
            <span>Kitchen Orders</span>
            <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-white/[0.08]">
              {orders.length} tickets
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Unified marketplace feed normalizing Uber Eats & DoorDash into internal tickets.
          </p>
        </div>

        {/* Live Simulation Controls for Demo */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => simulateIngest('uber')}
            disabled={simulating !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-900/40 transition-colors disabled:opacity-50"
            title="Simulates a verified Uber Eats webhook ingest"
          >
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>+ Ingest Uber</span>
          </button>

          <button
            onClick={() => simulateIngest('doordash')}
            disabled={simulating !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-950/40 text-rose-300 border border-rose-500/30 hover:bg-rose-900/40 transition-colors disabled:opacity-50"
            title="Simulates a verified DoorDash webhook ingest"
          >
            <Sparkles className="w-3 h-3 text-rose-400" />
            <span>+ Ingest DoorDash</span>
          </button>

          <button
            onClick={fetchOrders}
            className="p-1.5 rounded-lg bg-zinc-900 border border-white/[0.08] text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Refresh order feed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter / Search Controls Bar */}
      <div className="glass-panel rounded-2xl p-4 space-y-3 shadow-xl shadow-black/40">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by customer name or order ID..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-zinc-900/90 border border-white/[0.08] rounded-xl text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all outline-none"
            />
            {search && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
              >
                ✕
              </button>
            )}
          </div>

          {/* Provider Filter */}
          <div className="md:col-span-3">
            <div className="flex items-center gap-1.5 h-full">
              <span className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider hidden lg:inline">Channel:</span>
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full py-2 px-3 bg-zinc-900/90 border border-white/[0.08] rounded-xl text-xs text-zinc-200 focus:border-violet-500 outline-none transition-colors"
              >
                <option value="all">All Providers</option>
                <option value="uber_eats">Uber Eats</option>
                <option value="doordash">DoorDash</option>
              </select>
            </div>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-3">
            <div className="flex items-center gap-1.5 h-full">
              <span className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider hidden lg:inline">Status:</span>
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full py-2 px-3 bg-zinc-900/90 border border-white/[0.08] rounded-xl text-xs text-zinc-200 focus:border-violet-500 outline-none transition-colors"
              >
                <option value="all">All Statuses</option>
                <option value="RECEIVED">Received</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="PREPARING">Preparing</option>
                <option value="READY">Ready for Pickup</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Sort Toggle */}
          <div className="md:col-span-1 flex items-center justify-end">
            <button
              onClick={handleSortToggle}
              className={`w-full py-2 px-3 flex items-center justify-center gap-1.5 rounded-xl border text-xs font-medium transition-all ${
                sort === 'time_desc'
                  ? 'bg-zinc-900/90 border-white/[0.08] text-zinc-300 hover:text-white'
                  : 'bg-violet-950/40 border-violet-500/30 text-violet-300'
              }`}
              title="Toggle sort direction"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span className="md:hidden lg:inline">{sort === 'time_desc' ? 'Newest' : 'Oldest'}</span>
            </button>
          </div>
        </div>

        {/* Active Filters Pill Bar */}
        {(provider !== 'all' || status !== 'all' || search) && (
          <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04] text-[11px] text-zinc-400">
            <span>Filters:</span>
            {provider !== 'all' && (
              <span className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-zinc-300 flex items-center gap-1">
                Channel: {provider === 'uber_eats' ? 'Uber Eats' : 'DoorDash'}
                <button onClick={() => handleProviderChange('all')} className="hover:text-white">✕</button>
              </span>
            )}
            {status !== 'all' && (
              <span className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-zinc-300 flex items-center gap-1">
                Status: {status}
                <button onClick={() => handleStatusChange('all')} className="hover:text-white">✕</button>
              </span>
            )}
            {search && (
              <span className="px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-zinc-300 flex items-center gap-1">
                Search: &ldquo;{search}&rdquo;
                <button onClick={() => handleSearchChange('')} className="hover:text-white">✕</button>
              </span>
            )}
            <button
              onClick={() => {
                setProvider('all');
                setStatus('all');
                setSearch('');
                updateUrlParams({ provider: 'all', status: 'all', search: '' });
              }}
              className="text-violet-400 hover:text-violet-300 underline ml-auto cursor-pointer"
            >
              Reset all
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        // Loading Skeleton State
        <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 sm:p-5 flex items-center justify-between gap-4 animate-pulse">
              <div className="flex items-center gap-3 w-1/3">
                <div className="w-16 h-6 rounded-full bg-zinc-800" />
                <div className="w-24 h-4 rounded bg-zinc-800" />
              </div>
              <div className="w-32 h-4 rounded bg-zinc-800 hidden sm:block" />
              <div className="w-20 h-6 rounded-full bg-zinc-800" />
              <div className="w-16 h-4 rounded bg-zinc-800" />
            </div>
          ))}
        </div>
      ) : error ? (
        // Error State
        <div className="glass-panel rounded-2xl p-8 text-center space-y-3 border-red-500/20">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <h3 className="text-sm font-semibold text-white">Error Loading Orders</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">{error}</p>
          <button
            onClick={fetchOrders}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
          >
            Retry Connection
          </button>
        </div>
      ) : orders.length === 0 ? (
        // Empty State
        <div className="glass-panel rounded-2xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/[0.08] flex items-center justify-center mx-auto text-zinc-500">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">No Marketplace Orders Found</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">
              No orders matched your current filters. Try relaxing your search terms or ingest a sample webhook above.
            </p>
          </div>
          <button
            onClick={() => {
              setProvider('all');
              setStatus('all');
              setSearch('');
              updateUrlParams({ provider: 'all', status: 'all', search: '' });
            }}
            className="px-4 py-1.5 rounded-xl text-xs font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors shadow-lg shadow-violet-500/25"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        // Orders Table & Mobile Cards
        <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
          {/* Desktop Table View (>= 768px / 1280px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02] text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  <th className="py-3.5 px-5">Provider</th>
                  <th className="py-3.5 px-5">External ID</th>
                  <th className="py-3.5 px-5">Customer</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Total</th>
                  <th className="py-3.5 px-5 text-right">Time</th>
                  <th className="py-3.5 px-3 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-xs">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    tabIndex={0}
                    role="button"
                    onClick={() => navigateToDetail(order.id)}
                    onKeyDown={(e) => handleRowKeyDown(e, order.id)}
                    className="group hover:bg-white/[0.03] focus:bg-white/[0.04] focus:outline-none transition-colors cursor-pointer select-none"
                  >
                    {/* Provider */}
                    <td className="py-4 px-5">
                      <ProviderBadge provider={order.provider} />
                    </td>

                    {/* External Order ID */}
                    <td className="py-4 px-5 font-mono text-zinc-300 group-hover:text-violet-300 transition-colors">
                      <div className="flex items-center gap-1.5">
                        <span>{order.external_order_id}</span>
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="py-4 px-5">
                      <div className="font-medium text-zinc-200">{order.customer.name}</div>
                      {order.customer.phone && (
                        <div className="text-[11px] text-zinc-500 font-mono">{order.customer.phone}</div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-5">
                      <StatusBadge status={order.status} />
                    </td>

                    {/* Total Money (formatted, not raw cents) */}
                    <td className="py-4 px-5 text-right font-medium text-white tabular-nums">
                      {formatMoney(order.total_cents, order.currency)}
                    </td>

                    {/* Time */}
                    <td className="py-4 px-5 text-right text-zinc-400 tabular-nums">
                      {formatDateTime(order.created_at)}
                    </td>

                    {/* Action Arrow */}
                    <td className="py-4 px-3 text-center text-zinc-600 group-hover:text-zinc-300 transition-colors">
                      <ChevronRight className="w-4 h-4 ml-auto group-hover:translate-x-0.5 transition-transform" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout (< 768px, specifically tuned for 390px) */}
          <div className="md:hidden divide-y divide-white/[0.06]">
            {orders.map((order) => (
              <div
                key={order.id}
                tabIndex={0}
                role="button"
                onClick={() => navigateToDetail(order.id)}
                onKeyDown={(e) => handleRowKeyDown(e, order.id)}
                className="p-4 active:bg-white/[0.04] focus:bg-white/[0.04] transition-colors cursor-pointer space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <ProviderBadge provider={order.provider} />
                  <span className="text-[11px] text-zinc-500 tabular-nums">
                    {formatDateTime(order.created_at)}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-sm text-zinc-100">{order.customer.name}</h3>
                    <p className="text-xs font-mono text-zinc-400">{order.external_order_id}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-white tabular-nums">
                      {formatMoney(order.total_cents, order.currency)}
                    </span>
                    <p className="text-[10px] text-zinc-500">{order.line_items.length} items</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <StatusBadge status={order.status} />
                  <span className="text-[11px] text-violet-400 font-medium flex items-center gap-0.5">
                    View ticket <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Keyboard Navigation Tip Bar */}
          <div className="px-5 py-2.5 bg-white/[0.01] border-t border-white/[0.04] flex items-center justify-between text-[11px] text-zinc-500">
            <span className="hidden sm:inline">
              Tip: Use <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px] border border-white/[0.08]">Tab</kbd> and press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px] border border-white/[0.08]">Enter</kbd> to view order detail.
            </span>
            <span className="text-zinc-400 font-mono ml-auto">
              Showing {orders.length} orders
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrdersListPage() {
  return (
    <Suspense
      fallback={
        <div className="glass-panel rounded-2xl p-8 text-center text-zinc-400 text-xs animate-pulse">
          Loading Nomni Kitchen Hub...
        </div>
      }
    >
      <OrdersListContent />
    </Suspense>
  );
}
