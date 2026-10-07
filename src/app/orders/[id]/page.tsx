'use client';

import React, { useState, useEffect, use, useTransition, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { InternalOrder } from '@/lib/types';
import { formatMoney, formatDateTime, getNextStatus, getProviderLabel } from '@/lib/utils';
import { ProviderBadge } from '@/components/ProviderBadge';
import { StatusBadge } from '@/components/StatusBadge';
import {
  ArrowLeft,
  Clock,
  Phone,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Code2,
  Terminal,
  RefreshCw,
} from 'lucide-react';

import { useOrdersStore } from '@/store/useOrdersStore';

function OrderDetailContent({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise);
  const router = useRouter();
  const searchParams = useSearchParams();
  const orders = useOrdersStore((state) => state.orders);
  const updateOrderInStore = useOrdersStore((state) => state.updateOrderInStore);

  const cachedOrder = orders.find((o) => o.id === id) || null;
  const [order, setOrder] = useState<InternalOrder | null>(cachedOrder);
  const [loading, setLoading] = useState(!cachedOrder);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // React 19 Concurrent Transition for seamless navigation and mutations
  const [isPending, startTransition] = useTransition();

  // Preserve query string for "Back to Orders"
  const backHref = searchParams.toString() ? `/?${searchParams.toString()}` : '/';

  useEffect(() => {
    let ignore = false;
    fetch(`/api/orders/${id}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error('Order not found');
          throw new Error(`HTTP error ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (!ignore) {
          setOrder(data.order);
          updateOrderInStore(data.order);
          setLoading(false);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to load order');
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [id, updateOrderInStore]);

  // Advance status forward with useTransition
  const handleAdvanceStatus = () => {
    if (!order) return;
    const next = getNextStatus(order.status);
    if (!next) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: next }),
        });
        if (!res.ok) throw new Error('Failed to advance order status');
        const data = await res.json();
        setOrder(data.order);
        updateOrderInStore(data.order);
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'Failed to advance order status');
      }
    });
  };

  // Keyboard navigation: Escape goes back to list preserving filters
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        startTransition(() => {
          router.push(backHref);
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router, backHref]);

  // Copy raw payload JSON to clipboard
  const handleCopyJson = () => {
    if (!order) return;
    navigator.clipboard.writeText(JSON.stringify(order.raw_payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="w-32 h-6 rounded bg-[#E8E2D1] dark:bg-zinc-800" />
        <div className="nomni-glass rounded-2xl p-8 space-y-4">
          <div className="w-48 h-8 rounded bg-[#E8E2D1] dark:bg-zinc-800" />
          <div className="w-full h-32 rounded bg-[#E8E2D1] dark:bg-zinc-800" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-4xl mx-auto nomni-glass rounded-2xl p-12 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
        <h2 className="text-base font-semibold text-[#0E3727] dark:text-white font-display">
          Ticket Not Found
        </h2>
        <p className="text-xs text-[#4A4E57] dark:text-zinc-400">
          The requested ticket #{id} could not be retrieved from the kitchen database.
        </p>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#0E3727] dark:bg-zinc-800 text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Orders
        </Link>
      </div>
    );
  }

  const nextStatus = getNextStatus(order.status);

  return (
    <div className={`max-w-4xl mx-auto space-y-6 transition-opacity duration-200 ${isPending ? 'opacity-70' : ''}`}>
      {/* Top Navigation & Back Button (Preserves Filters) */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/70 dark:bg-white/[0.04] text-[#0E3727] dark:text-zinc-200 border border-[#E8E2D1] dark:border-white/[0.08] hover:bg-[#EFE9D7] dark:hover:bg-white/[0.08] transition-colors group cursor-pointer shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Orders</span>
          <kbd className="hidden sm:inline px-1 py-0.2 rounded text-[10px] font-mono bg-[#EFE9D7] dark:bg-white/[0.08] text-[#7F818A] dark:text-zinc-400 border border-[#E0D8C3] dark:border-white/[0.08]">
            Esc
          </kbd>
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-[#7F818A] dark:text-zinc-500">
            Internal ID: {order.id}
          </span>
        </div>
      </div>

      {/* Main Kitchen Ticket Card */}
      <div className="nomni-glass rounded-2xl p-6 sm:p-8 space-y-8">
        {/* Ticket Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-[#E8E2D1] dark:border-white/[0.06]">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <ProviderBadge provider={order.provider} />
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-[#EFE9D7] dark:bg-zinc-800 text-[#0E3727] dark:text-zinc-300 border border-[#E0D8C3] dark:border-white/[0.08]">
                #{order.external_order_id}
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[#0E3727] dark:text-white font-display">
              {order.customer.name}
            </h1>
            <div className="flex items-center gap-3 text-xs text-[#4A4E57] dark:text-zinc-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#7F818A]" />
                {formatDateTime(order.created_at)}
              </span>
              {order.customer.phone && (
                <>
                  <span className="text-[#C5BFAD] dark:text-zinc-600">•</span>
                  <span className="flex items-center gap-1 font-mono font-medium text-[#0E3727] dark:text-zinc-300">
                    <Phone className="w-3 h-3 text-[#7F818A]" />
                    {order.customer.phone}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Status & Status Progression Action */}
          <div className="flex flex-col sm:items-end gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#4A4E57] dark:text-zinc-400">Current Status:</span>
              <StatusBadge status={order.status} />
            </div>

            {nextStatus && (
              <button
                onClick={handleAdvanceStatus}
                disabled={isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#0E3727] dark:bg-[#2AC864] text-white dark:text-[#0E3727] transition-all cursor-pointer shadow-md hover:opacity-95 active:scale-95 disabled:opacity-50"
              >
                {isPending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Advance to {nextStatus.charAt(0) + nextStatus.slice(1).toLowerCase()}</span>
              </button>
            )}

            {!nextStatus && (
              <span className="text-[11px] text-[#7F818A] dark:text-zinc-500 italic">
                Order reached terminal state ({order.status.toLowerCase()}).
              </span>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#0E3727] dark:text-zinc-300">
              Order Items ({order.line_items.length})
            </h3>
            <span className="text-[11px] text-[#7F818A] dark:text-zinc-500">Unit Price & Line Total</span>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#E8E2D1] dark:border-white/[0.06] bg-white/40 dark:bg-black/20">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E8E2D1] dark:border-white/[0.06] bg-[#FAF7E9]/60 dark:bg-white/[0.02] text-[11px] font-semibold text-[#4A4E57] dark:text-zinc-400 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Item</th>
                  <th className="py-2.5 px-4 text-center w-16">Qty</th>
                  <th className="py-2.5 px-4 text-right w-24">Unit Price</th>
                  <th className="py-2.5 px-4 text-right w-28">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E2D1]/60 dark:divide-white/[0.04]">
                {order.line_items.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-white/50 dark:hover:bg-white/[0.01]">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[#0E3727] dark:text-zinc-100">{item.name}</div>
                      {item.special_instructions && (
                        <div className="text-[11px] text-[#B45309] dark:text-amber-400 mt-0.5 italic flex items-center gap-1">
                          <span>Note:</span> {item.special_instructions}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-[#0E3727] dark:text-zinc-300 tabular-nums">
                      {item.quantity}×
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[#4A4E57] dark:text-zinc-400 tabular-nums">
                      {formatMoney(item.unit_price, order.currency)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#0E3727] dark:text-white tabular-nums">
                      {formatMoney(item.line_total, order.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals Summary */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pt-4 border-t border-[#E8E2D1] dark:border-white/[0.06]">
          <div className="text-xs text-[#4A4E57] dark:text-zinc-400 space-y-1">
            <p>Provider: <span className="font-semibold text-[#0E3727] dark:text-zinc-200">{getProviderLabel(order.provider)}</span></p>
            <p>Normalized Currency: <span className="font-mono font-semibold text-[#0E3727] dark:text-zinc-200">{order.currency}</span></p>
          </div>

          <div className="w-full sm:w-64 space-y-2 text-xs">
            <div className="flex justify-between text-[#4A4E57] dark:text-zinc-400">
              <span>Items Subtotal:</span>
              <span className="font-mono tabular-nums text-[#0E3727] dark:text-zinc-200 font-medium">
                {formatMoney(
                  order.line_items.reduce((acc, it) => acc + it.line_total, 0),
                  order.currency
                )}
              </span>
            </div>
            <div className="flex justify-between text-base font-bold text-[#0E3727] dark:text-white pt-2 border-t border-[#E8E2D1] dark:border-white/[0.06]">
              <span>Grand Total:</span>
              <span className="font-mono tabular-nums text-[#0E3727] dark:text-[#2AC864]">
                {formatMoney(order.total_cents, order.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Debug Accordion (raw cents and original JSON appear ONLY here) */}
        <details className="group border border-[#E8E2D1] dark:border-white/[0.08] bg-white/40 dark:bg-black/30 rounded-xl overflow-hidden text-xs">
          <summary className="px-4 py-3 cursor-pointer flex items-center justify-between text-[#4A4E57] dark:text-zinc-400 hover:text-[#0E3727] dark:hover:text-zinc-200 font-semibold select-none transition-colors">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-[#0E3727] dark:text-[#2AC864]" />
              <span>Debug Telemetry & Original Marketplace Payload</span>
            </div>
            <span className="text-[11px] font-mono text-[#7F818A] group-open:rotate-90 transition-transform">
              ▸
            </span>
          </summary>

          <div className="p-4 space-y-4 border-t border-[#E8E2D1] dark:border-white/[0.06] bg-[#FAF7E9]/70 dark:bg-zinc-950/80">
            {/* Raw Cents & Metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-2.5 rounded-lg bg-white/80 dark:bg-white/[0.03] border border-[#E8E2D1] dark:border-white/[0.04]">
                <div className="text-[10px] uppercase font-mono text-[#7F818A] dark:text-zinc-500">raw total_cents</div>
                <div className="text-sm font-mono text-[#0E3727] dark:text-[#2AC864] font-bold">{order.total_cents}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-white/80 dark:bg-white/[0.03] border border-[#E8E2D1] dark:border-white/[0.04]">
                <div className="text-[10px] uppercase font-mono text-[#7F818A] dark:text-zinc-500">currency code</div>
                <div className="text-sm font-mono text-[#0E3727] dark:text-zinc-200">{order.currency}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-white/80 dark:bg-white/[0.03] border border-[#E8E2D1] dark:border-white/[0.04]">
                <div className="text-[10px] uppercase font-mono text-[#7F818A] dark:text-zinc-500">internal id</div>
                <div className="text-sm font-mono text-[#0E3727] dark:text-zinc-200 truncate">{order.id}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-white/80 dark:bg-white/[0.03] border border-[#E8E2D1] dark:border-white/[0.04]">
                <div className="text-[10px] uppercase font-mono text-[#7F818A] dark:text-zinc-500">external ref</div>
                <div className="text-sm font-mono text-[#0E3727] dark:text-zinc-200 truncate">{order.external_order_id}</div>
              </div>
            </div>

            {/* Raw Marketplace JSON */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-[#4A4E57] dark:text-zinc-400 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5 text-[#7F818A]" />
                  raw_payload ({order.provider})
                </span>
                <button
                  onClick={handleCopyJson}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#EFE9D7] dark:bg-zinc-800 hover:bg-[#E4DDC7] dark:hover:bg-zinc-700 text-[11px] font-medium text-[#0E3727] dark:text-zinc-200 transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-[#10B981] dark:text-[#34D399]" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-3 rounded-lg bg-white/90 dark:bg-black/90 border border-[#E8E2D1] dark:border-white/[0.06] text-[11px] font-mono text-[#0E3727] dark:text-zinc-300 overflow-x-auto max-h-96">
                {JSON.stringify(order.raw_payload, null, 2)}
              </pre>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto nomni-glass rounded-2xl p-8 text-center text-xs animate-pulse">
          Loading order details...
        </div>
      }
    >
      <OrderDetailContent paramsPromise={params} />
    </Suspense>
  );
}
