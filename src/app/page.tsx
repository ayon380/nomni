'use client';

import React, { useState, useEffect, useTransition, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { InternalOrder } from '@/lib/types';
import { formatMoney, formatDateTime } from '@/lib/utils';
import { ProviderBadge } from '@/components/ProviderBadge';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Search,
  ArrowUpDown,
  RefreshCw,
  ShoppingBag,
  ChevronRight,
  AlertCircle,
  Sparkles,
  Command,
  CornerDownLeft,
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

  // Keyboard navigation index (-1 when none selected)
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // React 19 Concurrent Transition for buttery smooth updates
  const [isPending, startTransition] = useTransition();

  // Sync state if URL query params change (e.g. back button)
  useEffect(() => {
    setProvider(searchParams.get('provider') || 'all');
    setStatus(searchParams.get('status') || 'all');
    setSearch(searchParams.get('search') || '');
    setSort((searchParams.get('sort') as 'time_desc' | 'time_asc') || 'time_desc');
  }, [searchParams]);

  // Push updated filter params to URL query string using useTransition
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

      // Use transition for seamless non-blocking page transition
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
      setSelectedIndex(0); // Reset selection to top item
    } catch (err: any) {
      setError(err.message || 'Failed to fetch kitchen orders');
    } finally {
      setLoading(false);
    }
  }, [provider, status, search, sort]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Navigate to Detail using useTransition
  const navigateToDetail = useCallback(
    (orderId: string) => {
      const currentQuery = searchParams.toString();
      const destination = currentQuery
        ? `/orders/${orderId}?${currentQuery}`
        : `/orders/${orderId}`;
      startTransition(() => {
        router.push(destination);
      });
    },
    [router, searchParams]
  );

  // Full Keyboard Navigation (Up, Down, Enter, /, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search input when pressing '/'
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // If user is actively typing in the search bar
      if (document.activeElement === searchInputRef.current) {
        if (e.key === 'Escape') {
          searchInputRef.current?.blur();
        } else if (e.key === 'Enter' && orders.length > 0) {
          searchInputRef.current?.blur();
          navigateToDetail(orders[0].id);
        }
        return;
      }

      // Arrow navigation across rows
      if (orders.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, orders.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (orders[selectedIndex]) {
          navigateToDetail(orders[selectedIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [orders, selectedIndex, navigateToDetail]);

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

  // Quick live simulation helper for demo walkthroughs
  const simulateIngest = async (fixtureType: 'uber' | 'doordash') => {
    setSimulating(fixtureType);
    try {
      const res = await fetch(`/api/simulate?provider=${fixtureType}`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error(`Simulation failed: HTTP ${res.status}`);
      }
      await fetchOrders();
    } catch (e: any) {
      console.error('Simulation failed', e);
      alert(`Simulation failed: ${e.message}`);
    } finally {
      setSimulating(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-2 border-b border-[#E8E2D1] dark:border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-[#0E3727] dark:text-[#F4F4F6] font-display">
              Kitchen Orders
            </h1>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-[#EFE9D7] dark:bg-white/[0.06] text-[#0E3727] dark:text-zinc-300 border border-[#E0D8C3] dark:border-white/[0.08]">
              {orders.length} tickets
            </span>
            {isPending && (
              <span className="text-[11px] font-mono text-[#2AC864] flex items-center gap-1 animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" /> Updating...
              </span>
            )}
          </div>
          <p className="text-xs text-[#4A4E57] dark:text-zinc-400 mt-1">
            Real-time unified order pipeline mapping Uber Eats and DoorDash into canonical tickets.
          </p>
        </div>

        {/* Live Simulation Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => simulateIngest('uber')}
            disabled={simulating !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#E7F6ED] dark:bg-[#06291C] text-[#0E4A2F] dark:text-[#34D399] border border-[#BCE8CD] dark:border-[#0E5C3B] hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
            title="Simulate verified Uber Eats webhook ingestion"
          >
            <Sparkles className="w-3 h-3 text-[#10B981] dark:text-[#34D399]" />
            <span>+ Uber Webhook</span>
          </button>

          <button
            onClick={() => simulateIngest('doordash')}
            disabled={simulating !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FDE8E8] dark:bg-[#2A0E10] text-[#9B1C1C] dark:text-[#F87171] border border-[#F8B4B4] dark:border-[#5C1D24] hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
            title="Simulate verified DoorDash webhook ingestion"
          >
            <Sparkles className="w-3 h-3 text-[#EF4444] dark:text-[#F87171]" />
            <span>+ DoorDash Webhook</span>
          </button>

          <button
            onClick={fetchOrders}
            className="p-2 rounded-xl bg-[#FFFFFF] dark:bg-zinc-900 border border-[#E8E2D1] dark:border-white/[0.08] text-[#0E3727] dark:text-zinc-300 hover:bg-[#EFE9D7] dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Refresh feed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter / Search Controls Bar */}
      <div className="nomni-glass rounded-2xl p-4 space-y-3 transition-colors duration-200">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input with keyboard shortcut hint */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-[#7F818A] dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by customer or order ID... (press /)"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white/70 dark:bg-black/30 border border-[#E8E2D1] dark:border-white/[0.1] rounded-xl text-xs text-[#0E3727] dark:text-zinc-100 placeholder:text-[#7F818A] dark:placeholder:text-zinc-500 focus:border-[#2AC864] focus:ring-1 focus:ring-[#2AC864] outline-none transition-all"
            />
            {search ? (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            ) : (
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#EFE9D7] dark:bg-white/[0.08] text-[#7F818A] dark:text-zinc-400 border border-[#E0D8C3] dark:border-white/[0.08]">
                /
              </kbd>
            )}
          </div>

          {/* Provider Filter */}
          <div className="md:col-span-3">
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full py-2 px-3 bg-white/70 dark:bg-black/30 border border-[#E8E2D1] dark:border-white/[0.1] rounded-xl text-xs font-medium text-[#0E3727] dark:text-zinc-200 focus:border-[#2AC864] outline-none transition-colors"
            >
              <option value="all">All Marketplaces</option>
              <option value="uber_eats">Uber Eats</option>
              <option value="doordash">DoorDash</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-3">
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full py-2 px-3 bg-white/70 dark:bg-black/30 border border-[#E8E2D1] dark:border-white/[0.1] rounded-xl text-xs font-medium text-[#0E3727] dark:text-zinc-200 focus:border-[#2AC864] outline-none transition-colors"
            >
              <option value="all">All Ticket Statuses</option>
              <option value="RECEIVED">Received</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PREPARING">Preparing</option>
              <option value="READY">Ready for Pickup</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Sort Toggle */}
          <div className="md:col-span-1 flex items-center justify-end">
            <button
              onClick={handleSortToggle}
              className={`w-full py-2 px-3 flex items-center justify-center gap-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                sort === 'time_desc'
                  ? 'bg-white/70 dark:bg-black/30 border-[#E8E2D1] dark:border-white/[0.1] text-[#0E3727] dark:text-zinc-300'
                  : 'bg-[#0E3727] dark:bg-[#2AC864] border-transparent text-white dark:text-[#0E3727]'
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
          <div className="flex items-center gap-2 pt-2 border-t border-[#E8E2D1] dark:border-white/[0.04] text-[11px] text-[#4A4E57] dark:text-zinc-400">
            <span>Active filters:</span>
            {provider !== 'all' && (
              <span className="px-2 py-0.5 rounded-md bg-[#EFE9D7] dark:bg-white/[0.08] text-[#0E3727] dark:text-zinc-200 border border-[#E0D8C3] dark:border-white/[0.08] flex items-center gap-1">
                Channel: {provider === 'uber_eats' ? 'Uber Eats' : 'DoorDash'}
                <button onClick={() => handleProviderChange('all')} className="hover:font-bold">✕</button>
              </span>
            )}
            {status !== 'all' && (
              <span className="px-2 py-0.5 rounded-md bg-[#EFE9D7] dark:bg-white/[0.08] text-[#0E3727] dark:text-zinc-200 border border-[#E0D8C3] dark:border-white/[0.08] flex items-center gap-1">
                Status: {status}
                <button onClick={() => handleStatusChange('all')} className="hover:font-bold">✕</button>
              </span>
            )}
            {search && (
              <span className="px-2 py-0.5 rounded-md bg-[#EFE9D7] dark:bg-white/[0.08] text-[#0E3727] dark:text-zinc-200 border border-[#E0D8C3] dark:border-white/[0.08] flex items-center gap-1">
                Search: &ldquo;{search}&rdquo;
                <button onClick={() => handleSearchChange('')} className="hover:font-bold">✕</button>
              </span>
            )}
            <button
              onClick={() => {
                setProvider('all');
                setStatus('all');
                setSearch('');
                updateUrlParams({ provider: 'all', status: 'all', search: '' });
              }}
              className="text-[#0E3727] dark:text-[#2AC864] font-medium hover:underline ml-auto cursor-pointer"
            >
              Reset all
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="nomni-glass rounded-2xl overflow-hidden divide-y divide-[#E8E2D1] dark:divide-white/[0.04]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 sm:p-5 flex items-center justify-between gap-4 animate-pulse">
              <div className="flex items-center gap-3 w-1/3">
                <div className="w-16 h-6 rounded-full bg-[#E8E2D1] dark:bg-zinc-800" />
                <div className="w-24 h-4 rounded bg-[#E8E2D1] dark:bg-zinc-800" />
              </div>
              <div className="w-32 h-4 rounded bg-[#E8E2D1] dark:bg-zinc-800 hidden sm:block" />
              <div className="w-20 h-6 rounded-full bg-[#E8E2D1] dark:bg-zinc-800" />
              <div className="w-16 h-4 rounded bg-[#E8E2D1] dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="nomni-glass rounded-2xl p-8 text-center space-y-3 border-red-500/20">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <h3 className="text-sm font-semibold text-[#0E3727] dark:text-white">Error Loading Orders</h3>
          <p className="text-xs text-[#4A4E57] dark:text-zinc-400 max-w-sm mx-auto">{error}</p>
          <button
            onClick={fetchOrders}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-[#0E3727] dark:bg-zinc-800 text-white transition-colors"
          >
            Retry Connection
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="nomni-glass rounded-2xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#EFE9D7] dark:bg-zinc-900 border border-[#E0D8C3] dark:border-white/[0.08] flex items-center justify-center mx-auto text-[#7F818A]">
            <ShoppingBag className="w-6 h-6 text-[#0E3727] dark:text-[#2AC864]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#0E3727] dark:text-white font-display">
              No Marketplace Orders Found
            </h3>
            <p className="text-xs text-[#4A4E57] dark:text-zinc-400 max-w-sm mx-auto mt-1">
              No orders matched your current filters. Clear your filters or ingest a sample webhook above.
            </p>
          </div>
          <button
            onClick={() => {
              setProvider('all');
              setStatus('all');
              setSearch('');
              updateUrlParams({ provider: 'all', status: 'all', search: '' });
            }}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#0E3727] dark:bg-[#2AC864] text-white dark:text-[#0E3727] transition-all cursor-pointer shadow-md"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div
          ref={tableRef}
          className={`nomni-glass rounded-2xl overflow-hidden transition-all duration-200 ${
            isPending ? 'transition-pending' : ''
          }`}
        >
          {/* Desktop Table View (>= 768px / 1280px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E8E2D1] dark:border-white/[0.06] bg-[#FAF7E9]/50 dark:bg-white/[0.02] text-[11px] font-semibold uppercase tracking-wider text-[#4A4E57] dark:text-zinc-400">
                  <th className="py-3.5 px-5">Provider</th>
                  <th className="py-3.5 px-5">External ID</th>
                  <th className="py-3.5 px-5">Customer</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Total</th>
                  <th className="py-3.5 px-5 text-right">Time</th>
                  <th className="py-3.5 px-3 text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E2D1]/70 dark:divide-white/[0.04] text-xs">
                {orders.map((order, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <tr
                      key={order.id}
                      tabIndex={0}
                      role="button"
                      aria-selected={isSelected}
                      onClick={() => {
                        setSelectedIndex(idx);
                        navigateToDetail(order.id);
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`group focus:outline-none transition-colors cursor-pointer select-none ${
                        isSelected
                          ? 'bg-[#EFE7D2] dark:bg-[#1E232B] ring-2 ring-[#0E3727] dark:ring-[#2AC864] ring-inset'
                          : 'hover:bg-[#F5EEDC] dark:hover:bg-white/[0.02]'
                      }`}
                    >
                      {/* Provider */}
                      <td className="py-4 px-5">
                        <ProviderBadge provider={order.provider} />
                      </td>

                      {/* External Order ID */}
                      <td className="py-4 px-5 font-mono font-medium text-[#0E3727] dark:text-zinc-200">
                        {order.external_order_id}
                      </td>

                      {/* Customer */}
                      <td className="py-4 px-5">
                        <div className="font-semibold text-[#0E3727] dark:text-zinc-100">
                          {order.customer.name}
                        </div>
                        {order.customer.phone && (
                          <div className="text-[11px] text-[#7F818A] dark:text-zinc-500 font-mono">
                            {order.customer.phone}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5">
                        <StatusBadge status={order.status} />
                      </td>

                      {/* Total Money (formatted, not raw cents) */}
                      <td className="py-4 px-5 text-right font-bold text-[#0E3727] dark:text-white tabular-nums">
                        {formatMoney(order.total_cents, order.currency)}
                      </td>

                      {/* Time */}
                      <td className="py-4 px-5 text-right text-[#4A4E57] dark:text-zinc-400 tabular-nums">
                        {formatDateTime(order.created_at)}
                      </td>

                      {/* Action Arrow & Keyboard Indicator */}
                      <td className="py-4 px-3 text-center text-[#7F818A] group-hover:text-[#0E3727] dark:group-hover:text-zinc-200 transition-colors">
                        {isSelected ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold text-[#0E3727] dark:text-[#2AC864]">
                            <CornerDownLeft className="w-3 h-3" />
                          </span>
                        ) : (
                          <ChevronRight className="w-4 h-4 ml-auto" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout (< 768px, tuned for 390px iPhone) */}
          <div className="md:hidden divide-y divide-[#E8E2D1] dark:divide-white/[0.06]">
            {orders.map((order, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={order.id}
                  tabIndex={0}
                  role="button"
                  onClick={() => navigateToDetail(order.id)}
                  className={`p-4 transition-colors cursor-pointer space-y-3 ${
                    isSelected
                      ? 'bg-[#EFE7D2] dark:bg-[#1E232B] ring-2 ring-[#0E3727] dark:ring-[#2AC864]'
                      : 'active:bg-[#F5EEDC] dark:active:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <ProviderBadge provider={order.provider} />
                    <span className="text-[11px] text-[#4A4E57] dark:text-zinc-400 tabular-nums">
                      {formatDateTime(order.created_at)}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-sm text-[#0E3727] dark:text-zinc-100">
                        {order.customer.name}
                      </h3>
                      <p className="text-xs font-mono text-[#7F818A] dark:text-zinc-400">
                        {order.external_order_id}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-[#0E3727] dark:text-white tabular-nums">
                        {formatMoney(order.total_cents, order.currency)}
                      </span>
                      <p className="text-[10px] text-[#7F818A]">{order.line_items.length} items</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <StatusBadge status={order.status} />
                    <span className="text-[11px] text-[#0E3727] dark:text-[#2AC864] font-semibold flex items-center gap-0.5">
                      Open ticket <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Keyboard Navigation Tip Footer */}
          <div className="px-5 py-2.5 bg-[#FAF7E9]/60 dark:bg-white/[0.01] border-t border-[#E8E2D1] dark:border-white/[0.04] flex items-center justify-between text-[11px] text-[#4A4E57] dark:text-zinc-500">
            <div className="flex items-center gap-2">
              <Command className="w-3.5 h-3.5 text-[#0E3727] dark:text-[#2AC864]" />
              <span className="hidden sm:inline">
                Navigate: <kbd className="px-1.5 py-0.5 rounded bg-[#EFE9D7] dark:bg-zinc-800 text-[#0E3727] dark:text-zinc-200 font-mono text-[10px] border border-[#E0D8C3] dark:border-white/[0.08]">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-[#EFE9D7] dark:bg-zinc-800 text-[#0E3727] dark:text-zinc-200 font-mono text-[10px] border border-[#E0D8C3] dark:border-white/[0.08]">↓</kbd> • Open: <kbd className="px-1.5 py-0.5 rounded bg-[#EFE9D7] dark:bg-zinc-800 text-[#0E3727] dark:text-zinc-200 font-mono text-[10px] border border-[#E0D8C3] dark:border-white/[0.08]">Enter</kbd> • Search: <kbd className="px-1.5 py-0.5 rounded bg-[#EFE9D7] dark:bg-zinc-800 text-[#0E3727] dark:text-zinc-200 font-mono text-[10px] border border-[#E0D8C3] dark:border-white/[0.08]">/</kbd>
              </span>
            </div>
            <span className="font-mono text-[#0E3727] dark:text-zinc-400">
              Showing {orders.length} tickets
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
        <div className="nomni-glass rounded-2xl p-8 text-center text-xs animate-pulse">
          Loading Nomni Kitchen Hub...
        </div>
      }
    >
      <OrdersListContent />
    </Suspense>
  );
}
